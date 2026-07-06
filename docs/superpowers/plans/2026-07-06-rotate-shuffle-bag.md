# Rotate Shuffle Bag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the weighted-random selection in `/rotate template use` with a shuffle-bag algorithm so every member is drawn exactly once per cycle.

**Architecture:** A `bag: string[]` field on `FacilitatorTemplate` persists the names not yet drawn in the current cycle. Pure functions in `src/utils/rotateHelpers.ts` (`shuffle`, `drawFromBag`, `insertIntoBag`) implement the algorithm with an injectable RNG for deterministic tests. `src/commands/rotate.ts` wires them in via a `selectFn` callback passed to `runRoulette`. `/rotate run` (ad-hoc) keeps the existing `selectParticipants` behavior.

**Tech Stack:** TypeScript, discord.js v14, Jest (ts-jest), JSON file storage.

**Spec:** `docs/superpowers/specs/2026-07-06-rotate-shuffle-bag-design.md`

## Global Constraints

- Branch: work on `feature/rotate-shuffle-bag` (already exists, contains the spec).
- TDD: Red → Green → Refactor. Do not mix phases.
- Commit messages: subject ≤50 chars, blank line, body wrapped at 72 chars. No Claude footer.
- Run `npm run lint` and `npm run format:check` before each commit.
- `/rotate run` behavior must not change.
- Empty bag is never persisted after a draw (spec: reshuffle happens before saving).
- `selectionCounts` keeps being incremented on every selection (used for future stats).

---

### Task 1: Add `bag` field to model and storage

**Files:**

- Modify: `src/models/facilitatorTemplate.ts`
- Modify: `src/utils/facilitatorTemplateStorage.ts:19-24` (loadTemplates), `:45-54` (upsertTemplate)
- Modify: `src/commands/rotate.ts:381-390` (handleTemplateSave — compile fix)
- Test: `src/__tests__/facilitatorTemplateStorage.test.ts`
- Modify: `src/__tests__/rotate.test.ts` (fixture compile fixes)

**Interfaces:**

- Consumes: nothing new.
- Produces: `FacilitatorTemplate.bag: string[]` (required), `StoredFacilitatorTemplate.bag?: string[]` (optional). `loadTemplates()` defaults missing `bag` to `[]`. `upsertTemplate()` removes names not in `participants` from `bag`.

- [ ] **Step 1: Write the failing tests**

In `src/__tests__/facilitatorTemplateStorage.test.ts`, inside `describe('loadTemplates', ...)` add:

```typescript
it('should default bag to empty array when stored template has no bag', async () => {
  const stored = [
    {
      ...mockTemplate,
      bag: undefined,
      createdAt: mockTemplate.createdAt.toISOString(),
      updatedAt: mockTemplate.updatedAt.toISOString(),
    },
  ];
  mockReadFile.mockResolvedValue(JSON.stringify(stored));

  const templates = await storage.loadTemplates();

  expect(templates[0].bag).toEqual([]);
});

it('should preserve bag when stored template has one', async () => {
  const stored = [
    {
      ...mockTemplate,
      bag: ['Bob', 'Alice'],
      createdAt: mockTemplate.createdAt.toISOString(),
      updatedAt: mockTemplate.updatedAt.toISOString(),
    },
  ];
  mockReadFile.mockResolvedValue(JSON.stringify(stored));

  const templates = await storage.loadTemplates();

  expect(templates[0].bag).toEqual(['Bob', 'Alice']);
});
```

Inside the describe block for `upsertTemplate` add:

```typescript
it('should remove names not in participants from bag on upsert', async () => {
  const enoentError = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  mockReadFile.mockRejectedValue(enoentError);

  await storage.upsertTemplate({
    ...mockTemplate,
    participants: ['Alice', 'Bob'],
    bag: ['Bob', 'Ghost', 'Alice'],
  });

  const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
  expect(written[0].bag).toEqual(['Bob', 'Alice']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern=facilitatorTemplateStorage`
Expected: FAIL — TypeScript error `'bag' does not exist in type 'FacilitatorTemplate'` (the type error is the red phase here).

- [ ] **Step 3: Implement model and storage changes**

In `src/models/facilitatorTemplate.ts`:

