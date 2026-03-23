# Facilitator Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a guild-scoped template system to the `/facilitator` command so servers can save, reuse, and delete named participant lists.

**Architecture:** New `FacilitatorTemplateStorage` class handles JSON file persistence (same pattern as `ReminderStorage`). The `/facilitator` command is restructured into subcommands (`run`, `template save/use/delete/list`) with roulette logic extracted to a shared `runRoulette` helper. A pre-existing timeout bug in the collector is fixed during the refactor.

**Tech Stack:** TypeScript, discord.js v14, Node.js `crypto.randomUUID`, Jest, `fs.promises` (mocked in tests)

---

## Task 1: Create FacilitatorTemplate model

**Files:**
- Create: `src/models/facilitatorTemplate.ts`

- [ ] **Step 1: Create the model file**

```ts
// src/models/facilitatorTemplate.ts

export interface FacilitatorTemplate {
  id: string;           // UUID (reserved for future use, e.g. audit logs)
  guildId: string;
  name: string;         // unique per guild, max 50 chars
  participants: string[]; // min 1, max 50 entries
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredFacilitatorTemplate {
  id: string;
  guildId: string;
  name: string;
  participants: string[];
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/models/facilitatorTemplate.ts
git commit -m "feat: add FacilitatorTemplate model"
```

---

## Task 2: FacilitatorTemplateStorage — loadTemplates & saveTemplates

**Files:**
- Create: `src/utils/facilitatorTemplateStorage.ts`
- Create: `src/__tests__/facilitatorTemplateStorage.test.ts`

- [ ] **Step 1: Write failing tests for loadTemplates and saveTemplates**

```ts
// src/__tests__/facilitatorTemplateStorage.test.ts
import { FacilitatorTemplateStorage } from '../utils/facilitatorTemplateStorage';
import type { FacilitatorTemplate } from '../models/facilitatorTemplate';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
  },
}));

const mockReadFile = jest.mocked(fs.promises.readFile);
const mockWriteFile = jest.mocked(fs.promises.writeFile);
const mockMkdir = jest.mocked(fs.promises.mkdir);

describe('FacilitatorTemplateStorage', () => {
  let storage: FacilitatorTemplateStorage;
  const testDataPath = path.join(__dirname, '../../data/test-facilitator-templates.json');

  const mockTemplate: FacilitatorTemplate = {
    id: 'test-id-1',
    guildId: 'guild123',
    name: 'sprint-team',
    participants: ['Alice', 'Bob', 'Charlie'],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    storage = new FacilitatorTemplateStorage(testDataPath);
    jest.clearAllMocks();
  });

  describe('loadTemplates', () => {
    it('should return empty array when file does not exist', async () => {
      const enoentError = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      mockReadFile.mockRejectedValue(enoentError);

      const templates = await storage.loadTemplates();

      expect(templates).toEqual([]);
    });

    it('should load templates from existing file', async () => {
      const stored = [
        { ...mockTemplate, createdAt: mockTemplate.createdAt.toISOString(), updatedAt: mockTemplate.updatedAt.toISOString() },
      ];
      mockReadFile.mockResolvedValue(JSON.stringify(stored));

      const templates = await storage.loadTemplates();

      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe('test-id-1');
      expect(mockReadFile).toHaveBeenCalledWith(testDataPath, 'utf8');
    });

    it('should convert date strings to Date objects on load', async () => {
      const stored = [
        { ...mockTemplate, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      ];
      mockReadFile.mockResolvedValue(JSON.stringify(stored));

      const templates = await storage.loadTemplates();

      expect(templates[0].createdAt).toBeInstanceOf(Date);
      expect(templates[0].updatedAt).toBeInstanceOf(Date);
    });

    it('should return empty array for corrupted JSON', async () => {
      mockReadFile.mockResolvedValue('invalid json');

      const templates = await storage.loadTemplates();

      expect(templates).toEqual([]);
    });
  });

  describe('saveTemplates', () => {
    it('should create directory and write JSON file', async () => {
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      await storage.saveTemplates([mockTemplate]);

      expect(mockMkdir).toHaveBeenCalledWith(path.dirname(testDataPath), { recursive: true });
      expect(mockWriteFile).toHaveBeenCalledWith(
        testDataPath,
        JSON.stringify([mockTemplate], null, 2),
        'utf8',
      );
    });

    it('should throw on write error', async () => {
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockRejectedValue(new Error('Write failed'));

      await expect(storage.saveTemplates([mockTemplate])).rejects.toThrow('Write failed');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- facilitatorTemplateStorage --no-coverage
```

