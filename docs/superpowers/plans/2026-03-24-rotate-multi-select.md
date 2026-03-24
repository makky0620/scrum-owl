# `/rotate` Multi-Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the `/facilitator` command to `/rotate` and add an optional `count` integer parameter that selects multiple people at random (default 1).

**Architecture:** Rename `src/commands/facilitator.ts` to `rotate.ts`, update the command builder and all UI strings in place, then extend `runRoulette()` to accept a `count` argument and produce a numbered-list embed when count > 1. The `selectParticipants` pure function lives in a new `src/utils/rotateHelpers.ts` to avoid mixing `export function` with the existing `module.exports = command` pattern. Storage layer (`FacilitatorTemplateStorage`) is unchanged.

**Tech Stack:** TypeScript, discord.js v14, Jest

**Spec:** `docs/superpowers/specs/2026-03-24-rotate-multi-select-design.md`

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `src/commands/facilitator.ts` | Rename → `rotate.ts` | Command name, UI strings, count param, safeReply migration |
| `src/utils/rotateHelpers.ts` | Create | Exports `selectParticipants` pure function |
| `src/__tests__/facilitator.test.ts` | Rename → `rotate.test.ts` | Command name refs, new count tests |
| `src/__tests__/facilitatorTemplateStorage.test.ts` | No change | — |
| `src/utils/interactionHelpers.ts` | No change | — |

---

## Task 1: Rename files and update command name + UI strings

**Files:**
- Rename: `src/commands/facilitator.ts` → `src/commands/rotate.ts`
- Rename: `src/__tests__/facilitator.test.ts` → `src/__tests__/rotate.test.ts`

- [ ] **Step 1: Git-rename the command file**

```bash
git mv src/commands/facilitator.ts src/commands/rotate.ts
```

- [ ] **Step 2: Git-rename the test file**

```bash
git mv src/__tests__/facilitator.test.ts src/__tests__/rotate.test.ts
```

- [ ] **Step 3: Update command name and description in `rotate.ts`**

In `src/commands/rotate.ts`, change the SlashCommandBuilder:

```typescript
new SlashCommandBuilder()
  .setName('rotate')
  .setDescription('Rotation selection tools')
```

- [ ] **Step 4: Update all user-facing embed titles**

Replace every occurrence of these strings in `src/commands/rotate.ts`:
- `'Facilitator Selection'` → `'Rotation Selection'` (initial embed, spinning animation embed, cancel embed, timeout embed — 4 places)
- `'Facilitator Templates'` → `'Rotation Templates'` (in `handleTemplateList` — 1 place)

- [ ] **Step 5: Update result embed title, description, and footer**

Change the result embed (inside the `i.customId === 'start_selection'` branch):

```typescript
// Before
.setTitle('🎉 Facilitator Selected! 🎉')
.setDescription(`**${selectedFacilitator}** has been selected as the facilitator!`)
.setFooter({ text: 'Thanks for using the Facilitator Selector!' })

// After
.setTitle('🎉 Selected! 🎉')
.setDescription(`**${selectedFacilitator}** has been selected!`)
.setFooter({ text: 'Thanks for using the Rotation Selector!' })
```

- [ ] **Step 6: Update not-found error messages referencing `/facilitator`**

In `src/commands/rotate.ts`, update these two strings (in `handleTemplateUse` and `handleTemplateDelete`):

```typescript
// Before
`Template **${name}** not found. Use \`/facilitator template list\` to see available templates.`
// After
`Template **${name}** not found. Use \`/rotate template list\` to see available templates.`
```

- [ ] **Step 7: Update `rotate.test.ts` — fix require path, command name assertion, and remove stale test**

```typescript
// Before
command = require('../commands/facilitator');
// ...
expect(command.data.name).toBe('facilitator');

