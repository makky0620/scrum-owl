# ESLint Strictification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strictify ESLint rules from `warn` to `error`, add new quality rules, and fix all resulting violations in existing source files.

**Architecture:** Update `eslint.config.mjs` first, then fix each category of violation (require→import, type imports, return types) file by file. Run `npm run lint` after each task to verify progress. No new files needed — all changes are to existing source.

**Tech Stack:** ESLint 9 (flat config), typescript-eslint 8, Node.js/CommonJS, Discord.js 14, TypeScript 5

**Spec:** `docs/superpowers/specs/2026-03-23-eslint-strictification-design.md`

**Key prerequisites confirmed:**
- `tsconfig.json` has `"esModuleInterop": true` — this is required for `(await import(filePath)).default` to correctly unwrap `module.exports` values in Task 2/3
- `planningPoker.ts` uses `export = command` while other files use `module.exports = command` — both compile to identical CJS output and both work correctly with `.default` under `esModuleInterop: true`

---

### Task 1: Update eslint.config.mjs

**Files:**
- Modify: `eslint.config.mjs`

- [ ] **Step 1: Apply all rule changes**

Replace the entire file content:

```js
import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  { ignores: ['dist/**'] },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-console': 'error',
      'eqeqeq': ['error', 'always'],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-require-imports': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
    },
  },
  {
    files: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
  eslintConfigPrettier,
];
```

- [ ] **Step 2: Run lint to see all violations**

```bash
cd /Users/makinotakashi/Workspace/discord-bot/scrum-master && npm run lint 2>&1 | head -100
```

Expected: Many errors across multiple files — this is the baseline we'll fix in subsequent tasks.

- [ ] **Step 3: Commit the config change**

```bash
git add eslint.config.mjs
git commit -m "feat: strictify ESLint rules — warn to error, add new rules"
```

---

### Task 2: Fix require() in src/index.ts

**Files:**
- Modify: `src/index.ts`

**Note:** `(await import(filePath)).default` unwraps to `module.exports` because `esModuleInterop: true` in tsconfig. TypeScript compiles this to `require()` at build time, so ts-node runtime behavior is unchanged.

- [ ] **Step 1: Wrap initialization in async main() function**

Replace the entire file with:

```ts
import { Client, Collection, Events, GatewayIntentBits } from 'discord.js';
import type { Command } from './command';
import { ReminderScheduler } from './services/reminderScheduler';
import { ReminderStorage } from './utils/storage';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { safeReply } from './utils/interactionHelpers';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Create a collection to store commands
client.commands = new Collection<string, Command>();

// Initialize reminder scheduler
const reminderStorage = new ReminderStorage();
const reminderScheduler = new ReminderScheduler(client, reminderStorage);

// Load commands from the commands directory
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith('.js') || file.endsWith('.ts'));

async function main(): Promise<void> {
  // Load commands
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = (await import(filePath)).default;

    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      logger.log(`[INFO] Loaded command: ${command.data.name}`);
    } else {
      logger.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
      );
    }
  }

  // When the client is ready, run this code (only once)
  client.once(Events.ClientReady, (readyClient) => {
    logger.log(`[INFO] Ready! Logged in as ${readyClient.user.tag}`);
    reminderScheduler.start();
    logger.log('[INFO] Reminder scheduler started');
  });

  // Handle interactions
  client.on(Events.InteractionCreate, async (interaction) => {
    // Handle slash command interactions
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        logger.error(`[ERROR] No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        logger.error(`[ERROR] Error executing command ${interaction.commandName}:`, error);
        await safeReply(interaction, 'There was an error while executing this command!');
      }
      return;
    }

    // Handle modal submit interactions
    if (interaction.isModalSubmit()) {
      const customId = interaction.customId;
      let commandName = '';

      if (customId.startsWith('edit-reminder-modal:')) {
        commandName = 'reminder';
      }

      if (!commandName) {
        logger.error(`[ERROR] Could not determine command for modal submission: ${customId}`);
        return;
      }

      const command = client.commands.get(commandName);

      if (!command) {
        logger.error(`[ERROR] No command matching ${commandName} was found for modal submission.`);
        return;
      }

      if (!command.handleModalSubmit) {
        logger.error(`[ERROR] Command ${commandName} does not support modal submissions.`);
        return;
      }

      try {
        await command.handleModalSubmit(interaction);
      } catch (error) {
        logger.error(`[ERROR] Error handling modal submission for ${commandName}:`, error);
        await safeReply(interaction, 'There was an error while processing your submission!');
      }
      return;
    }
  });

  // Log in to Discord with your client's token
  client.login(process.env.DISCORD_TOKEN);
}

