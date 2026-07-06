# `/rotate template stats` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/rotate template stats` subcommand that displays per-member selection counts and the remaining members in the current shuffle-bag cycle.

**Architecture:** A pure function `buildTemplateStats` in `src/utils/rotateHelpers.ts` computes the stats from a template's `participants`, `selectionCounts`, and `bag`. A thin handler in `src/commands/rotate.ts` fetches the template, calls the helper, and renders a Discord embed. This mirrors the existing `drawFromBag` + thin-handler pattern.

**Tech Stack:** TypeScript, discord.js v14, Jest.

**Spec:** `docs/superpowers/specs/2026-07-07-rotate-template-stats-design.md`

## Global Constraints

- Branch: `feature/rotate-template-stats` (already exists, spec committed).
- Commit messages: subject ≤50 chars, blank line, body wrapped at 72 chars. No Claude footer.
- TDD: write the failing test first, verify it fails, then implement.
- All bot-facing copy is English, matching existing output tone.
- Run `npm run lint` and `npm run format:check` before each commit.
- After the feature ships, `npm run deploy` must be run once to register the new subcommand with Discord (manual, not part of this plan's tasks).

---

### Task 1: `buildTemplateStats` pure function

**Files:**
- Modify: `src/utils/rotateHelpers.ts` (append at end of file)
- Test: `src/__tests__/rotateHelpers.test.ts` (append at end of file)

**Interfaces:**
- Consumes: nothing new (standalone pure function).
- Produces (Task 2 relies on these exact names):

```ts
export interface TemplateStatsEntry {
  name: string; // participant name
  count: number; // selectionCounts[name] ?? 0
  inBag: boolean; // still drawable in the current cycle
}

export function buildTemplateStats(
  participants: string[],
  selectionCounts: { [name: string]: number },
  bag: string[],
): TemplateStatsEntry[];
```

Behavior: one entry per participant, sorted by `count` descending; ties keep `participants` order (Array.prototype.sort is stable). `inBag` is `true` for everyone when the bag holds no valid participant names (fresh cycle); otherwise `true` only for names present in the bag. Bag names not in `participants` are ignored.

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/rotateHelpers.test.ts`. Also add `buildTemplateStats` to the import at the top of the file:

```ts
import { shuffle, drawFromBag, insertIntoBag, buildTemplateStats } from '../utils/rotateHelpers';
```

```ts
describe('buildTemplateStats', () => {
  test('participants missing from selectionCounts default to count 0', () => {
    const result = buildTemplateStats(['Alice', 'Bob'], { Alice: 2 }, []);
    expect(result.find((e) => e.name === 'Bob')?.count).toBe(0);
  });

  test('sorts by count descending, ties keep participants order', () => {
    const result = buildTemplateStats(
      ['Alice', 'Bob', 'Carol', 'Dave'],
      { Bob: 3, Alice: 1, Dave: 1 },
      [],
    );
    expect(result.map((e) => e.name)).toEqual(['Bob', 'Alice', 'Dave', 'Carol']);
    expect(result.map((e) => e.count)).toEqual([3, 1, 1, 0]);
  });

  test('empty bag marks everyone as inBag', () => {
    const result = buildTemplateStats(['Alice', 'Bob'], {}, []);
    expect(result.every((e) => e.inBag)).toBe(true);
  });

  test('non-empty bag marks only bag members as inBag', () => {
    const result = buildTemplateStats(['Alice', 'Bob', 'Carol'], {}, ['Bob', 'Carol']);
    expect(result.find((e) => e.name === 'Alice')?.inBag).toBe(false);
    expect(result.find((e) => e.name === 'Bob')?.inBag).toBe(true);
    expect(result.find((e) => e.name === 'Carol')?.inBag).toBe(true);
  });

  test('bag names not in participants are ignored', () => {
    // bag contains only a ghost → no valid names → treated as a fresh cycle
    const result = buildTemplateStats(['Alice', 'Bob'], {}, ['Ghost']);
    expect(result.every((e) => e.inBag)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern=rotateHelpers`
Expected: FAIL — `buildTemplateStats` is not exported ("is not a function" or TS compile error).

- [ ] **Step 3: Write minimal implementation**

Append to `src/utils/rotateHelpers.ts`:

```ts
export interface TemplateStatsEntry {
  name: string;
  count: number;
  inBag: boolean;
}

export function buildTemplateStats(
  participants: string[],
  selectionCounts: { [name: string]: number },
  bag: string[],
): TemplateStatsEntry[] {
  const validNames = new Set(participants);
  const validBag = new Set(bag.filter((name) => validNames.has(name)));
  // no valid names in the bag means a fresh cycle: everyone is drawable
  const everyoneRemains = validBag.size === 0;

  const entries = participants.map((name) => ({
    name,
    count: selectionCounts[name] ?? 0,
    inBag: everyoneRemains || validBag.has(name),
  }));

  return entries.sort((a, b) => b.count - a.count);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern=rotateHelpers`
Expected: PASS (all tests, including pre-existing ones).

- [ ] **Step 5: Lint, format check, commit**

Run: `npm run lint && npm run format:check`
Expected: no errors. If format:check fails, run `npm run format` and re-check.

```bash
git add src/utils/rotateHelpers.ts src/__tests__/rotateHelpers.test.ts
git commit -m "feat: add buildTemplateStats helper"
```

---

### Task 2: `stats` subcommand and handler

**Files:**
- Modify: `src/commands/rotate.ts` (builder chain, execute dispatch, new handler)
- Test: `src/__tests__/rotate.test.ts` (append at end of the top-level describe)

**Interfaces:**
- Consumes: `buildTemplateStats` and `TemplateStatsEntry` from `../utils/rotateHelpers` (Task 1), existing `templateStorage.getTemplateByName`, existing `safeReply`.
- Produces: user-facing `/rotate template stats` subcommand. No downstream task consumes this.

- [ ] **Step 1: Write the failing tests**

Append inside `describe('Rotate Command', ...)` in `src/__tests__/rotate.test.ts`:

```ts
describe('template stats subcommand', () => {
  function getStatsSubcommand() {
    const commandData = command.data.toJSON();
    const templateGroup = commandData.options?.find((o) => o.name === 'template') as
      | {
          options?: {
            name: string;
            options?: { name: string; required?: boolean; autocomplete?: boolean }[];
          }[];
        }
      | undefined;
    return templateGroup?.options?.find((o) => o.name === 'stats');
  }

  test('stats subcommand exists in template group', () => {
    expect(getStatsSubcommand()).toBeDefined();
  });

  test('stats has required name option with autocomplete', () => {
    const sub = getStatsSubcommand() as
      | { options?: { name: string; required?: boolean; autocomplete?: boolean }[] }
      | undefined;
    const nameOpt = sub?.options?.find((o) => o.name === 'name');
    expect(nameOpt).toBeDefined();
    expect(nameOpt?.required).toBe(true);
    expect(nameOpt?.autocomplete).toBe(true);
  });

  function makeStatsInteraction(templateName: string) {
    const reply = jest.fn().mockResolvedValue(undefined);
    return {
      guildId: 'guild-1',
      replied: false,
      deferred: false,
      reply,
      followUp: jest.fn(),
      options: {
        getSubcommandGroup: () => 'template',
        getSubcommand: () => 'stats',
        getString: () => templateName,
      },
    } as unknown as import('discord.js').ChatInputCommandInteraction;
  }

  test('replies with error when template not found', async () => {
    jest
      .spyOn(FacilitatorTemplateStorage.prototype, 'getTemplateByName')
      .mockResolvedValue(undefined);

    const interaction = makeStatsInteraction('NoSuchTemplate');
    await command.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content:
          'Template **NoSuchTemplate** not found. Use `/rotate template list` to see available templates.',
      }),
    );
    jest.restoreAllMocks();
  });

  test('replies with embed showing counts sorted desc and remaining members', async () => {
    const template = {
      id: 'uuid-1',
      guildId: 'guild-1',
      name: 'Team',
      participants: ['Alice', 'Bob', 'Carol'],
      selectionCounts: { Alice: 1, Bob: 3 },
      bag: ['Alice', 'Carol'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    jest
      .spyOn(FacilitatorTemplateStorage.prototype, 'getTemplateByName')
      .mockResolvedValue(template);

    const interaction = makeStatsInteraction('Team');
    await command.execute(interaction);

    const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0] as {
      embeds: { toJSON: () => { title?: string; description?: string; fields?: { name: string; value: string }[]; footer?: { text: string } } }[];
    };
    const embed = replyArg.embeds[0].toJSON();
    expect(embed.title).toBe('Template Stats: Team');
    expect(embed.description).toBe('Bob: 3\nAlice: 1\nCarol: 0');
    expect(embed.fields?.[0].name).toBe('Remaining in current cycle');
    expect(embed.fields?.[0].value).toBe('Alice, Carol');
    expect(embed.footer?.text).toBe('3 participants');
    jest.restoreAllMocks();
  });

  test('empty bag lists everyone as remaining', async () => {
    const template = {
      id: 'uuid-1',
      guildId: 'guild-1',
      name: 'Team',
      participants: ['Alice', 'Bob'],
      selectionCounts: {},
      bag: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    jest
      .spyOn(FacilitatorTemplateStorage.prototype, 'getTemplateByName')
      .mockResolvedValue(template);

    const interaction = makeStatsInteraction('Team');
    await command.execute(interaction);

    const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0] as {
      embeds: { toJSON: () => { fields?: { name: string; value: string }[] } }[];
    };
    const embed = replyArg.embeds[0].toJSON();
    expect(embed.fields?.[0].value).toBe('Alice, Bob');
    jest.restoreAllMocks();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern='rotate\.test'`
Expected: FAIL — `stats subcommand exists in template group` fails (subcommand undefined), the interaction tests fail (execute falls through without replying for `stats`).

- [ ] **Step 3: Implement subcommand, dispatch, and handler**

In `src/commands/rotate.ts`, three edits.

3a. Update the helper import:

```ts
import {
  selectParticipants,
  drawFromBag,
  insertIntoBag,
  buildTemplateStats,
} from '../utils/rotateHelpers';
```

3b. In the `template` subcommand group builder, after the `remove-member` subcommand, add:

```ts
.addSubcommand((subcommand) =>
  subcommand
    .setName('stats')
    .setDescription('Show selection counts and remaining members for a template')
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('Template name')
        .setRequired(true)
        .setAutocomplete(true),
    ),
)
```

3c. In `execute`, extend the template dispatch chain:

```ts
} else if (subcommand === 'remove-member') {
  await handleTemplateRemoveMember(interaction);
} else if (subcommand === 'stats') {
  await handleTemplateStats(interaction);
}
```

3d. Add the handler (after `handleTemplateRemoveMember`):

```ts
async function handleTemplateStats(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('name', true).trim();
  const template = await templateStorage.getTemplateByName(interaction.guildId!, name);

  if (!template) {
    await safeReply(
      interaction,
      `Template **${name}** not found. Use \`/rotate template list\` to see available templates.`,
    );
    return;
  }

  const stats = buildTemplateStats(template.participants, template.selectionCounts, template.bag);
  const countLines = stats.map((s) => `${s.name}: ${s.count}`).join('\n');
  const remaining = stats
    .filter((s) => s.inBag)
    .map((s) => s.name)
    .join(', ');
  const participantCount = template.participants.length;

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(`Template Stats: ${template.name}`)
    .setDescription(countLines)
    .addFields({ name: 'Remaining in current cycle', value: remaining, inline: false })
    .setTimestamp()
    .setFooter({
      text: `${participantCount} ${participantCount === 1 ? 'participant' : 'participants'}`,
    });

  await interaction.reply({ embeds: [embed] });
}
```

Note: `remaining` is never empty — `buildTemplateStats` marks everyone `inBag` when the bag holds no valid names, and templates always have ≥1 participant.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS (all suites).

- [ ] **Step 5: Lint, format check, commit**

Run: `npm run lint && npm run format:check`
Expected: no errors. If format:check fails, run `npm run format` and re-check.

```bash
git add src/commands/rotate.ts src/__tests__/rotate.test.ts
git commit -m "feat: add /rotate template stats subcommand"
```