// After
command = require('../commands/rotate');
// ...
expect(command.data.name).toBe('rotate');
```

Also remove the test `'should select random facilitator from participants'` (it tests a copy of inline logic that no longer exists after the `selectParticipants` refactor in Task 3). New tests added in Task 3 provide better coverage.

- [ ] **Step 8: Run lint, format check, and tests**

```bash
npm run lint && npm run format:check && npm test
```

Expected: all existing tests pass with no lint errors.

- [ ] **Step 9: Commit**

```bash
git add src/commands/rotate.ts src/__tests__/rotate.test.ts
git commit -m "feat: rename facilitator command to rotate, update UI strings"
```

---

## Task 2: Migrate plain-text ephemeral replies to `safeReply()`

**Files:**
- Modify: `src/commands/rotate.ts`

> `safeReply(interaction, content)` accepts only string content. Embed-based replies (`interaction.reply({ embeds: [...] })`) and the initial reply that uses `fetchReply: true` in `runRoulette` must remain as `interaction.reply()`.

- [ ] **Step 1: Add `safeReply` import and remove `MessageFlags` import**

After this task, all `MessageFlags.Ephemeral` usages will be gone. Update the import block:

```typescript
// Remove MessageFlags from the discord.js import
import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
  // MessageFlags is removed — no longer needed after safeReply migration
} from 'discord.js';

// Add safeReply import
import { safeReply } from '../utils/interactionHelpers';
```

- [ ] **Step 2: Convert plain-text ephemeral replies in `execute()`, `handleRun()`, `handleTemplateSave()`**

Pattern — before:
```typescript
await interaction.reply({
  content: 'some message',
  flags: MessageFlags.Ephemeral,
});
```
Pattern — after:
```typescript
await safeReply(interaction, 'some message');
```

Apply to these locations in `src/commands/rotate.ts`:
- `execute()` — guild check message: `'This command can only be used in a server.'`
- `handleRun()` — empty participants message: `'Please provide at least one participant name.'`
- `handleTemplateSave()` — name length message, empty participants message, too many participants message, and success message (4 calls total)

- [ ] **Step 3: Convert plain-text ephemeral replies in `handleTemplateUse()` and `handleTemplateDelete()`**

`handleTemplateUse` has two calls: not-found and empty participants.

`handleTemplateDelete` has a success reply and a not-found reply inside a `try/catch`. The full after-state:

```typescript
async function handleTemplateDelete(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('name', true).trim();

  try {
    await templateStorage.deleteTemplate(interaction.guildId!, name);
    await safeReply(interaction, `Template **${name}** has been deleted.`);
  } catch (error) {
    if (error instanceof Error && error.message === `Template "${name}" not found in this server`) {
      await safeReply(
        interaction,
        `Template **${name}** not found. Use \`/rotate template list\` to see available templates.`,
      );
    } else {
      throw error;
    }
  }
}
```

- [ ] **Step 4: Run lint, format check, and tests**

```bash
npm run lint && npm run format:check && npm test
```

Expected: all tests pass, no lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/commands/rotate.ts
git commit -m "refactor: migrate plain-text ephemeral replies to safeReply()"
```

---

## Task 3: Add `count` parameter to `run` subcommand with selection logic (TDD)

**Files:**
- Modify: `src/__tests__/rotate.test.ts`
- Modify: `src/commands/rotate.ts`

> Edge case: with 1 participant and `count=1`, the guard `count >= participants.length` fires (1 >= 1 = true) and returns an error. This is intentional per the spec — selecting is only meaningful when there is at least one un-selected participant remaining.

### 3a — Write failing tests

- [ ] **Step 1: Add `selectParticipants` named import to `rotate.test.ts`**

At the top of `src/__tests__/rotate.test.ts`, add:

```typescript
import { selectParticipants } from '../utils/rotateHelpers';
```

> `rotate.ts` uses `module.exports = command` (CommonJS). Mixing `export function` with `module.exports` causes TS2309. `selectParticipants` therefore lives in a separate `src/utils/rotateHelpers.ts` module with standard ES exports.

- [ ] **Step 2: Add structural test for `count` option on `run` subcommand**

```typescript
test('run subcommand should have optional count integer option', () => {
  const commandData = command.data.toJSON();
  const runSubcommand = commandData.options?.find((o) => o.name === 'run') as
    | { options?: { name: string; required?: boolean; type: number; min_value?: number }[] }
    | undefined;
  const countOption = runSubcommand?.options?.find((o) => o.name === 'count');
  expect(countOption).toBeDefined();
  expect(countOption?.required).toBeFalsy();
  // type 4 = INTEGER in Discord API
  expect(countOption?.type).toBe(4);
  expect(countOption?.min_value).toBe(1);
});
```