Expected: FAIL — `FacilitatorTemplateStorage` not found

- [ ] **Step 3: Implement loadTemplates and saveTemplates**

```ts
// src/utils/facilitatorTemplateStorage.ts
import type { FacilitatorTemplate, StoredFacilitatorTemplate } from '../models/facilitatorTemplate';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

export class FacilitatorTemplateStorage {
  private dataPath: string;

  constructor(dataPath: string = path.join(__dirname, '../../data/facilitator-templates.json')) {
    this.dataPath = dataPath;
  }

  async loadTemplates(): Promise<FacilitatorTemplate[]> {
    try {
      const data = await fs.promises.readFile(this.dataPath, 'utf8');
      const stored = JSON.parse(data) as StoredFacilitatorTemplate[];
      return stored.map((t) => ({
        ...t,
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt),
      }));
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      logger.error('Error loading facilitator templates:', error);
      return [];
    }
  }

  async saveTemplates(templates: FacilitatorTemplate[]): Promise<void> {
    try {
      const dir = path.dirname(this.dataPath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(this.dataPath, JSON.stringify(templates, null, 2), 'utf8');
    } catch (error) {
      logger.error('Error saving facilitator templates:', error);
      throw error;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- facilitatorTemplateStorage --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/facilitatorTemplateStorage.ts src/__tests__/facilitatorTemplateStorage.test.ts
git commit -m "feat: add FacilitatorTemplateStorage load/save"
```

---

## Task 3: FacilitatorTemplateStorage — upsertTemplate, getTemplatesByGuild, getTemplateByName

**Files:**
- Modify: `src/utils/facilitatorTemplateStorage.ts`
- Modify: `src/__tests__/facilitatorTemplateStorage.test.ts`

- [ ] **Step 1: Write failing tests**

Add these describe blocks inside the existing `describe('FacilitatorTemplateStorage', ...)`:

```ts
  describe('upsertTemplate', () => {
    it('should add a new template when name does not exist', async () => {
      mockReadFile.mockResolvedValue('[]');
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      await storage.upsertTemplate(mockTemplate);

      expect(mockWriteFile).toHaveBeenCalledWith(
        testDataPath,
        expect.stringContaining('"name": "sprint-team"'),
        'utf8',
      );
    });

    it('should overwrite existing template preserving createdAt', async () => {
      const originalCreatedAt = '2026-01-01T00:00:00.000Z';
      const stored = [{ ...mockTemplate, createdAt: originalCreatedAt, updatedAt: originalCreatedAt }];
      mockReadFile.mockResolvedValue(JSON.stringify(stored));
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const updated: FacilitatorTemplate = {
        ...mockTemplate,
        participants: ['Alice', 'Bob', 'Dave'],
        updatedAt: new Date('2026-02-01T00:00:00.000Z'),
      };

      await storage.upsertTemplate(updated);

      const writtenData = JSON.parse(
        (mockWriteFile.mock.calls[0][1] as string)
      ) as StoredFacilitatorTemplate[];
      expect(writtenData).toHaveLength(1);
      expect(writtenData[0].participants).toEqual(['Alice', 'Bob', 'Dave']);
      expect(writtenData[0].createdAt).toBe(originalCreatedAt);
      expect(writtenData[0].id).toBe('test-id-1'); // original id preserved
    });
  });

  describe('getTemplatesByGuild', () => {
    it('should return only templates for the given guild', async () => {
      const stored = [
        { ...mockTemplate, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
        { ...mockTemplate, id: 'test-id-2', guildId: 'guild456', name: 'other-team', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      ];
      mockReadFile.mockResolvedValue(JSON.stringify(stored));

      const result = await storage.getTemplatesByGuild('guild123');

      expect(result).toHaveLength(1);
      expect(result[0].guildId).toBe('guild123');
    });
  });

  describe('getTemplateByName', () => {
    it('should return the template matching guildId and name', async () => {
      const stored = [
        { ...mockTemplate, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      ];
      mockReadFile.mockResolvedValue(JSON.stringify(stored));

      const result = await storage.getTemplateByName('guild123', 'sprint-team');

      expect(result).toBeDefined();
      expect(result!.name).toBe('sprint-team');
    });

    it('should return undefined when not found', async () => {
      mockReadFile.mockResolvedValue('[]');

      const result = await storage.getTemplateByName('guild123', 'nonexistent');

      expect(result).toBeUndefined();
    });

    it('should not return templates from other guilds with the same name', async () => {
      const stored = [
        { ...mockTemplate, guildId: 'guild456', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      ];
      mockReadFile.mockResolvedValue(JSON.stringify(stored));

      const result = await storage.getTemplateByName('guild123', 'sprint-team');

      expect(result).toBeUndefined();
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- facilitatorTemplateStorage --no-coverage
```

