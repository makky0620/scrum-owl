# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test                  # Run all tests
npm test -- --testPathPattern=rotate  # Run a single test file
npm run build             # Compile TypeScript to dist/
npm start                 # Run compiled bot (requires build first)
npm run dev               # Run bot directly with ts-node (no build)
npm run deploy            # Register slash commands with Discord API
npm run lint              # ESLint
npm run format            # Prettier (auto-fix)
npm run format:check      # Prettier (check only)
```

Environment variables required: `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID` (see `.env.example`).

## Architecture

This is a Discord bot built with discord.js v14. The entry point is `src/index.ts`, which dynamically loads all command modules from `src/commands/` at startup.

### Command System

Commands implement the `Command` interface (`src/command.ts`): a `data` (SlashCommandBuilder) and an `execute(interaction)` method, plus optional `handleModalSubmit`. The index registers each command by name in a `client.commands` Collection and dispatches interactions to the matching command.

To add a new command: create a file in `src/commands/`, implement `Command`, and `module.exports = command`. Run `npm run deploy` to register it with Discord.

### Storage

Data is persisted as JSON files under `data/` at the project root (not committed):

- `data/reminders.json` — managed by `ReminderStorage` (`src/utils/storage.ts`)
- `data/facilitator-templates.json` — managed by `FacilitatorTemplateStorage` (`src/utils/facilitatorTemplateStorage.ts`)

Both storage classes accept a custom `dataPath` in their constructors, which tests use to inject temp file paths.

### Key Features

**Planning Poker** (`src/commands/planningPoker.ts`): Interactive voting sessions using Discord buttons and collectors.

**Rotate** (`src/commands/rotate.ts`): Weighted random participant selection. Uses `selectParticipants` from `src/utils/rotateHelpers.ts`, which picks with weights `1 / (selectionCount + 1)` so less-frequently-selected participants are more likely to be picked. Templates persist `selectionCounts` per participant; `upsertTemplate` reconciles counts to remove participants no longer in the list.

**Reminder** (`src/commands/reminder.ts`): One-time and recurring reminders. `ReminderScheduler` (`src/services/reminderScheduler.ts`) polls on a 1-minute tick and fires due reminders via the Discord client.

### Testing

Tests live in `src/__tests__/`. The pattern is to instantiate storage classes with a temp file path and real fs I/O — no database mocking. Discord API interactions are mocked with Jest mocks of discord.js.

## Development Workflow

Per `.junie/guidelines.md`:

1. Create a feature branch per task.
2. Use TDD: Red (failing test) → Green (minimal passing code) → Refactor. Do not mix phases.
3. Commit when all tests pass. Do not include a Claude footer in commit messages.
4. Push and open a PR when the feature is complete.
5. Keep notes in `notes/features/<branch-name>.md` for any clarifying decisions made during implementation.

Commit message format: subject ≤50 chars, blank line, body wrapped at 72 chars, issue link on last line.