- [ ] **Step 3: Add test — selectParticipants with count=1 returns 1 participant**

```typescript
test('selectParticipants with count=1 returns 1 participant', () => {
  const participants = ['Alice', 'Bob', 'Charlie'];
  const result = selectParticipants(participants, 1);
  expect(result).toHaveLength(1);
  expect(participants).toContain(result[0]);
});
```

- [ ] **Step 4: Add test — selectParticipants with count=2 returns 2 distinct participants**

```typescript
test('selectParticipants with count=2 returns 2 distinct participants', () => {
  const participants = ['Alice', 'Bob', 'Charlie', 'David'];
  const result = selectParticipants(participants, 2);
  expect(result).toHaveLength(2);
  expect(new Set(result).size).toBe(2);
  result.forEach((p) => expect(participants).toContain(p));
});
```

- [ ] **Step 5: Add test — count validation error message format**

```typescript
test('count >= participants.length produces correct error message', () => {
  const count = 3;
  const participantCount = 3;
  const message = `count must be less than the number of participants (got count=${count} with ${participantCount} participants).`;
  expect(message).toBe('count must be less than the number of participants (got count=3 with 3 participants).');
});
```

- [ ] **Step 6: Run tests to verify new tests fail**

```bash
npm test -- --testPathPattern=rotate.test
```

Expected: the `selectParticipants` tests and structural test fail with "selectParticipants is not defined" or "not a function".

### 3b — Implement

- [ ] **Step 7: Create `src/utils/rotateHelpers.ts` with `selectParticipants`**

Create new file `src/utils/rotateHelpers.ts`:

```typescript
export function selectParticipants(participants: string[], count: number): string[] {
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
```

- [ ] **Step 7b: Import `selectParticipants` in `rotate.ts`**

Add to the imports at the top of `src/commands/rotate.ts`:

```typescript
import { selectParticipants } from '../utils/rotateHelpers';
```

- [ ] **Step 8: Add `count` integer option to the `run` subcommand builder**

Inside the `.addSubcommand` for `'run'`, after the `participants` string option:

```typescript
.addIntegerOption((option) =>
  option
    .setName('count')
    .setDescription('Number of participants to select (default: 1)')
    .setRequired(false)
    .setMinValue(1),
)
```

- [ ] **Step 9: Update `handleRun()` to read and validate `count`**

```typescript
async function handleRun(interaction: ChatInputCommandInteraction): Promise<void> {
  const participantsInput = interaction.options.getString('participants', true);
  const participants = parseParticipants(participantsInput);
  const count = interaction.options.getInteger('count', false) ?? 1;

  if (participants.length === 0) {
    await safeReply(interaction, 'Please provide at least one participant name.');
    return;
  }

  if (count >= participants.length) {
    await safeReply(
      interaction,
      `count must be less than the number of participants (got count=${count} with ${participants.length} participants).`,
    );
    return;
  }

  await runRoulette(interaction, participants, count);
}
```

- [ ] **Step 10: Update `runRoulette()` signature and result logic**

Change the signature:

```typescript
async function runRoulette(
  interaction: ChatInputCommandInteraction,
  participants: string[],
  count: number = 1,
): Promise<void> {
```

Inside the `collector.on('collect')` callback, in the `i.customId === 'start_selection'` branch, replace the lines that compute `selectedIndex` and `selectedFacilitator` and build `resultEmbed` (the block starting at `const selectedIndex = Math.floor(...)`) with:

```typescript
const selected = selectParticipants(participants, count);

let resultTitle: string;
let resultDescription: string;
if (count === 1) {
  resultTitle = '🎉 Selected! 🎉';
  resultDescription = `**${selected[0]}** has been selected!`;
} else {
  resultTitle = `🎉 Selected (${count})! 🎉`;
  resultDescription = selected.map((name, i) => `${i + 1}. ${name}`).join('\n');
}

const resultEmbed = new EmbedBuilder()
  .setColor('#00FF00')
  .setTitle(resultTitle)
  .setDescription(resultDescription)
  .addFields({ name: 'All Participants', value: participants.join('\n'), inline: false })
  .setTimestamp()
  .setFooter({ text: 'Thanks for using the Rotation Selector!' });

await interaction.editReply({ embeds: [resultEmbed], components: [] });
selectionMade = true;
collector.stop();
```