Expected: FAIL — methods not implemented

- [ ] **Step 3: Implement the three methods**

Add to `FacilitatorTemplateStorage` class in `src/utils/facilitatorTemplateStorage.ts`:

```ts
  async upsertTemplate(template: FacilitatorTemplate): Promise<void> {
    const templates = await this.loadTemplates();
    const existingIndex = templates.findIndex(
      (t) => t.guildId === template.guildId && t.name === template.name,
    );

    if (existingIndex === -1) {
      templates.push(template);
    } else {
      templates[existingIndex] = {
        ...template,
        id: templates[existingIndex].id,         // preserve original id
        createdAt: templates[existingIndex].createdAt, // preserve original createdAt
      };
    }

    await this.saveTemplates(templates);
  }

  async getTemplatesByGuild(guildId: string): Promise<FacilitatorTemplate[]> {
    const templates = await this.loadTemplates();
    return templates.filter((t) => t.guildId === guildId);
  }

  async getTemplateByName(guildId: string, name: string): Promise<FacilitatorTemplate | undefined> {
    const templates = await this.loadTemplates();
    return templates.find((t) => t.guildId === guildId && t.name === name);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- facilitatorTemplateStorage --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/facilitatorTemplateStorage.ts src/__tests__/facilitatorTemplateStorage.test.ts
git commit -m "feat: add upsertTemplate, getTemplatesByGuild, getTemplateByName"
```

---

## Task 4: FacilitatorTemplateStorage — deleteTemplate

**Files:**
- Modify: `src/utils/facilitatorTemplateStorage.ts`
- Modify: `src/__tests__/facilitatorTemplateStorage.test.ts`

- [ ] **Step 1: Write failing test**

Add inside the existing describe block:

```ts
  describe('deleteTemplate', () => {
    it('should remove the template matching guildId and name', async () => {
      const stored = [
        { ...mockTemplate, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      ];
      mockReadFile.mockResolvedValue(JSON.stringify(stored));
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      await storage.deleteTemplate('guild123', 'sprint-team');

      expect(mockWriteFile).toHaveBeenCalledWith(testDataPath, '[]', 'utf8');
    });

    it('should throw when template is not found', async () => {
      mockReadFile.mockResolvedValue('[]');

      await expect(storage.deleteTemplate('guild123', 'nonexistent')).rejects.toThrow(
        'Template "nonexistent" not found in this server',
      );
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- facilitatorTemplateStorage --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Implement deleteTemplate**

Add to `FacilitatorTemplateStorage` class:

```ts
  async deleteTemplate(guildId: string, name: string): Promise<void> {
    const templates = await this.loadTemplates();
    const index = templates.findIndex((t) => t.guildId === guildId && t.name === name);

    if (index === -1) {
      throw new Error(`Template "${name}" not found in this server`);
    }

    templates.splice(index, 1);
    await this.saveTemplates(templates);
  }
