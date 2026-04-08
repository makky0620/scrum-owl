# Rotate Weighted Fair Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace pure-random selection in `/rotate template use` with weighted random selection that gives lower probability to participants who have been selected more often.

**Architecture:** Add `selectionCounts` to the `FacilitatorTemplate` model; update `selectParticipants` in `rotateHelpers.ts` to accept and apply weights; update `upsertTemplate` to reconcile counts when the participant list changes; update `runRoulette` to return selected names so `handleTemplateUse` can persist counts.

**Tech Stack:** TypeScript, Jest (existing test setup), Discord.js, JSON file storage

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/models/facilitatorTemplate.ts` | Modify | Add optional `selectionCounts` field to both interfaces |
| `src/utils/facilitatorTemplateStorage.ts` | Modify | Default `selectionCounts` to `{}` on load; reconcile counts on upsert |
| `src/utils/rotateHelpers.ts` | Modify | Replace random shuffle with weighted random pick |
| `src/commands/rotate.ts` | Modify | Change `runRoulette` return type; update `handleTemplateUse` to persist counts |
| `src/__tests__/rotate.test.ts` | Modify | Update `selectParticipants` tests for weighted behavior |
| `src/__tests__/facilitatorTemplateStorage.test.ts` | Modify | Add tests for count reconciliation and `selectionCounts` defaults |

---

### Task 1: Add `selectionCounts` to data model and storage defaults

**Files:**
- Modify: `src/models/facilitatorTemplate.ts`
- Modify: `src/utils/facilitatorTemplateStorage.ts`

- [ ] **Step 1: Update FacilitatorTemplate and StoredFacilitatorTemplate interfaces**

Replace the contents of `src/models/facilitatorTemplate.ts`:

```ts
export interface FacilitatorTemplate {
  id: string;
  guildId: string;
  name: string;
  participants: string[];
  selectionCounts: { [participantName: string]: number };
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredFacilitatorTemplate {
  id: string;
  guildId: string;
  name: string;
  participants: string[];
  selectionCounts?: { [participantName: string]: number };
  createdAt: string;
  updatedAt: string;
}
```

Note: `selectionCounts` is required on `FacilitatorTemplate` (always present at runtime) but optional on `StoredFacilitatorTemplate` (existing JSON files won't have it).

- [ ] **Step 2: Default `selectionCounts` to `{}` when loading templates**

In `src/utils/facilitatorTemplateStorage.ts`, update the `loadTemplates` map:

```ts
return stored.map((t) => ({
  ...t,
  selectionCounts: t.selectionCounts ?? {},
  createdAt: new Date(t.createdAt),
  updatedAt: new Date(t.updatedAt),
}));
```

- [ ] **Step 3: Update the `mockTemplate` fixture in the storage test to include `selectionCounts`**

In `src/__tests__/facilitatorTemplateStorage.test.ts`, add `selectionCounts: {}` to `mockTemplate`:

```ts
const mockTemplate: FacilitatorTemplate = {
  id: 'test-id-1',
  guildId: 'guild123',
  name: 'sprint-team',
  participants: ['Alice', 'Bob', 'Charlie'],
  selectionCounts: {},
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};
```

- [ ] **Step 4: Run existing tests to confirm no regressions**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/models/facilitatorTemplate.ts src/utils/facilitatorTemplateStorage.ts src/__tests__/facilitatorTemplateStorage.test.ts
git commit -m "feat: add selectionCounts field to FacilitatorTemplate model"
```

---

### Task 2: Implement weighted selection in rotateHelpers

**Files:**
- Modify: `src/utils/rotateHelpers.ts`
- Modify: `src/__tests__/rotate.test.ts`

- [ ] **Step 1: Write failing tests for weighted selection**

In `src/__tests__/rotate.test.ts`, replace the two existing `selectParticipants` tests with:

```ts
import { selectParticipants } from '../utils/rotateHelpers';

// ... existing describe block continues ...

describe('selectParticipants', () => {
  test('returns the requested number of participants', () => {
    const result = selectParticipants(['Alice', 'Bob', 'Charlie'], 2, {});
    expect(result).toHaveLength(2);
  });

  test('all returned participants are from the input list', () => {
    const participants = ['Alice', 'Bob', 'Charlie', 'David'];
    const result = selectParticipants(participants, 2, {});
    result.forEach((p) => expect(participants).toContain(p));
  });

  test('returns distinct participants (no duplicates)', () => {
    const participants = ['Alice', 'Bob', 'Charlie', 'David'];
    const result = selectParticipants(participants, 3, {});
    expect(new Set(result).size).toBe(3);
  });

  test('works with no selectionCounts argument (defaults to equal weights)', () => {
    const result = selectParticipants(['Alice', 'Bob', 'Charlie'], 1);
    expect(result).toHaveLength(1);
    expect(['Alice', 'Bob', 'Charlie']).toContain(result[0]);
  });

  test('participant with count=0 has higher weight than participant with count=5', () => {
    // With Alice at 5 picks and Bob at 0, Bob should have a much higher weight.
    // We verify this by mocking Math.random to a value that would select Alice
    // under equal weights but selects Bob under weighted logic.
    //
    // Weights: Alice = 1/(5+1) = 0.167, Bob = 1/(0+1) = 1.0, total = 1.167
    // random * total = 0.9 * 1.167 = 1.05
    // 1.05 - 0.167 = 0.883 (skip Alice)
    // 0.883 - 1.0 = -0.117 <= 0 → Bob selected
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.9);
    const result = selectParticipants(['Alice', 'Bob'], 1, { Alice: 5, Bob: 0 });
    spy.mockRestore();
    expect(result).toEqual(['Bob']);
  });

  test('participant with count=0 is selected when Math.random is low', () => {
    // random * total = 0.05 * 1.167 = 0.058
    // 0.058 - 0.167 = -0.109 <= 0 → Alice selected (first in list)
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.05);
    const result = selectParticipants(['Alice', 'Bob'], 1, { Alice: 5, Bob: 0 });
    spy.mockRestore();
    expect(result).toEqual(['Alice']);
  });
});
```

- [ ] **Step 2: Run failing tests to confirm they fail as expected**

```bash
npx jest src/__tests__/rotate.test.ts --testNamePattern="selectParticipants" -v
```

Expected: tests fail because `selectParticipants` does not yet accept `selectionCounts`.

- [ ] **Step 3: Replace selectParticipants with weighted implementation**

Replace the full contents of `src/utils/rotateHelpers.ts`:

```ts
function weightedRandomPick(
  pool: string[],
  selectionCounts: { [name: string]: number },
): string {
  const weights = pool.map((name) => 1 / ((selectionCounts[name] ?? 0) + 1));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let rand = Math.random() * totalWeight;

  for (let i = 0; i < pool.length; i++) {
    rand -= weights[i];
    if (rand <= 0) {
      return pool[i];
    }
  }

  return pool[pool.length - 1];
}

export function selectParticipants(
  participants: string[],
  count: number,
  selectionCounts: { [name: string]: number } = {},
): string[] {
  const pool = [...participants];
  const selected: string[] = [];

  for (let i = 0; i < count; i++) {
    const pick = weightedRandomPick(pool, selectionCounts);
    selected.push(pick);
    pool.splice(pool.indexOf(pick), 1);
  }

  return selected;
}
```

- [ ] **Step 4: Run the selectParticipants tests to confirm they pass**

```bash
npx jest src/__tests__/rotate.test.ts --testNamePattern="selectParticipants" -v
```

Expected: all 6 tests pass.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/utils/rotateHelpers.ts src/__tests__/rotate.test.ts
git commit -m "feat: replace random selection with weighted random in selectParticipants"
```

---

### Task 3: Reconcile selectionCounts on upsertTemplate

**Files:**
- Modify: `src/utils/facilitatorTemplateStorage.ts`
- Modify: `src/__tests__/facilitatorTemplateStorage.test.ts`

- [ ] **Step 1: Write failing test for count reconciliation**

In `src/__tests__/facilitatorTemplateStorage.test.ts`, add a new test inside the `upsertTemplate` describe block:

```ts
it('should remove selectionCounts for participants no longer in the list', async () => {
  const stored = [
    {
      ...mockTemplate,
      selectionCounts: { Alice: 3, Bob: 1, Charlie: 2 },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  mockReadFile.mockResolvedValue(JSON.stringify(stored));
  mockMkdir.mockResolvedValue(undefined);
  mockWriteFile.mockResolvedValue(undefined);

  // Update template removing Charlie, adding Dave
  const updated: FacilitatorTemplate = {
    ...mockTemplate,
    participants: ['Alice', 'Bob', 'Dave'],
    selectionCounts: { Alice: 3, Bob: 1, Charlie: 2 },
    updatedAt: new Date('2026-02-01T00:00:00.000Z'),
  };

  await storage.upsertTemplate(updated);

  const writtenData = JSON.parse(
    (mockWriteFile.mock.calls[0][1] as string)
  ) as StoredFacilitatorTemplate[];
  expect(writtenData[0].selectionCounts).toEqual({ Alice: 3, Bob: 1 });
  expect(writtenData[0].selectionCounts).not.toHaveProperty('Charlie');
  expect(writtenData[0].selectionCounts).not.toHaveProperty('Dave');
});
```

- [ ] **Step 2: Run the failing test to confirm it fails**

```bash
npx jest src/__tests__/facilitatorTemplateStorage.test.ts --testNamePattern="selectionCounts" -v
```

Expected: FAIL — the count for Charlie is still present.

- [ ] **Step 3: Add reconciliation logic in upsertTemplate**

In `src/utils/facilitatorTemplateStorage.ts`, update `upsertTemplate` to reconcile counts before saving. Replace the method body:

```ts
async upsertTemplate(template: FacilitatorTemplate): Promise<void> {
  // Remove counts for participants no longer in the list
  const validNames = new Set(template.participants);
  const reconciledCounts: { [name: string]: number } = {};
  for (const name of Object.keys(template.selectionCounts)) {
    if (validNames.has(name)) {
      reconciledCounts[name] = template.selectionCounts[name];
    }
  }
  const reconciledTemplate = { ...template, selectionCounts: reconciledCounts };

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
}
```

- [ ] **Step 4: Run all storage tests to confirm they pass**

```bash
npx jest src/__tests__/facilitatorTemplateStorage.test.ts -v
```

Expected: all tests pass.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/utils/facilitatorTemplateStorage.ts src/__tests__/facilitatorTemplateStorage.test.ts
git commit -m "feat: reconcile selectionCounts when participant list changes in upsertTemplate"
```

---

### Task 4: Update rotate command to pass weights and persist counts

**Files:**
- Modify: `src/commands/rotate.ts`

- [ ] **Step 1: Change `runRoulette` signature to accept `selectionCounts` and return `Promise<string[] | null>`**

In `src/commands/rotate.ts`, replace the `runRoulette` function signature and return type. The full updated function:

```ts
async function runRoulette(
  interaction: ChatInputCommandInteraction,
  participants: string[],
  count: number = 1,
  selectionCounts: { [name: string]: number } = {},
): Promise<string[] | null> {
  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('Rotation Selection')
    .setDescription('Selecting random participants...')
    .addFields({ name: 'Participants', value: participants.join('\n'), inline: false })
    .setTimestamp()
    .setFooter({ text: 'Click the button to start the selection' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('start_selection')
      .setLabel('Start Selection')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎲'),
    new ButtonBuilder()
      .setCustomId('cancel_selection')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger),
  );

  const message = await interaction.reply({
    embeds: [embed],
    components: [row],
    fetchReply: true,
  });

  return new Promise<string[] | null>((resolve) => {
    let selectionMade = false;

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 5 * 60 * 1000,
    });

    collector.on('collect', async (i: ButtonInteraction) => {
      if (i.customId === 'start_selection') {
        const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('start_selection')
            .setLabel('Selection in progress...')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎲')
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('cancel_selection')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true),
        );

        await i.update({ embeds: [embed], components: [disabledRow] });

        const spinningTimes = 10;
        const spinningInterval = 500;

        for (let spin = 0; spin < spinningTimes; spin++) {
          const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
          const spinEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Rotation Selection')
            .setDescription(`Selecting... ${emojis[spin % emojis.length]}`)
            .addFields({ name: 'Participants', value: shuffledParticipants.join('\n'), inline: false })
            .setTimestamp()
            .setFooter({ text: 'Selection in progress...' });

          await interaction.editReply({ embeds: [spinEmbed], components: [disabledRow] });
          await new Promise((res) => setTimeout(res, spinningInterval));
        }

        const selected = selectParticipants(participants, count, selectionCounts);

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
        resolve(selected);
      } else if (i.customId === 'cancel_selection') {
        const cancelEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('Rotation Selection')
          .setDescription('Selection cancelled.')
          .setTimestamp();

        await i.update({ embeds: [cancelEmbed], components: [] });
        selectionMade = true;
        collector.stop();
        resolve(null);
      }
    });

    collector.on('end', async () => {
      if (!selectionMade) {
        const timeoutEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('Rotation Selection')
          .setDescription('Selection timed out.')
          .setTimestamp();

        await interaction.editReply({ embeds: [timeoutEmbed], components: [] });
        resolve(null);
      }
    });
  });
}
```

Key changes:
- Added `selectionCounts` parameter (4th arg, defaults to `{}`)
- Wrapped body in `return new Promise<string[] | null>(...)` so callers can await the button press
- `resolve(selected)` on successful selection
- `resolve(null)` on cancel or timeout

- [ ] **Step 2: Update `handleTemplateUse` to pass `selectionCounts` and persist updated counts**

Replace `handleTemplateUse`:

```ts
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

  const selected = await runRoulette(interaction, template.participants, count, template.selectionCounts);

  if (selected) {
    for (const participant of selected) {
      template.selectionCounts[participant] = (template.selectionCounts[participant] ?? 0) + 1;
    }
    await templateStorage.upsertTemplate(template);
  }
}
```

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Run linting and formatting checks**

```bash
npm run lint && npm run format:check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/commands/rotate.ts
git commit -m "feat: use weighted selection in template rotate and persist selection counts"
```