```typescript
export interface FacilitatorTemplate {
  id: string; // UUID (reserved for future use, e.g. audit logs)
  guildId: string;
  name: string; // unique per guild, max 50 chars
  participants: string[]; // min 1, max 50 entries
  selectionCounts: { [participantName: string]: number };
  bag: string[]; // names not yet drawn in the current shuffle-bag cycle
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredFacilitatorTemplate {
  id: string;
  guildId: string;
  name: string;
  participants: string[];
  selectionCounts?: { [participantName: string]: number };
  bag?: string[];
  createdAt: string;
  updatedAt: string;
}
```

In `src/utils/facilitatorTemplateStorage.ts`, `loadTemplates` mapping becomes:

```typescript
return stored.map((t) => ({
  ...t,
  selectionCounts: t.selectionCounts ?? {},
  bag: t.bag ?? [],
  createdAt: new Date(t.createdAt),
  updatedAt: new Date(t.updatedAt),
}));
```

In `upsertTemplate`, extend the reconcile block:

```typescript
const validNames = new Set(template.participants);
const reconciledCounts: { [name: string]: number } = {};
for (const name of Object.keys(template.selectionCounts)) {
  if (validNames.has(name)) {
    reconciledCounts[name] = template.selectionCounts[name];
  }
}
const reconciledBag = template.bag.filter((name) => validNames.has(name));
const reconciledTemplate = { ...template, selectionCounts: reconciledCounts, bag: reconciledBag };
```

- [ ] **Step 4: Fix compile errors at all `FacilitatorTemplate` construction sites**

The now-required `bag` breaks these object literals — add `bag: [],` to each:

