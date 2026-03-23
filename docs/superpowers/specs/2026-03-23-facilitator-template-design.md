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
  - Overwrites silently if a template with the same name exists

/facilitator template use name:<template-name>
  - Load participants from a saved template and run the roulette

/facilitator template delete name:<template-name>
  - Delete a named template from the server

/facilitator template list
  - Display all templates for the server as an Embed
```

All template operations are guild-only (DMs unsupported).

## Data Model

```ts
interface FacilitatorTemplate {
  id: string;           // UUID
  guildId: string;      // Discord server ID
  name: string;         // Template name (unique per guild)
  participants: string[]; // List of participant names
  createdAt: Date;
  updatedAt: Date;
}
```

- Template name uniqueness is enforced per guild
- Participants stored as an array; comma-separated string is parsed at input time only

## Storage

- File: `data/facilitator-templates.json`
- New class `FacilitatorTemplateStorage` in `src/utils/facilitatorTemplateStorage.ts`
- Follows the same pattern as `ReminderStorage` (read/write JSON file)

## File Changes

| File | Change |
|------|--------|
| `src/commands/facilitator.ts` | Restructure to subcommands; extract roulette logic to shared function |
| `src/models/facilitatorTemplate.ts` | New: `FacilitatorTemplate` interface |
| `src/utils/facilitatorTemplateStorage.ts` | New: CRUD operations for templates |
| `src/__tests__/facilitator.test.ts` | Update for new subcommand structure |
| `src/__tests__/facilitatorTemplateStorage.test.ts` | New: storage unit tests |
| `data/facilitator-templates.json` | Auto-created at runtime |

## Architecture Notes

- The roulette spin/selection logic is extracted into a shared helper function and reused by both `run` and `template use` subcommands
- `FacilitatorTemplateStorage` is instantiated once in `facilitator.ts` and reused across subcommand handlers
- Error handling: if a template name is not found, reply with an ephemeral error message

## Out of Scope

- Per-user (private) templates
- Template renaming
- Participant autocomplete from Discord member list