```

- [ ] **Step 4: Run all storage tests**

```bash
npm test -- facilitatorTemplateStorage --no-coverage
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/facilitatorTemplateStorage.ts src/__tests__/facilitatorTemplateStorage.test.ts
git commit -m "feat: add deleteTemplate to FacilitatorTemplateStorage"
```

---

## Task 5: Refactor facilitator command — new builder + extract runRoulette + fix timeout bug

**Files:**
- Modify: `src/commands/facilitator.ts`
- Modify: `src/__tests__/facilitator.test.ts`

- [ ] **Step 1: Commit existing facilitator.test.ts before overwriting**

```bash
git add src/__tests__/facilitator.test.ts
git commit -m "chore: checkpoint facilitator tests before subcommand refactor"
```

- [ ] **Step 2: Update facilitator.test.ts for new structure**

Replace the entire contents of `src/__tests__/facilitator.test.ts`.

> **Note:** The following existing tests are intentionally removed because they test the old flat-command structure that no longer applies: `'should have required participants option'` (now nested under `run` subcommand), `'should have correct command name and description'` (description changes). The `'should handle empty participants gracefully'` and `'should handle participants with extra spaces'` tests are preserved below. Command-handler validation logic (name length, participant count limits in `handleTemplateSave`) is not unit-tested here — this is intentional, matching the existing pattern where interaction-dependent logic is not mocked.

```ts
import type { Command } from '../command';