main().catch((error: unknown) => {
  logger.error('[ERROR] Failed to initialize bot:', error);
  process.exit(1);
});

// Graceful shutdown handling
process.on('SIGINT', () => {
  logger.log('[INFO] Received SIGINT, shutting down gracefully...');
  reminderScheduler.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.log('[INFO] Received SIGTERM, shutting down gracefully...');
  reminderScheduler.stop();
  process.exit(0);
});

// Extend the Client interface to include commands
declare module 'discord.js' {
  export interface Client {
    commands: Collection<string, Command>;
  }
}
```

Key changes from original:
- `import type { Command }` (type-only import)
- Command loading loop moved inside `async main()`
- `require(filePath)` → `(await import(filePath)).default`
- `eslint-disable-next-line` comment removed

- [ ] **Step 2: Verify lint passes for this file**

```bash
cd /Users/makinotakashi/Workspace/discord-bot/scrum-master && npx eslint src/index.ts
```

Expected: No errors for `src/index.ts`

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "fix: migrate require() to import() in index.ts"
```

---

### Task 3: Fix require() in src/deploy-commands.ts

**Files:**
- Modify: `src/deploy-commands.ts`

- [ ] **Step 1: Move command loading into the async IIFE and type the commands array**

Replace the entire file with:

```ts
import { REST, Routes } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

const commands: object[] = [];

// Load commands from the commands directory
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith('.js') || file.endsWith('.ts'));

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

// Deploy commands
(async () => {
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = (await import(filePath)).default;

    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
      logger.log(`[INFO] Loaded command for deployment: ${command.data.name}`);
    } else {
      logger.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
      );
    }
  }

  try {
    logger.log(`[INFO] Started refreshing ${commands.length} application (/) commands.`);

    if (process.env.GUILD_ID) {
      // Deploy to specific guild (faster for development)
      const data = (await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID),
        { body: commands },
      )) as { length: number };
      logger.log(
        `[INFO] Successfully reloaded ${data.length} application (/) commands for guild ${process.env.GUILD_ID}.`,
      );
    } else {
      // Deploy globally (takes up to 1 hour to propagate)
      const data = (await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), {
        body: commands,
      })) as { length: number };
      logger.log(`[INFO] Successfully reloaded ${data.length} application (/) commands globally.`);
    }
  } catch (error) {
    logger.error('[ERROR] Error deploying commands:', error);
  }
})();
```

Key changes from original:
- `commands` typed as `object[]` (was inferred `never[]`)
- Command loading loop moved inside the async IIFE
- `require(filePath)` → `(await import(filePath)).default`
- `eslint-disable-next-line` comment removed

- [ ] **Step 2: Verify lint passes for this file**

```bash
cd /Users/makinotakashi/Workspace/discord-bot/scrum-master && npx eslint src/deploy-commands.ts
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/deploy-commands.ts
git commit -m "fix: migrate require() to import() in deploy-commands.ts"
```

---

### Task 4: Fix import type violations

Fix `@typescript-eslint/consistent-type-imports` violations across all files.

**Files:**
- Modify: `src/command.ts`
- Modify: `src/commands/burndown.ts`
- Modify: `src/commands/reminder.ts`
- Modify: `src/commands/facilitator.ts`
- Modify: `src/commands/planningPoker.ts`
- Modify: `src/services/burndownChartService.ts`
- Modify: `src/services/reminderService.ts`
- Modify: `src/services/reminderScheduler.ts`
- Modify: `src/utils/storage.ts`
- Modify: `src/utils/burndownChartStorage.ts`