- [ ] **Step 11: Run lint, format check, and tests**

```bash
npm run lint && npm run format:check && npm test -- --testPathPattern=rotate.test
```

Expected: all tests pass.

- [ ] **Step 12: Commit**

```bash
git add src/commands/rotate.ts src/utils/rotateHelpers.ts src/__tests__/rotate.test.ts
git commit -m "feat: add count parameter to rotate run, extract selectParticipants"
```

---

## Task 4: Add `count` to `template use` subcommand (TDD)

**Files:**
- Modify: `src/__tests__/rotate.test.ts`
- Modify: `src/commands/rotate.ts`

### 4a — Write failing tests

- [ ] **Step 1: Add structural test for `count` option on `template use` subcommand**

```typescript
test('template use subcommand should have optional count integer option', () => {
  const commandData = command.data.toJSON();
  const templateGroup = commandData.options?.find((o) => o.name === 'template') as
    | {
        options?: {
          name: string;
          options?: { name: string; required?: boolean; type: number; min_value?: number }[];
        }[];
      }
    | undefined;
  const useSubcommand = templateGroup?.options?.find((o) => o.name === 'use') as
    | { options?: { name: string; required?: boolean; type: number; min_value?: number }[] }
    | undefined;
  const countOption = useSubcommand?.options?.find((o) => o.name === 'count');
  expect(countOption).toBeDefined();
  expect(countOption?.required).toBeFalsy();
  expect(countOption?.type).toBe(4);
  expect(countOption?.min_value).toBe(1);
});
```

- [ ] **Step 2: Run tests to verify new test fails**

```bash
npm test -- --testPathPattern=rotate.test
```

Expected: the `template use` structural test fails.

### 4b — Implement

- [ ] **Step 3: Add `count` option to the `template use` subcommand builder**

Inside the `.addSubcommand` for `'use'`, after the `name` string option:

```typescript
.addIntegerOption((option) =>
  option
    .setName('count')
    .setDescription('Number of participants to select (default: 1)')
    .setRequired(false)
    .setMinValue(1),
)
```

- [ ] **Step 4: Update `handleTemplateUse()` to read and validate `count`**

```typescript
async function handleTemplateUse(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('name', true).trim();
  const count = interaction.options.getInteger('count', false) ?? 1;
  const template = await templateStorage.getTemplateByName(interaction.guildId!, name);

  if (!template) {
    await safeReply(
      interaction,
      `Template **${name}** not found. Use \`/rotate template list\` to see available templates.`,
    );
    return;
  }

  if (template.participants.length === 0) {
    await safeReply(interaction, 'Please provide at least one participant name.');
    return;
  }

  if (count >= template.participants.length) {
    await safeReply(
      interaction,
      `count must be less than the number of participants (got count=${count} with ${template.participants.length} participants).`,
    );
    return;
  }

  await runRoulette(interaction, template.participants, count);
}
```

- [ ] **Step 5: Run lint, format check, and all tests**

```bash
npm run lint && npm run format:check && npm test
```

Expected: all tests pass, no lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/commands/rotate.ts src/__tests__/rotate.test.ts
git commit -m "feat: add count parameter to rotate template use"
```

---

## Task 5: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Verify `facilitator.ts` no longer exists**

```bash
ls src/commands/facilitator.ts 2>&1 || echo "correctly removed"
```

Expected: `correctly removed`.

- [ ] **Step 4: Run build**

```bash
npm run build
```

Expected: exits 0 with no TypeScript errors.

- [ ] **Step 5: Re-register slash commands with Discord**

```bash
npm run deploy
```

> During the transition, users will briefly see both `/facilitator` and `/rotate` in the Discord UI. After `deploy` completes, `/facilitator` will be deregistered and only `/rotate` will remain.
