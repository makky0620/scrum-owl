# Facilitator Template Feature Design

**Date:** 2026-03-23
**Status:** Approved

## Overview

Add a template feature to the facilitator roulette command, allowing Discord servers to save and reuse named participant lists.

## Goals

- Allow servers to save named participant lists as templates
- Enable reuse of saved templates when running the facilitator roulette
- Support save, use, delete, and list operations on templates
- Templates are scoped to the server (guild), shared by all members

## Command Structure

Restructure `/facilitator` to use subcommands:

```
/facilitator run participants:<comma-separated names>
  - Existing roulette behavior, unchanged

/facilitator template save name:<template-name> participants:<comma-separated names>
  - Save a participant list as a named template
  - Overwrites silently if a template with the same name exists (upsert)
  - On overwrite: preserve createdAt, update updatedAt and participants

/facilitator template use name:<template-name>
  - Load participants from a saved template and run the roulette
  - Includes the same 5-minute button collector and timeout behavior as run

/facilitator template delete name:<template-name>
  - Delete a named template from the server

/facilitator template list
  - Display all templates for the server as an Embed
```

All template operations require a guild context. DM invocations are blocked via `.setDMPermission(false)` on the command builder AND a runtime guard checking `interaction.guildId` (reply ephemeral if null).

## Data Model

### Runtime interface

```ts
interface FacilitatorTemplate {
  id: string;           // UUID (reserved for future use, e.g. audit logs)
  guildId: string;      // Discord server ID
  name: string;         // Template name (unique per guild, max 50 chars)
  participants: string[]; // List of participant names (min 1, max 50 entries)
  createdAt: Date;
  updatedAt: Date;
}
```

### Stored form (JSON)

`FacilitatorTemplateStorage` uses a `StoredFacilitatorTemplate` intermediate type with string dates, following the same pattern as `ReminderStorage`. On load, `createdAt` and `updatedAt` are converted from strings to `Date` objects.

```ts
interface StoredFacilitatorTemplate {
  id: string;
  guildId: string;
  name: string;
  participants: string[];
  createdAt: string;
  updatedAt: string;
}
```

## Validation Rules

Applied at **save time** (same normalization as the existing `run` command):

1. Split by comma, trim whitespace, filter empty strings, deduplicate
2. If the resulting list has 0 participants → reply ephemeral error, do not save
3. If the resulting list has more than 50 participants → reply ephemeral error, do not save
4. Template name: trimmed, max 50 characters; if empty or too long → reply ephemeral error

At **use time**:

- If template name not found → reply ephemeral error
- If stored participants list is empty (malformed data) → reply ephemeral error (same message as invalid input in `run`)

## `template list` Embed Format

- One field per template: field name = template name, field value = participant count + first 3 names (e.g. `3 participants: Alice, Bob, Charlie`)
- If more than 3 participants, append `...` (e.g. `5 participants: Alice, Bob, Charlie...`)
- Max 25 templates displayed (Discord embed field limit); if guild has more, append a footer note: "Showing 25 of N templates"
- If no templates exist, display a single description line: "No templates saved yet."

## Storage

- File: `data/facilitator-templates.json`
- New class `FacilitatorTemplateStorage` in `src/utils/facilitatorTemplateStorage.ts`
- Follows the same pattern as `ReminderStorage` (read/write JSON file, string↔Date conversion)
- Methods: `loadTemplates`, `saveTemplates`, `upsertTemplate(template)`, `deleteTemplate(guildId, name)`, `getTemplatesByGuild(guildId)`, `getTemplateByName(guildId, name)` — all name-based lookups are scoped to a guild

## File Changes

| File | Change |
|------|--------|
| `src/commands/facilitator.ts` | Restructure to subcommands; extract roulette logic to shared function |
| `src/models/facilitatorTemplate.ts` | New: `FacilitatorTemplate` and `StoredFacilitatorTemplate` interfaces |
| `src/utils/facilitatorTemplateStorage.ts` | New: CRUD operations for templates |
| `src/__tests__/facilitator.test.ts` | Update for new subcommand structure |
| `src/__tests__/facilitatorTemplateStorage.test.ts` | New: storage unit tests |
| `data/facilitator-templates.json` | Auto-created at runtime |

## Architecture Notes

- The roulette spin/selection logic is extracted into a shared helper function (`runRoulette`) and called by both `run` and `template use` subcommand handlers
- `FacilitatorTemplateStorage` is instantiated once at module load in `facilitator.ts`
- `runRoulette` implements a 5-minute button collector. On timeout (collector `end` fires without a selection having been made), the message is updated with a timeout embed and all buttons are removed. Note: the existing `facilitator.ts` has a bug where the timeout guard `if (!collector.ended)` is always false — this must be fixed in the refactor (correct condition: track whether selection was made via a boolean flag, not `collector.ended`)

## Out of Scope

- Per-user (private) templates
- Template renaming
- Participant autocomplete from Discord member list