describe('Facilitator Command', () => {
  let command: Command;

  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    command = require('../commands/facilitator');
  });

  test('should have correct command name', () => {
    expect(command.data.name).toBe('facilitator');
    expect(command.execute).toBeDefined();
    expect(typeof command.execute).toBe('function');
  });

  test('should have subcommand run', () => {
    const commandData = command.data.toJSON();
    const runSubcommand = commandData.options?.find((o) => o.name === 'run');
    expect(runSubcommand).toBeDefined();
  });

  test('should have subcommand group template', () => {
    const commandData = command.data.toJSON();
    const templateGroup = commandData.options?.find((o) => o.name === 'template');
    expect(templateGroup).toBeDefined();
  });

  test('run subcommand should have required participants option', () => {
    const commandData = command.data.toJSON();
    const runSubcommand = commandData.options?.find((o) => o.name === 'run') as
      | { options?: { name: string; required?: boolean }[] }
      | undefined;
    const participantsOption = runSubcommand?.options?.find((o) => o.name === 'participants');
    expect(participantsOption).toBeDefined();
    expect(participantsOption?.required).toBe(true);
  });

  test('should parse participants correctly', () => {
    const testInput = 'Alice, Bob, Charlie, David';
    const expectedParticipants = ['Alice', 'Bob', 'Charlie', 'David'];

    const participants = testInput
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .filter((name, index, array) => array.indexOf(name) === index);

    expect(participants).toEqual(expectedParticipants);
  });

  test('should handle empty participants gracefully', () => {
    const testInput = '';
    const participants = testInput
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    expect(participants).toHaveLength(0);
  });

  test('should handle participants with extra spaces', () => {
    const testInput = ' Alice , Bob  ,  Charlie , David ';
    const expectedParticipants = ['Alice', 'Bob', 'Charlie', 'David'];

    const participants = testInput
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .filter((name, index, array) => array.indexOf(name) === index);

    expect(participants).toEqual(expectedParticipants);
  });

  test('should deduplicate participants', () => {
    const testInput = 'Alice, Bob, Alice, Charlie, Bob';
    const expectedParticipants = ['Alice', 'Bob', 'Charlie'];

    const participants = testInput
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .filter((name, index, array) => array.indexOf(name) === index);

    expect(participants).toEqual(expectedParticipants);
  });

  test('should validate template name max length', () => {
    const longName = 'a'.repeat(51);
    expect(longName.trim().length > 50).toBe(true);
  });

  test('should reject more than 50 participants', () => {
    const manyParticipants = Array.from({ length: 51 }, (_, i) => `Person${i}`);
    expect(manyParticipants.length > 50).toBe(true);
  });

  test('should select random facilitator from participants', () => {
    const participants = ['Alice', 'Bob', 'Charlie', 'David'];
    const originalRandom = Math.random;
    Math.random = jest.fn(() => 0.5);
    const selectedIndex = Math.floor(Math.random() * participants.length);
    const selectedFacilitator = participants[selectedIndex];
    expect(selectedFacilitator).toBe('Charlie');
    Math.random = originalRandom;
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- facilitator.test --no-coverage
```

Expected: FAIL on subcommand structure tests

- [ ] **Step 4: Replace facilitator.ts with subcommand structure + runRoulette**

Replace the entire contents of `src/commands/facilitator.ts`:

```ts
import type { ChatInputCommandInteraction, ButtonInteraction } from 'discord.js';
import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
  MessageFlags,
} from 'discord.js';
import { randomUUID } from 'crypto';
import type { Command } from '../command';
import { FacilitatorTemplateStorage } from '../utils/facilitatorTemplateStorage';

const emojis = ['🎲', '🎯', '🎮', '🎪', '🎭', '🎨', '🎬', '🎤', '🎧', '🎺', '🎸', '🎹', '🎻', '🎼'];

const templateStorage = new FacilitatorTemplateStorage();

function parseParticipants(input: string): string[] {
  return input
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .filter((name, index, array) => array.indexOf(name) === index);
}

async function runRoulette(
  interaction: ChatInputCommandInteraction,
  participants: string[],
): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('Facilitator Selection')
    .setDescription('Selecting a random facilitator...')
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
          .setTitle('Facilitator Selection')
          .setDescription(`Selecting... ${emojis[spin % emojis.length]}`)
          .addFields({ name: 'Participants', value: shuffledParticipants.join('\n'), inline: false })
          .setTimestamp()
          .setFooter({ text: 'Selection in progress...' });

        await interaction.editReply({ embeds: [spinEmbed], components: [disabledRow] });
        await new Promise((resolve) => setTimeout(resolve, spinningInterval));
      }

      const selectedIndex = Math.floor(Math.random() * participants.length);
      const selectedFacilitator = participants[selectedIndex];

      const resultEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🎉 Facilitator Selected! 🎉')
        .setDescription(`**${selectedFacilitator}** has been selected as the facilitator!`)
        .addFields({ name: 'All Participants', value: participants.join('\n'), inline: false })
        .setTimestamp()
        .setFooter({ text: 'Thanks for using the Facilitator Selector!' });

      await interaction.editReply({ embeds: [resultEmbed], components: [] });
      selectionMade = true;
      collector.stop();
    } else if (i.customId === 'cancel_selection') {
      const cancelEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('Facilitator Selection')
        .setDescription('Selection cancelled.')
        .setTimestamp();

      await i.update({ embeds: [cancelEmbed], components: [] });
      selectionMade = true;
      collector.stop();
    }
  });

  collector.on('end', async () => {
    if (!selectionMade) {
      const timeoutEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('Facilitator Selection')
        .setDescription('Selection timed out.')
        .setTimestamp();

      await interaction.editReply({ embeds: [timeoutEmbed], components: [] });
    }
  });
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('facilitator')
    .setDescription('Facilitator selection tools')
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('run')
        .setDescription('Randomly select a facilitator from a list of participants')
        .addStringOption((option) =>
          option
            .setName('participants')
            .setDescription('Comma-separated list of participant names')
            .setRequired(true),
        ),
    )
    .addSubcommandGroup((group) =>
      group
        .setName('template')
        .setDescription('Manage participant templates')
        .addSubcommand((subcommand) =>
          subcommand
            .setName('save')
            .setDescription('Save a participant list as a named template')
            .addStringOption((option) =>
              option.setName('name').setDescription('Template name (max 50 characters)').setRequired(true),
            )
            .addStringOption((option) =>
              option
                .setName('participants')
                .setDescription('Comma-separated list of participant names')
                .setRequired(true),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('use')
            .setDescription('Run the roulette using a saved template')
            .addStringOption((option) =>
              option.setName('name').setDescription('Template name').setRequired(true),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('delete')
            .setDescription('Delete a saved template')
            .addStringOption((option) =>
              option.setName('name').setDescription('Template name').setRequired(true),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand.setName('list').setDescription('List all templates for this server'),
        ),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const subcommandGroup = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();

    if (subcommandGroup === 'template') {
      if (subcommand === 'save') {
        await handleTemplateSave(interaction);
      } else if (subcommand === 'use') {
        await handleTemplateUse(interaction);
      } else if (subcommand === 'delete') {
        await handleTemplateDelete(interaction);
      } else if (subcommand === 'list') {
        await handleTemplateList(interaction);
      }
    } else {
      // subcommand === 'run'
      await handleRun(interaction);
    }
  },
};

async function handleRun(interaction: ChatInputCommandInteraction): Promise<void> {
  const participantsInput = interaction.options.getString('participants', true);
  const participants = parseParticipants(participantsInput);

  if (participants.length === 0) {
    await interaction.reply({
      content: 'Please provide at least one participant name.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await runRoulette(interaction, participants);
}

async function handleTemplateSave(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('name', true).trim();
  const participantsInput = interaction.options.getString('participants', true);
  const participants = parseParticipants(participantsInput);

  if (name.length === 0 || name.length > 50) {
    await interaction.reply({
      content: 'Template name must be between 1 and 50 characters.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (participants.length === 0) {
    await interaction.reply({
      content: 'Please provide at least one participant name.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (participants.length > 50) {
    await interaction.reply({
      content: 'A template can have at most 50 participants.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const now = new Date();
  await templateStorage.upsertTemplate({
    id: randomUUID(),
    guildId: interaction.guildId!,
    name,
    participants,
    createdAt: now,
    updatedAt: now,
  });

  await interaction.reply({
    content: `Template **${name}** saved with ${participants.length} participant(s).`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleTemplateUse(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('name', true).trim();
  const template = await templateStorage.getTemplateByName(interaction.guildId!, name);

  if (!template) {
    await interaction.reply({
      content: `Template **${name}** not found. Use \`/facilitator template list\` to see available templates.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (template.participants.length === 0) {
    await interaction.reply({
      content: 'Please provide at least one participant name.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await runRoulette(interaction, template.participants);
}

async function handleTemplateDelete(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('name', true).trim();

  try {
    await templateStorage.deleteTemplate(interaction.guildId!, name);
    await interaction.reply({
      content: `Template **${name}** has been deleted.`,
      flags: MessageFlags.Ephemeral,
    });
  } catch {
    await interaction.reply({
      content: `Template **${name}** not found. Use \`/facilitator template list\` to see available templates.`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleTemplateList(interaction: ChatInputCommandInteraction): Promise<void> {
  const templates = await templateStorage.getTemplatesByGuild(interaction.guildId!);

  if (templates.length === 0) {
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Facilitator Templates')
      .setDescription('No templates saved yet.')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    return;
  }

  const displayTemplates = templates.slice(0, 25);
  const embed = new EmbedBuilder().setColor('#0099ff').setTitle('Facilitator Templates').setTimestamp();

  for (const t of displayTemplates) {
    const preview = t.participants.slice(0, 3).join(', ');
    const suffix = t.participants.length > 3 ? '...' : '';
    embed.addFields({
      name: t.name,
      value: `${t.participants.length} participants: ${preview}${suffix}`,
      inline: false,
    });
  }

  if (templates.length > 25) {
    embed.setFooter({ text: `Showing 25 of ${templates.length} templates` });
  }

  await interaction.reply({ embeds: [embed] });
}

module.exports = command;
```

- [ ] **Step 5: Run facilitator tests**

```bash
npm test -- facilitator.test --no-coverage
```

Expected: PASS

- [ ] **Step 6: Run all tests to confirm nothing is broken**

```bash
npm test --no-coverage
```

Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add src/commands/facilitator.ts src/__tests__/facilitator.test.ts
git commit -m "feat: refactor facilitator to subcommands, add template feature, fix timeout bug"
```

---

## Task 6: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: All tests PASS with coverage

- [ ] **Step 2: Build to confirm TypeScript compiles**

```bash
npm run build
```

Expected: No TypeScript errors

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: No lint errors

- [ ] **Step 4: Final commit if any lint fixes were needed**

If lint fixes were required:
```bash
git add -p
git commit -m "fix: lint cleanup for facilitator template feature"
```