- [ ] **Step 1: Fix src/command.ts imports**

All three imports are type-only (used only in interface definitions):

```ts
import type {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
} from 'discord.js';
```

- [ ] **Step 2: Fix src/commands/burndown.ts imports**

Replace lines 1–14:

```ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  ChannelType,
} from 'discord.js';
import type { Command } from '../command';
import { BurndownChartService } from '../services/burndownChartService';
import { QuickChartService } from '../services/quickChartService';
import type { CreateBurndownChartData, UpdateProgressData } from '../models/burndownChart';
import { safeReply } from '../utils/interactionHelpers';
import { logger } from '../utils/logger';
import dayjs from 'dayjs';
```

- [ ] **Step 3: Fix src/commands/reminder.ts imports**

Replace lines 1–21:

```ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
} from 'discord.js';
import type { Command } from '../command';
import { ReminderService } from '../services/reminderService';
import type { CreateReminderData, UpdateReminderData } from '../services/reminderService';
import { safeReply } from '../utils/interactionHelpers';
import { logger } from '../utils/logger';
```

- [ ] **Step 4: Fix src/commands/facilitator.ts imports**

Replace lines 1–12:

```ts
import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import type { ButtonInteraction } from 'discord.js';
import type { Command } from '../command';
```

- [ ] **Step 5: Fix src/commands/planningPoker.ts imports**

Replace lines 1–13:

```ts
import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import type { ButtonInteraction, Message } from 'discord.js';
import type { Command } from '../command';
```

- [ ] **Step 6: Fix src/services/burndownChartService.ts imports**

Replace lines 1–9:

```ts
import type {
  BurndownChart,
  CreateBurndownChartData,
  UpdateProgressData,
  ProgressEntry,
} from '../models/burndownChart';
import { BurndownChartStorage } from '../utils/burndownChartStorage';
import dayjs from 'dayjs';
import { randomUUID } from 'crypto';
```

- [ ] **Step 7: Fix src/services/reminderService.ts imports**

Replace line 1:

```ts
import type { Reminder, ReminderType, DayFilter } from '../models/reminder';
```

(`ReminderStorage`, `dayjs`, `randomUUID` remain as value imports — no changes needed for lines 2–5)

- [ ] **Step 8: Fix src/services/reminderScheduler.ts imports**

Replace lines 1–5:

```ts
import { Client, EmbedBuilder } from 'discord.js';
import type { TextChannel } from 'discord.js';
import { ReminderStorage } from '../utils/storage';
import type { Reminder, DayFilter } from '../models/reminder';
import dayjs from 'dayjs';
import { logger } from '../utils/logger';
```

(`Client` used only as type annotation in constructor parameter; `TextChannel` used only in type cast `as TextChannel`)

- [ ] **Step 9: Fix src/utils/storage.ts imports**

Replace line 1:

```ts
import type { Reminder } from '../models/reminder';
```

(`fs`, `path`, `logger` remain as value imports)

- [ ] **Step 10: Fix src/utils/burndownChartStorage.ts imports**

Replace line 1:

```ts
import type { BurndownChart } from '../models/burndownChart';
```

(`fs`, `path`, `logger` remain as value imports)

- [ ] **Step 11: Run lint to verify no remaining type import violations**

```bash
cd /Users/makinotakashi/Workspace/discord-bot/scrum-master && npm run lint 2>&1 | grep "consistent-type-imports"
```

Expected: No output (zero violations). If any remain, fix them in the reported files.

- [ ] **Step 12: Commit**

```bash
git add src/command.ts src/commands/burndown.ts src/commands/reminder.ts src/commands/facilitator.ts src/commands/planningPoker.ts src/services/burndownChartService.ts src/services/reminderService.ts src/services/reminderScheduler.ts src/utils/storage.ts src/utils/burndownChartStorage.ts
git commit -m "fix: use import type for type-only imports across all source files"
```

---

### Task 5: Fix return type annotations

Fix `@typescript-eslint/explicit-function-return-type` violations. Recall: `allowExpressions: true` exempts anonymous callbacks (arrow functions passed as arguments) — only named function declarations and class methods need annotation.

