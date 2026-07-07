# Rotate Template Race Fixes (PR2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the read-modify-write races on facilitator templates (stale-template clobber during the 5-minute roulette, and the shorter windows in add/remove-member) and guard the roulette Start button against double clicks.

**Architecture:** Add an atomic `updateTemplate(guildId, name, updateFn)` to `FacilitatorTemplateStorage` that loads fresh data, applies the callback, reconciles, and saves — all inside the existing `AsyncMutex`. Handlers move their mutations into the callback so they always operate on fresh state. A pure `applySelectionToTemplate` helper makes the roulette write-back testable. A `selectionStarted` flag in `runRoulette`'s collector ignores duplicate Start clicks.

**Tech Stack:** TypeScript, discord.js v14, Jest (fake timers for the collector test).

**Spec:** `docs/superpowers/specs/2026-07-07-tech-debt-cleanup-design.md` (PR2 section)

## Global Constraints

- Branch: `fix/rotate-template-race` (create from up-to-date `main` before Task 1; commit this plan file on it first).
- TDD: write the failing test first, verify it fails, then implement.
- Not-found error thrown by storage must be exactly: `Template "<name>" not found in this server` (same copy as `deleteTemplate`).
- User-facing copy must not change: all existing reply strings stay byte-identical.
- Commit messages: subject ≤50 chars, no Claude footer / Co-Authored-By.
- Before each commit: `npm run lint` clean, and `npx prettier --check <touched files>` clean (repo-wide `format:check` still fails on pre-existing files — that is PR3's job, ignore it).
- Test-file lint rules: no inline `import('discord.js').X` type annotations; helper functions need explicit return types.

---

### Task 1: Atomic `updateTemplate` in FacilitatorTemplateStorage

**Files:**

- Modify: `src/utils/facilitatorTemplateStorage.ts`
- Test: `src/__tests__/facilitatorTemplateStorage.test.ts` (append a new describe at the end of the top-level `describe('FacilitatorTemplateStorage', ...)`)

**Interfaces:**

- Consumes: existing `AsyncMutex`, `loadTemplates`, `saveTemplates`.
- Produces (Tasks 3 relies on this exact signature):

```ts
async updateTemplate(
  guildId: string,
  name: string,
  updateFn: (template: FacilitatorTemplate) => FacilitatorTemplate,
): Promise<FacilitatorTemplate>
```

Behavior: inside the mutex — load fresh templates; find by guildId+name (missing → throw `Template "<name>" not found in this server`); apply `updateFn` (a throw propagates without saving); reconcile `selectionCounts`/`bag` against the updated `participants`; preserve the stored `id` and `createdAt`; save; return the saved template.

- [ ] **Step 1: Write the failing tests**

The existing test file mocks `fs.promises` (see its top). For update tests we need a stateful mock so reads see prior writes. Append at the end of the top-level describe:

```ts
describe('updateTemplate', () => {
  function statefulFs(initial: FacilitatorTemplate[]): void {
    let fileContent = JSON.stringify(
      initial.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    );
    mockReadFile.mockImplementation(async () => fileContent);
    mockWriteFile.mockImplementation(async (_path, data) => {
      fileContent = data as string;
    });
    mockMkdir.mockResolvedValue(undefined);
  }

  it('applies updateFn changes and persists them', async () => {
    statefulFs([mockTemplate]);

    const result = await storage.updateTemplate('guild123', 'sprint-team', (t) => ({
      ...t,
      selectionCounts: { ...t.selectionCounts, Alice: 1 },
    }));

    expect(result.selectionCounts).toEqual({ Alice: 1 });
    const reloaded = await storage.loadTemplates();
    expect(reloaded[0].selectionCounts).toEqual({ Alice: 1 });
  });

  it('throws when the template does not exist', async () => {
    statefulFs([mockTemplate]);

    await expect(storage.updateTemplate('guild123', 'no-such', (t) => t)).rejects.toThrow(
      'Template "no-such" not found in this server',
    );
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('does not save when updateFn throws', async () => {
    statefulFs([mockTemplate]);

    await expect(
      storage.updateTemplate('guild123', 'sprint-team', () => {
        throw new Error('rejected');
      }),
    ).rejects.toThrow('rejected');
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('reconciles counts and bag against updated participants', async () => {
    statefulFs([
      {
        ...mockTemplate,
        selectionCounts: { Alice: 2, Bob: 1 },
        bag: ['Bob', 'Charlie'],
      },
    ]);

    const result = await storage.updateTemplate('guild123', 'sprint-team', (t) => ({
      ...t,
      participants: t.participants.filter((p) => p !== 'Bob'),
    }));

    expect(result.participants).toEqual(['Alice', 'Charlie']);
    expect(result.selectionCounts).toEqual({ Alice: 2 });
    expect(result.bag).toEqual(['Charlie']);
  });

  it('preserves id and createdAt even if updateFn changes them', async () => {
    statefulFs([mockTemplate]);

    const result = await storage.updateTemplate('guild123', 'sprint-team', (t) => ({
      ...t,
      id: 'forged-id',
      createdAt: new Date('2030-01-01T00:00:00.000Z'),
    }));

    expect(result.id).toBe('test-id-1');
    expect(result.createdAt).toEqual(mockTemplate.createdAt);
  });

  it('serializes concurrent updates so both changes land', async () => {
    statefulFs([mockTemplate]);

    await Promise.all([
      storage.updateTemplate('guild123', 'sprint-team', (t) => ({
        ...t,
        selectionCounts: { ...t.selectionCounts, Alice: (t.selectionCounts.Alice ?? 0) + 1 },
      })),
      storage.updateTemplate('guild123', 'sprint-team', (t) => ({
        ...t,
        selectionCounts: { ...t.selectionCounts, Bob: (t.selectionCounts.Bob ?? 0) + 1 },
      })),
    ]);

    const reloaded = await storage.loadTemplates();
    expect(reloaded[0].selectionCounts).toEqual({ Alice: 1, Bob: 1 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern=facilitatorTemplateStorage`
Expected: FAIL — `storage.updateTemplate is not a function` (TS compile error).

- [ ] **Step 3: Implement**

In `src/utils/facilitatorTemplateStorage.ts`:

3a. Extract the reconcile logic (currently inline in `upsertTemplate`) into a private helper, and use it in both places:

```ts
private reconcile(template: FacilitatorTemplate): FacilitatorTemplate {
  const validNames = new Set(template.participants);
  const reconciledCounts: { [name: string]: number } = {};
  for (const name of Object.keys(template.selectionCounts)) {
    if (validNames.has(name)) {
      reconciledCounts[name] = template.selectionCounts[name];
    }
  }
  return {
    ...template,
    selectionCounts: reconciledCounts,
    bag: template.bag.filter((name) => validNames.has(name)),
  };
}
```

`upsertTemplate` becomes:

```ts
async upsertTemplate(template: FacilitatorTemplate): Promise<void> {
  return this.mutex.run(async () => {
    const reconciledTemplate = this.reconcile(template);

    const templates = await this.loadTemplates();
    const existingIndex = templates.findIndex(
      (t) => t.guildId === reconciledTemplate.guildId && t.name === reconciledTemplate.name,
    );

    if (existingIndex === -1) {
      templates.push(reconciledTemplate);
    } else {
      templates[existingIndex] = {
        ...reconciledTemplate,
        id: templates[existingIndex].id,
        createdAt: templates[existingIndex].createdAt,
      };
    }

    await this.saveTemplates(templates);
  });
}
```

3b. Add `updateTemplate` (after `upsertTemplate`):

```ts
async updateTemplate(
  guildId: string,
  name: string,
  updateFn: (template: FacilitatorTemplate) => FacilitatorTemplate,
): Promise<FacilitatorTemplate> {
  return this.mutex.run(async () => {
    const templates = await this.loadTemplates();
    const index = templates.findIndex((t) => t.guildId === guildId && t.name === name);

    if (index === -1) {
      throw new Error(`Template "${name}" not found in this server`);
    }

    const updated = this.reconcile({
      ...updateFn(templates[index]),
      id: templates[index].id,
      createdAt: templates[index].createdAt,
    });

    templates[index] = updated;
    await this.saveTemplates(templates);
    return updated;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern=facilitatorTemplateStorage`
Expected: PASS (all, including pre-existing upsert/delete tests — the reconcile extraction must not change behavior).

- [ ] **Step 5: Lint, format, commit**

Run: `npm run lint && npx prettier --check src/utils/facilitatorTemplateStorage.ts src/__tests__/facilitatorTemplateStorage.test.ts`
Expected: clean (run `npx prettier --write` on those files if not).

```bash
git add src/utils/facilitatorTemplateStorage.ts src/__tests__/facilitatorTemplateStorage.test.ts
git commit -m "feat: add atomic updateTemplate to storage"
```

---

### Task 2: `applySelectionToTemplate` pure helper

**Files:**

- Modify: `src/utils/rotateHelpers.ts` (append; also add the type import at the top)
- Test: `src/__tests__/rotateHelpers.test.ts` (append)

**Interfaces:**

- Consumes: `FacilitatorTemplate` from `../models/facilitatorTemplate`.
- Produces (Task 3 relies on this exact signature):

```ts
export function applySelectionToTemplate(
  template: FacilitatorTemplate,
  selected: string[],
  bag: string[],
): FacilitatorTemplate;
```

Behavior: returns a copy of `template` with `selectionCounts` incremented by 1 for each name in `selected` (missing names start at 0), `bag` replaced by the given `bag`, and `updatedAt` set to now. Does not mutate the input. This is the roulette write-back applied to a FRESH template inside `updateTemplate` — participants added mid-roulette survive because everything else on the fresh template is kept as-is.

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/rotateHelpers.test.ts`. Add to the import at the top:

```ts
import {
  shuffle,
  drawFromBag,
  insertIntoBag,
  buildTemplateStats,
  applySelectionToTemplate,
} from '../utils/rotateHelpers';
import type { FacilitatorTemplate } from '../models/facilitatorTemplate';
```

```ts
describe('applySelectionToTemplate', () => {
  const base: FacilitatorTemplate = {
    id: 'id-1',
    guildId: 'guild-1',
    name: 'Team',
    participants: ['Alice', 'Bob', 'Charlie'],
    selectionCounts: { Alice: 2 },
    bag: ['Bob', 'Charlie'],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  test('increments counts for selected and replaces the bag', () => {
    const result = applySelectionToTemplate(base, ['Alice', 'Bob'], ['Charlie']);
    expect(result.selectionCounts).toEqual({ Alice: 3, Bob: 1 });
    expect(result.bag).toEqual(['Charlie']);
  });

  test('keeps fresh participants untouched (mid-roulette add survives)', () => {
    const fresh = { ...base, participants: ['Alice', 'Bob', 'Charlie', 'Dave'] };
    const result = applySelectionToTemplate(fresh, ['Alice'], ['Bob']);
    expect(result.participants).toEqual(['Alice', 'Bob', 'Charlie', 'Dave']);
  });

  test('bumps updatedAt and does not mutate the input', () => {
    const before = base.updatedAt.getTime();
    const result = applySelectionToTemplate(base, ['Bob'], []);
    expect(result.updatedAt.getTime()).toBeGreaterThan(before);
    expect(base.selectionCounts).toEqual({ Alice: 2 });
    expect(base.bag).toEqual(['Bob', 'Charlie']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern=rotateHelpers`
Expected: FAIL — `applySelectionToTemplate` is not exported.

- [ ] **Step 3: Implement**

Append to `src/utils/rotateHelpers.ts` (add the type import at the top of the file):

```ts
import type { FacilitatorTemplate } from '../models/facilitatorTemplate';
```

```ts
export function applySelectionToTemplate(
  template: FacilitatorTemplate,
  selected: string[],
  bag: string[],
): FacilitatorTemplate {
  const selectionCounts = { ...template.selectionCounts };
  for (const participant of selected) {
    selectionCounts[participant] = (selectionCounts[participant] ?? 0) + 1;
  }
  return { ...template, selectionCounts, bag, updatedAt: new Date() };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern=rotateHelpers`
Expected: PASS.

- [ ] **Step 5: Lint, format, commit**

Run: `npm run lint && npx prettier --check src/utils/rotateHelpers.ts src/__tests__/rotateHelpers.test.ts`

```bash
git add src/utils/rotateHelpers.ts src/__tests__/rotateHelpers.test.ts
git commit -m "feat: add applySelectionToTemplate helper"
```

---

### Task 3: Migrate use / add-member / remove-member handlers to `updateTemplate`

**Files:**

- Modify: `src/commands/rotate.ts` (`handleTemplateUse`, `handleTemplateAddMember`, `handleTemplateRemoveMember`, imports, new error class)
- Test: `src/__tests__/rotate.test.ts` (rewrite the storage mocking in the add-member / remove-member describes)

**Interfaces:**

- Consumes: `updateTemplate` (Task 1 signature), `applySelectionToTemplate` (Task 2 signature), existing `insertIntoBag`, `parseParticipants`, `safeReply`, `logger`.
- Produces: no new exports. All user-facing copy unchanged.

Design notes for this task:

- A module-private `class TemplateUpdateRejected extends Error {}` in `rotate.ts` distinguishes business-rule rejections (thrown inside the callback, message IS the user-facing reply) from the storage's not-found error (mapped to the existing not-found copy).
- `handleTemplateUse` keeps its up-front reads (they only gate the roulette start); only the post-roulette write-back becomes atomic. A failure there (e.g. template deleted mid-roulette) is logged, not surfaced — the selection was already displayed.

- [ ] **Step 1: Rewrite the affected tests (failing first)**

In `src/__tests__/rotate.test.ts`, add near the top (after the existing imports):

```ts
import type { FacilitatorTemplate } from '../models/facilitatorTemplate';
```

Inside `describe('Rotate Command', ...)` add one shared helper (place it before the add-member describe, with an explicit return type per lint rules):

```ts
function mockUpdateTemplateWith(template: FacilitatorTemplate | undefined): jest.SpyInstance {
  return jest
    .spyOn(FacilitatorTemplateStorage.prototype, 'updateTemplate')
    .mockImplementation(
      async (
        _guildId: string,
        name: string,
        fn: (t: FacilitatorTemplate) => FacilitatorTemplate,
      ) => {
        if (!template) {
          throw new Error(`Template "${name}" not found in this server`);
        }
        return fn(template);
      },
    );
}
```

Then rewrite these tests (same names, new bodies). In the add-member describe:

```ts
test('replies with error when template not found', async () => {
  mockUpdateTemplateWith(undefined);

  const interaction = makeAddMemberInteraction('NoSuchTemplate', 'Dave');
  await command.execute(interaction);

  expect(interaction.reply).toHaveBeenCalledWith(
    expect.objectContaining({
      content:
        'Template **NoSuchTemplate** not found. Use `/rotate template list` to see available templates.',
    }),
  );
  jest.restoreAllMocks();
});

test('adds members to existing template and replies with count', async () => {
  const template: FacilitatorTemplate = {
    id: 'uuid-1',
    guildId: 'guild-1',
    name: 'Team',
    participants: ['Alice', 'Bob'],
    selectionCounts: { Alice: 2 },
    bag: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const updateSpy = mockUpdateTemplateWith(template);

  const interaction = makeAddMemberInteraction('Team', 'Charlie, Dave');
  await command.execute(interaction);

  const result = await updateSpy.mock.results[0].value;
  expect(result.participants).toEqual(['Alice', 'Bob', 'Charlie', 'Dave']);
  expect(interaction.reply).toHaveBeenCalledWith(
    expect.objectContaining({
      content: 'Added 2 member(s) to **Team**. Now has 4 participant(s).',
    }),
  );
  jest.restoreAllMocks();
});

test('deduplicates members already in template', async () => {
  const template: FacilitatorTemplate = {
    id: 'uuid-1',
    guildId: 'guild-1',
    name: 'Team',
    participants: ['Alice', 'Bob'],
    selectionCounts: {},
    bag: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const updateSpy = mockUpdateTemplateWith(template);

  const interaction = makeAddMemberInteraction('Team', 'Alice, Charlie');
  await command.execute(interaction);

  const result = await updateSpy.mock.results[0].value;
  expect(result.participants).toEqual(['Alice', 'Bob', 'Charlie']);
  expect(interaction.reply).toHaveBeenCalledWith(
    expect.objectContaining({
      content: 'Added 1 member(s) to **Team**. Now has 3 participant(s).',
    }),
  );
  jest.restoreAllMocks();
});

test('replies with error when adding would exceed 50 participants', async () => {
  const template: FacilitatorTemplate = {
    id: 'uuid-1',
    guildId: 'guild-1',
    name: 'BigTeam',
    participants: Array.from({ length: 49 }, (_, i) => `Person${i}`),
    selectionCounts: {},
    bag: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  mockUpdateTemplateWith(template);

  const interaction = makeAddMemberInteraction('BigTeam', 'NewA, NewB, NewC');
  await command.execute(interaction);

  expect(interaction.reply).toHaveBeenCalledWith(
    expect.objectContaining({
      content: 'Cannot add: would exceed the 50-participant limit (currently 49, adding 3).',
    }),
  );
  jest.restoreAllMocks();
});

test('replies with error when members input is empty', async () => {
  const updateSpy = mockUpdateTemplateWith(undefined);

  const interaction = makeAddMemberInteraction('Team', ', , ,');
  await command.execute(interaction);

  expect(updateSpy).not.toHaveBeenCalled();
  expect(interaction.reply).toHaveBeenCalledWith(
    expect.objectContaining({
      content: 'Please provide at least one member name.',
    }),
  );
  jest.restoreAllMocks();
});

test('replies with message when all specified members already exist', async () => {
  const template: FacilitatorTemplate = {
    id: 'uuid-1',
    guildId: 'guild-1',
    name: 'Team',
    participants: ['Alice', 'Bob'],
    selectionCounts: {},
    bag: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  mockUpdateTemplateWith(template);

  const interaction = makeAddMemberInteraction('Team', 'Alice, Bob');
  await command.execute(interaction);

  expect(interaction.reply).toHaveBeenCalledWith(
    expect.objectContaining({
      content: 'All specified member(s) are already in **Team**.',
    }),
  );
  jest.restoreAllMocks();
});

test('add-member inserts new members into a non-empty bag', async () => {
  const template: FacilitatorTemplate = {
    id: 'uuid-1',
    guildId: 'guild-1',
    name: 'Team',
    participants: ['Alice', 'Bob'],
    selectionCounts: {},
    bag: ['Bob'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const updateSpy = mockUpdateTemplateWith(template);

  const interaction = makeAddMemberInteraction('Team', 'Charlie');
  await command.execute(interaction);

  const result = await updateSpy.mock.results[0].value;
  expect(result.bag).toHaveLength(2);
  expect(result.bag).toContain('Bob');
  expect(result.bag).toContain('Charlie');
  jest.restoreAllMocks();
});
```

In the remove-member describe, rewrite likewise:

```ts
test('replies with error when template not found', async () => {
  mockUpdateTemplateWith(undefined);

  const interaction = makeRemoveMemberInteraction('NoSuchTemplate', 'Alice');
  await command.execute(interaction);

  expect(interaction.reply).toHaveBeenCalledWith(
    expect.objectContaining({
      content:
        'Template **NoSuchTemplate** not found. Use `/rotate template list` to see available templates.',
    }),
  );
  jest.restoreAllMocks();
});

test('replies with error listing members not found in template', async () => {
  const template: FacilitatorTemplate = {
    id: 'uuid-1',
    guildId: 'guild-1',
    name: 'Team',
    participants: ['Alice', 'Bob'],
    selectionCounts: {},
    bag: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  mockUpdateTemplateWith(template);

  const interaction = makeRemoveMemberInteraction('Team', 'Charlie, Dave');
  await command.execute(interaction);

  expect(interaction.reply).toHaveBeenCalledWith(
    expect.objectContaining({
      content: 'The following member(s) are not in template **Team**: Charlie, Dave',
    }),
  );
  jest.restoreAllMocks();
});

test('replies with error when removal would leave 0 participants', async () => {
  const template: FacilitatorTemplate = {
    id: 'uuid-1',
    guildId: 'guild-1',
    name: 'Team',
    participants: ['Alice'],
    selectionCounts: { Alice: 3 },
    bag: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  mockUpdateTemplateWith(template);

  const interaction = makeRemoveMemberInteraction('Team', 'Alice');
  await command.execute(interaction);

  expect(interaction.reply).toHaveBeenCalledWith(
    expect.objectContaining({
      content: 'Cannot remove: template must have at least 1 participant.',
    }),
  );
  jest.restoreAllMocks();
});

test('removes members from template and replies with count', async () => {
  const template: FacilitatorTemplate = {
    id: 'uuid-1',
    guildId: 'guild-1',
    name: 'Team',
    participants: ['Alice', 'Bob', 'Charlie'],
    selectionCounts: { Alice: 1, Bob: 2, Charlie: 3 },
    bag: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const updateSpy = mockUpdateTemplateWith(template);

  const interaction = makeRemoveMemberInteraction('Team', 'Bob, Charlie');
  await command.execute(interaction);

  const result = await updateSpy.mock.results[0].value;
  expect(result.participants).toEqual(['Alice']);
  expect(interaction.reply).toHaveBeenCalledWith(
    expect.objectContaining({
      content: 'Removed 2 member(s) from **Team**. Now has 1 participant(s).',
    }),
  );
  jest.restoreAllMocks();
});

test('replies with error when members input is empty', async () => {
  const updateSpy = mockUpdateTemplateWith(undefined);

  const interaction = makeRemoveMemberInteraction('Team', ', , ,');
  await command.execute(interaction);

  expect(updateSpy).not.toHaveBeenCalled();
  expect(interaction.reply).toHaveBeenCalledWith(
    expect.objectContaining({
      content: 'Please provide at least one member name.',
    }),
  );
  jest.restoreAllMocks();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern='rotate\.test'`
Expected: FAIL — the rewritten tests fail because the handlers still call `getTemplateByName` + `upsertTemplate` (updateTemplate mock never invoked; `mock.results[0]` undefined).

- [ ] **Step 3: Migrate the handlers**

In `src/commands/rotate.ts`:

3a. Update the helper import:

```ts
import {
  selectParticipants,
  drawFromBag,
  insertIntoBag,
  buildTemplateStats,
  applySelectionToTemplate,
} from '../utils/rotateHelpers';
```

3b. Add after the `parseParticipants` function:

```ts
class TemplateUpdateRejected extends Error {}
```

3c. In `handleTemplateUse`, replace the `if (selected) { ... }` block at the end with:

```ts
if (selected) {
  try {
    await templateStorage.updateTemplate(interaction.guildId!, name, (fresh) =>
      applySelectionToTemplate(fresh, selected, updatedBag),
    );
  } catch (error) {
    // template was deleted mid-roulette; the result is already displayed
    logger.error('Failed to persist selection results:', error);
  }
}
```

3d. Replace `handleTemplateAddMember` entirely:

```ts
async function handleTemplateAddMember(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('name', true).trim();
  const membersInput = interaction.options.getString('members', true);
  const newMembers = parseParticipants(membersInput);

  if (newMembers.length === 0) {
    await safeReply(interaction, 'Please provide at least one member name.');
    return;
  }

  let addedCount = 0;
  try {
    const updated = await templateStorage.updateTemplate(interaction.guildId!, name, (fresh) => {
      const existing = new Set(fresh.participants);
      const toAdd = newMembers.filter((m) => !existing.has(m));

      if (toAdd.length === 0) {
        throw new TemplateUpdateRejected(`All specified member(s) are already in **${name}**.`);
      }

      if (fresh.participants.length + toAdd.length > 50) {
        throw new TemplateUpdateRejected(
          `Cannot add: would exceed the 50-participant limit (currently ${fresh.participants.length}, adding ${toAdd.length}).`,
        );
      }

      addedCount = toAdd.length;
      return {
        ...fresh,
        participants: [...fresh.participants, ...toAdd],
        bag: insertIntoBag(fresh.bag, toAdd),
        updatedAt: new Date(),
      };
    });

    await safeReply(
      interaction,
      `Added ${addedCount} member(s) to **${name}**. Now has ${updated.participants.length} participant(s).`,
    );
  } catch (error) {
    await replyTemplateUpdateError(interaction, name, error);
  }
}
```

3e. Replace `handleTemplateRemoveMember` entirely:

```ts
async function handleTemplateRemoveMember(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('name', true).trim();
  const membersInput = interaction.options.getString('members', true);
  const toRemove = parseParticipants(membersInput);

  if (toRemove.length === 0) {
    await safeReply(interaction, 'Please provide at least one member name.');
    return;
  }

  try {
    const updated = await templateStorage.updateTemplate(interaction.guildId!, name, (fresh) => {
      const existing = new Set(fresh.participants);
      const missing = toRemove.filter((m) => !existing.has(m));
      if (missing.length > 0) {
        throw new TemplateUpdateRejected(
          `The following member(s) are not in template **${name}**: ${missing.join(', ')}`,
        );
      }

      const removeSet = new Set(toRemove);
      const remaining = fresh.participants.filter((p) => !removeSet.has(p));
      if (remaining.length === 0) {
        throw new TemplateUpdateRejected(
          'Cannot remove: template must have at least 1 participant.',
        );
      }

      return { ...fresh, participants: remaining, updatedAt: new Date() };
    });

    await safeReply(
      interaction,
      `Removed ${toRemove.length} member(s) from **${name}**. Now has ${updated.participants.length} participant(s).`,
    );
  } catch (error) {
    await replyTemplateUpdateError(interaction, name, error);
  }
}
```

3f. Add the shared error-reply helper (after `handleTemplateRemoveMember`):

```ts
async function replyTemplateUpdateError(
  interaction: ChatInputCommandInteraction,
  name: string,
  error: unknown,
): Promise<void> {
  if (error instanceof TemplateUpdateRejected) {
    await safeReply(interaction, error.message);
    return;
  }
  if (error instanceof Error && error.message === `Template "${name}" not found in this server`) {
    await safeReply(
      interaction,
      `Template **${name}** not found. Use \`/rotate template list\` to see available templates.`,
    );
    return;
  }
  throw error;
}
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS. (The pre-existing add/remove tests were rewritten in Step 1; nothing else asserts on `upsertTemplate` for these two handlers.)

- [ ] **Step 5: Lint, format, commit**

Run: `npm run lint && npx prettier --check src/commands/rotate.ts src/__tests__/rotate.test.ts`

```bash
git add src/commands/rotate.ts src/__tests__/rotate.test.ts
git commit -m "fix: make template mutations atomic"
```

---

### Task 4: Double-click guard in runRoulette

**Files:**

- Modify: `src/commands/rotate.ts` (`runRoulette` collector)
- Test: `src/__tests__/rotate.test.ts` (append a new describe inside `describe('Rotate Command', ...)`)

**Interfaces:**

- Consumes: nothing new.
- Produces: no new exports; behavioral change only (duplicate Start clicks ignored).

- [ ] **Step 1: Write the failing test**

Append inside `describe('Rotate Command', ...)`:

```ts
describe('roulette double-click guard', () => {
  test('second start_selection click is ignored', async () => {
    jest.useFakeTimers();
    try {
      const handlers: { [event: string]: (arg: unknown) => Promise<void> } = {};
      const collector = {
        on: jest.fn((event: string, cb: (arg: unknown) => Promise<void>) => {
          handlers[event] = cb;
        }),
        stop: jest.fn(),
      };
      const message = { createMessageComponentCollector: jest.fn(() => collector) };
      const interaction = {
        guildId: 'guild-1',
        replied: false,
        deferred: false,
        reply: jest.fn().mockResolvedValue(message),
        editReply: jest.fn().mockResolvedValue(undefined),
        followUp: jest.fn(),
        options: {
          getSubcommandGroup: () => null,
          getSubcommand: () => 'run',
          getString: () => 'Alice, Bob, Charlie',
          getInteger: () => 1,
        },
      } as unknown as ChatInputCommandInteraction;

      const executePromise = command.execute(interaction);
      await jest.advanceTimersByTimeAsync(0);
      expect(handlers.collect).toBeDefined();

      const makeClick = (): { customId: string; update: jest.Mock; deferUpdate: jest.Mock } => ({
        customId: 'start_selection',
        update: jest.fn().mockResolvedValue(undefined),
        deferUpdate: jest.fn().mockResolvedValue(undefined),
      });
      const first = makeClick();
      const second = makeClick();

      const p1 = handlers.collect(first);
      const p2 = handlers.collect(second);
      await jest.advanceTimersByTimeAsync(0);

      expect(first.update).toHaveBeenCalledTimes(1);
      expect(second.update).not.toHaveBeenCalled();
      expect(second.deferUpdate).toHaveBeenCalledTimes(1);

      // drain the 10 × 500ms spin so the roulette promise resolves
      await jest.advanceTimersByTimeAsync(10000);
      await p1;
      await p2;
      await executePromise;
    } finally {
      jest.useRealTimers();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --testPathPattern='rotate\.test' -t 'double-click'`
Expected: FAIL — `second.update` HAS been called (no guard yet), or `second.deferUpdate` not called.

- [ ] **Step 3: Implement the guard**

In `runRoulette` (src/commands/rotate.ts), inside the returned Promise:

```ts
return new Promise<string[] | null>((resolve) => {
  let selectionMade = false;
  let selectionStarted = false;
```

and at the top of the `start_selection` branch — the flag MUST be set before the first `await` so a burst of clicks can't all pass the check:

```ts
if (i.customId === 'start_selection') {
  if (selectionStarted) {
    await i.deferUpdate();
    return;
  }
  selectionStarted = true;
  // ...existing disabledRow / i.update / spin code unchanged
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS, including the new guard test.

- [ ] **Step 5: Lint, format, commit**

Run: `npm run lint && npx prettier --check src/commands/rotate.ts src/__tests__/rotate.test.ts`

```bash
git add src/commands/rotate.ts src/__tests__/rotate.test.ts
git commit -m "fix: ignore duplicate roulette start clicks"
```