1. `src/__tests__/facilitatorTemplateStorage.test.ts` — the `mockTemplate` fixture (top of file).
2. `src/__tests__/rotate.test.ts` — every inline `const template = { ... selectionCounts: ... }` fixture passed to `mockResolvedValue` (find them with `grep -n "selectionCounts" src/__tests__/rotate.test.ts`; there are ~6).
3. `src/commands/rotate.ts` `handleTemplateSave` — the `upsertTemplate({...})` call gets `bag: [],` after `selectionCounts: {},`. (Empty bag = the next `template use` starts a fresh shuffled cycle, which is the spec's "save resets the bag" behavior.)

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS (all suites, including the 3 new tests).

- [ ] **Step 6: Lint, format, commit**

```bash
npm run lint && npm run format:check
git add src/models/facilitatorTemplate.ts src/utils/facilitatorTemplateStorage.ts src/commands/rotate.ts src/__tests__/facilitatorTemplateStorage.test.ts src/__tests__/rotate.test.ts
git commit -m "feat: add bag field to facilitator templates

Add shuffle-bag state to FacilitatorTemplate. Missing bag defaults
to empty on load, and upsert reconciliation removes names that are
no longer participants. Template save starts with an empty bag."
```

---

### Task 2: `shuffle` and `drawFromBag` pure functions

**Files:**

- Modify: `src/utils/rotateHelpers.ts`
- Create: `src/__tests__/rotateHelpers.test.ts`

**Interfaces:**

- Consumes: nothing (pure functions).
- Produces:

```typescript
export interface DrawResult {
  selected: string[];
  bag: string[];
}
export function shuffle<T>(items: T[], rng?: () => number): T[];
export function drawFromBag(
  participants: string[],
  bag: string[],
  count: number,
  rng?: () => number,
): DrawResult;
```

`rng` defaults to `Math.random`. Existing `selectParticipants` stays untouched.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/rotateHelpers.test.ts`:

```typescript
import { shuffle, drawFromBag } from '../utils/rotateHelpers';

describe('shuffle', () => {
  test('returns a permutation of the input without mutating it', () => {
    const input = ['A', 'B', 'C', 'D', 'E'];
    const result = shuffle(input);
    expect([...result].sort()).toEqual([...input].sort());
    expect(input).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  test('is deterministic with an injected rng', () => {
    const rng = () => 0;
    expect(shuffle(['A', 'B', 'C'], rng)).toEqual(shuffle(['A', 'B', 'C'], rng));
  });
});

describe('drawFromBag', () => {
  test('draws from the front of the bag in order', () => {
    const result = drawFromBag(['A', 'B', 'C'], ['B', 'C'], 1);
    expect(result.selected).toEqual(['B']);
    expect(result.bag).toEqual(['C']);
  });

  test('filters names no longer in participants from the bag', () => {
    const result = drawFromBag(['A', 'B', 'C'], ['Ghost', 'B', 'C'], 1);
    expect(result.selected).toEqual(['B']);
    expect(result.bag).toEqual(['C']);
  });

  test('reshuffles all participants when the bag is empty', () => {
    const result = drawFromBag(['A', 'B', 'C'], [], 1);
    expect(['A', 'B', 'C']).toContain(result.selected[0]);
    expect(result.bag).toHaveLength(2);
  });

  test('draws everyone exactly once per cycle', () => {
    const participants = ['A', 'B', 'C', 'D'];
    let bag: string[] = [];
    const drawn: string[] = [];
    for (let i = 0; i < participants.length; i++) {
      const result = drawFromBag(participants, bag, 1);
      drawn.push(result.selected[0]);
      bag = result.bag;
    }
    expect([...drawn].sort()).toEqual(['A', 'B', 'C', 'D']);
  });

  test('never returns an empty bag', () => {
    for (let trial = 0; trial < 50; trial++) {
      const result = drawFromBag(['A', 'B'], ['A'], 1);
      expect(result.bag.length).toBeGreaterThan(0);
    }
  });

  test('reshuffled bag does not start with the person just drawn', () => {
    for (let trial = 0; trial < 100; trial++) {
      // C is drawn, the bag is exhausted, so a fresh 3-person bag is created
      const result = drawFromBag(['A', 'B', 'C'], ['C'], 1);
      expect(result.bag).toHaveLength(3);
      expect(result.bag[0]).not.toBe('C');
    }
  });

  test('count>1 crossing a cycle boundary yields no duplicates', () => {
    for (let trial = 0; trial < 100; trial++) {
      const result = drawFromBag(['A', 'B', 'C'], ['C'], 2);
      expect(result.selected[0]).toBe('C');
      expect(new Set(result.selected).size).toBe(2);
    }
  });

  test('a member skipped at a cycle boundary stays in the new bag', () => {
    for (let trial = 0; trial < 100; trial++) {
      // C is selected from the old cycle, then the new cycle's bag must
      // still contain C (it was skipped, not consumed)
      const result = drawFromBag(['A', 'B', 'C'], ['C'], 2);
      expect(result.bag).toHaveLength(2);
      expect(result.bag).toContain('C');
    }
  });

  test('single participant is always selected', () => {
    const result = drawFromBag(['A'], [], 1);
    expect(result.selected).toEqual(['A']);
    expect(result.bag).toEqual(['A']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern=rotateHelpers`
Expected: FAIL — `shuffle` and `drawFromBag` are not exported.

- [ ] **Step 3: Implement in `src/utils/rotateHelpers.ts`**

Append to the file (keep `weightedRandomPick` and `selectParticipants` as they are):

```typescript
export interface DrawResult {
  selected: string[];
  bag: string[];
}

export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function reshuffleWithGuard(
  participants: string[],
  lastDrawn: string | undefined,
  rng: () => number,
): string[] {
  const fresh = shuffle(participants, rng);
  if (fresh.length > 1 && lastDrawn !== undefined && fresh[0] === lastDrawn) {
    const j = 1 + Math.floor(rng() * (fresh.length - 1));
    [fresh[0], fresh[j]] = [fresh[j], fresh[0]];
  }
  return fresh;
}

export function drawFromBag(
  participants: string[],
  bag: string[],
  count: number,
  rng: () => number = Math.random,
): DrawResult {
  const validNames = new Set(participants);
  let currentBag = bag.filter((name) => validNames.has(name));
  const safeCount = Math.min(count, participants.length);
  const selected: string[] = [];
  const selectedSet = new Set<string>();

  while (selected.length < safeCount) {
    let index = currentBag.findIndex((name) => !selectedSet.has(name));
    if (index === -1) {
      // bag exhausted (or only holds names already selected in this call):
      // start a new cycle, keeping skipped names in the new bag
      currentBag = reshuffleWithGuard(participants, selected[selected.length - 1], rng);
      index = currentBag.findIndex((name) => !selectedSet.has(name));
    }
    const [next] = currentBag.splice(index, 1);
    selected.push(next);
    selectedSet.add(next);
  }

  if (currentBag.length === 0) {
    // never persist an empty bag; reshuffle now while lastDrawn is known
    currentBag = reshuffleWithGuard(participants, selected[selected.length - 1], rng);
  }

  return { selected, bag: currentBag };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern=rotateHelpers`
Expected: PASS (11 tests).

- [ ] **Step 5: Lint, format, commit**

```bash
npm run lint && npm run format:check
git add src/utils/rotateHelpers.ts src/__tests__/rotateHelpers.test.ts
git commit -m "feat: add shuffle bag draw functions

Add shuffle and drawFromBag to rotateHelpers. drawFromBag draws
from the front of the persisted bag, reshuffles all participants
when the bag empties, guards against the last-drawn person leading
the new cycle, and never returns an empty bag. RNG is injectable
for deterministic tests."
```

---

### Task 3: `insertIntoBag` pure function

**Files:**

- Modify: `src/utils/rotateHelpers.ts`
- Test: `src/__tests__/rotateHelpers.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:

```typescript
export function insertIntoBag(bag: string[], newMembers: string[], rng?: () => number): string[];
```

Returns a new array; inserting into an empty bag returns an empty bag (the next `use` reshuffles everyone, new members included).

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/rotateHelpers.test.ts` (add `insertIntoBag` to the import):

```typescript
describe('insertIntoBag', () => {
  test('inserted members are present and existing order is preserved', () => {
    const result = insertIntoBag(['A', 'B', 'C'], ['X', 'Y']);
    expect(result).toHaveLength(5);
    expect(result).toEqual(expect.arrayContaining(['A', 'B', 'C', 'X', 'Y']));
    const existing = result.filter((n) => ['A', 'B', 'C'].includes(n));
    expect(existing).toEqual(['A', 'B', 'C']);
  });

  test('inserts at the position chosen by rng', () => {
    const result = insertIntoBag(['A', 'B'], ['X'], () => 0);
    expect(result).toEqual(['X', 'A', 'B']);
  });

  test('does not mutate the input bag', () => {
    const bag = ['A', 'B'];
    insertIntoBag(bag, ['X']);
    expect(bag).toEqual(['A', 'B']);
  });

  test('empty bag stays empty so the next use reshuffles everyone', () => {
    expect(insertIntoBag([], ['X'])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern=rotateHelpers`
Expected: FAIL — `insertIntoBag` is not exported.

- [ ] **Step 3: Implement in `src/utils/rotateHelpers.ts`**

```typescript
export function insertIntoBag(
  bag: string[],
  newMembers: string[],
  rng: () => number = Math.random,
): string[] {
  if (bag.length === 0) {
    return [];
  }
  const result = [...bag];
  for (const member of newMembers) {
    const position = Math.floor(rng() * (result.length + 1));
    result.splice(position, 0, member);
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern=rotateHelpers`
Expected: PASS (15 tests).

- [ ] **Step 5: Lint, format, commit**

```bash
npm run lint && npm run format:check
git add src/utils/rotateHelpers.ts src/__tests__/rotateHelpers.test.ts
git commit -m "feat: add insertIntoBag for template member adds

New members are inserted at a random position in the remaining
bag so they join the current cycle fairly. An empty bag stays
empty because the next draw reshuffles all participants anyway."
```

---

### Task 4: Wire shuffle bag into the rotate command

**Files:**

- Modify: `src/commands/rotate.ts` (`runRoulette`, `handleRun`, `handleTemplateUse`, `handleTemplateAddMember`)
- Test: `src/__tests__/rotate.test.ts`
- Modify: `README.md` (template feature description)

**Interfaces:**

- Consumes: `drawFromBag`, `insertIntoBag` from Task 2/3; `bag` field from Task 1.
- Produces: `runRoulette(interaction, participants, count, selectFn: () => string[])` — the 4th parameter replaces the old `selectionCounts` parameter and is called once when the user clicks Start Selection.

- [ ] **Step 1: Write the failing tests**

In `src/__tests__/rotate.test.ts`, inside the `template add-member subcommand` describe block, add:

```typescript
test('add-member inserts new members into a non-empty bag', async () => {
  const template = {
    id: 'uuid-1',
    guildId: 'guild-1',
    name: 'Team',
    participants: ['Alice', 'Bob'],
    selectionCounts: {},
    bag: ['Bob'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  jest.spyOn(FacilitatorTemplateStorage.prototype, 'getTemplateByName').mockResolvedValue(template);
  const upsertSpy = jest
    .spyOn(FacilitatorTemplateStorage.prototype, 'upsertTemplate')
    .mockResolvedValue(undefined);

  const interaction = makeAddMemberInteraction('Team', 'Charlie');
  await command.execute(interaction);

  const upserted = upsertSpy.mock.calls[0][0];
  expect(upserted.bag).toHaveLength(2);
  expect(upserted.bag).toContain('Bob');
  expect(upserted.bag).toContain('Charlie');
  jest.restoreAllMocks();
});
```

In the top-level `describe('Rotate Command', ...)` block, add a save test (mirror the `makeAddMemberInteraction` factory pattern):

```typescript
describe('template save bag reset', () => {
  function makeSaveInteraction(templateName: string, participants: string) {
    const reply = jest.fn().mockResolvedValue(undefined);
    return {
      guildId: 'guild-1',
      replied: false,
      deferred: false,
      reply,
      followUp: jest.fn(),
      options: {
        getSubcommandGroup: () => 'template',
        getSubcommand: () => 'save',
        getString: (name: string) => (name === 'name' ? templateName : participants),
      },
    } as unknown as import('discord.js').ChatInputCommandInteraction;
  }

  test('template save starts with an empty bag', async () => {
    const upsertSpy = jest
      .spyOn(FacilitatorTemplateStorage.prototype, 'upsertTemplate')
      .mockResolvedValue(undefined);

    const interaction = makeSaveInteraction('Team', 'Alice, Bob');
    await command.execute(interaction);

    expect(upsertSpy).toHaveBeenCalledWith(expect.objectContaining({ bag: [] }));
    jest.restoreAllMocks();
  });
});
```

- [ ] **Step 2: Run tests to verify the add-member test fails**

Run: `npm test -- --testPathPattern="rotate\.test"`
Expected: `add-member inserts new members into a non-empty bag` FAILS (bag passed through unchanged, so `upserted.bag` is `['Bob']`, length 1). The save test may already pass (Task 1 added `bag: []`) — that is fine; it locks the behavior in.

- [ ] **Step 3: Implement the command changes in `src/commands/rotate.ts`**

Update the import:

```typescript
import { selectParticipants, drawFromBag, insertIntoBag } from '../utils/rotateHelpers';
```

Change `runRoulette`'s signature — replace the `selectionCounts` parameter with a selection callback, and replace the `selectParticipants` call inside the collector:

```typescript
async function runRoulette(
  interaction: ChatInputCommandInteraction,
  participants: string[],
  count: number,
  selectFn: () => string[],
): Promise<string[] | null> {
```

and at the former line 113:

```typescript
const selected = selectFn();
```

In `handleRun`, the call becomes:

```typescript
await runRoulette(interaction, participants, count, () => selectParticipants(participants, count));
```

In `handleTemplateUse`, replace the `runRoulette` call and the persistence block:

```typescript
let updatedBag: string[] = template.bag;
const selected = await runRoulette(interaction, template.participants, count, () => {
  const draw = drawFromBag(template.participants, template.bag, count);
  updatedBag = draw.bag;
  return draw.selected;
});

if (selected) {
  for (const participant of selected) {
    template.selectionCounts[participant] = (template.selectionCounts[participant] ?? 0) + 1;
  }
  await templateStorage.upsertTemplate({ ...template, bag: updatedBag });
}
```

In `handleTemplateAddMember`, the upsert call becomes:

```typescript
await templateStorage.upsertTemplate({
  ...template,
  participants: updated,
  bag: insertIntoBag(template.bag, toAdd),
  updatedAt: new Date(),
});
```

`handleTemplateRemoveMember` needs no change: it passes the template through `upsertTemplate`, whose Task 1 reconciliation already filters removed names out of the bag.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS (all suites).

- [ ] **Step 5: Update README**

In `README.md`, replace the template description sentence:

> Save a reusable participant list as a named template. Templates track selection history and apply weighted selection so less-frequently-chosen participants are more likely to be picked.

with:

> Save a reusable participant list as a named template. Templates use shuffle-bag selection: everyone is drawn exactly once per cycle (like a deck of cards), and the deck is reshuffled when it runs out. Members added mid-cycle join the current deck at a random position. Selection history is also tracked per participant.

- [ ] **Step 6: Manual smoke test (optional but recommended)**

The button/collector flow has no automated tests (pre-existing). If a test Discord server is available: `npm run dev`, then run `/rotate template save`, `/rotate template use` several times through a full cycle and confirm no one repeats within a cycle and `data/facilitator-templates.json` shows a shrinking `bag`.

- [ ] **Step 7: Lint, format, commit**

```bash
npm run lint && npm run format:check
git add src/commands/rotate.ts src/__tests__/rotate.test.ts README.md
git commit -m "feat: use shuffle bag selection for rotate templates

Template use now draws from the persisted bag via drawFromBag and
saves the updated bag after each selection. add-member inserts new
names into the current bag at a random position. Ad-hoc /rotate run
keeps uniform random selection."
```