**Files:**
- Modify: `src/commands/burndown.ts`
- Modify: `src/commands/reminder.ts`
- Modify: `src/services/quickChartService.ts`
- Modify: `src/services/reminderScheduler.ts`

- [ ] **Step 1: Fix src/commands/burndown.ts — add return types to named functions**

`progressPercentage` at line 19 should already have `: string` — verify it is present, no change needed if so.

Add `: Promise<void>` to the remaining four async function declarations:

```ts
// line 141
async function handleCreate(interaction: ChatInputCommandInteraction): Promise<void> {

// line 197
async function handleUpdate(interaction: ChatInputCommandInteraction): Promise<void> {

// line 254
async function handleView(interaction: ChatInputCommandInteraction): Promise<void> {

// line 310
async function handleList(interaction: ChatInputCommandInteraction): Promise<void> {

// line 344
async function handleDelete(interaction: ChatInputCommandInteraction): Promise<void> {
```

- [ ] **Step 2: Fix src/commands/reminder.ts — add return types to named functions**

```ts
// line 127
async function handleCreate(interaction: ChatInputCommandInteraction): Promise<void> {

// line 190
async function handleList(interaction: ChatInputCommandInteraction): Promise<void> {

// line 249
async function handleDelete(interaction: ChatInputCommandInteraction): Promise<void> {

// line 276
async function handleEdit(interaction: ChatInputCommandInteraction): Promise<void> {

// line 343
async function processModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
```

- [ ] **Step 3: Fix src/services/quickChartService.ts — define interfaces and add return types**

Add these interfaces after the import (before the class declaration):

```ts
interface ChartDataset {
  label: string;
  data: number[];
  borderColor: string;
  backgroundColor: string;
  borderWidth: number;
  borderDash?: number[];
  fill: boolean;
  tension: number;
}

interface ChartConfig {
  type: string;
  data: {
    labels: string[];
    datasets: ChartDataset[];
  };
  options: {
    responsive: boolean;
    plugins: {
      title: { display: boolean; text: string; font: { size: number; weight: string } };
      legend: { display: boolean; position: string };
    };
    scales: {
      x: { title: { display: boolean; text: string }; grid: { display: boolean } };
      y: {
        title: { display: boolean; text: string };
        beginAtZero: boolean;
        max: number;
        grid: { display: boolean };
      };
    };
    elements: { point: { radius: number; hoverRadius: number } };
  };
}

interface ChartData {
  labels: string[];
  idealData: number[];
  actualData: (number | null)[];
}
```

Change `buildChartConfig` signature (line 13):
```ts
private buildChartConfig(chart: BurndownChart, includeWeekends: boolean = false): ChartConfig {
```

Change `prepareChartData` signature (line 90):
```ts
private prepareChartData(chart: BurndownChart, includeWeekends: boolean = false): ChartData {
```

- [ ] **Step 4: Fix src/services/reminderScheduler.ts — add return type to findNextValidDay**

Change line 109:
```ts
private findNextValidDay(startTime: dayjs.Dayjs, dayFilter: DayFilter): dayjs.Dayjs {
```

- [ ] **Step 5: Run lint to check remaining return type violations**

```bash
cd /Users/makinotakashi/Workspace/discord-bot/scrum-master && npm run lint 2>&1 | grep "explicit-function-return-type"
```

Expected: No remaining violations. If any are reported in other files, add the missing return type annotations as indicated by the error messages.

- [ ] **Step 6: Commit**

```bash
git add src/commands/burndown.ts src/commands/reminder.ts src/services/quickChartService.ts src/services/reminderScheduler.ts
git commit -m "fix: add explicit return type annotations to all named functions"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run full lint — must be zero errors**

```bash
cd /Users/makinotakashi/Workspace/discord-bot/scrum-master && npm run lint
```

Expected: Exits with code 0, no output. If any violations remain, fix them before proceeding.

- [ ] **Step 2: Run all tests — must all pass**

```bash
npm test
```

Expected: All test suites pass.

- [ ] **Step 3: Final commit if any remaining fixes were applied in Step 1**

```bash
git add -p
git commit -m "fix: address remaining ESLint violations"
```
