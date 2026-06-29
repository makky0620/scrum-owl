# Design: Rotate Template Member Management

**Date:** 2026-06-29
**Status:** Approved

## Overview

Add two new subcommands to `/rotate template` that allow adding or removing members from an existing template without having to recreate it from scratch.

## Commands

### `/rotate template add-member`

```
/rotate template add-member name:<template-name> members:<comma-separated-names>
```

- `name`: required, autocomplete-enabled (reuses existing autocomplete handler)
- `members`: required, comma-separated list of participant names

### `/rotate template remove-member`

```
/rotate template remove-member name:<template-name> members:<comma-separated-names>
```

- `name`: required, autocomplete-enabled
- `members`: required, comma-separated list of participant names

## Architecture

Both commands live in `src/commands/rotate.ts`, following the existing handler pattern. No new files are needed.

**Changes to `rotate.ts`:**
1. Add two subcommands to the `SlashCommandBuilder` inside the `template` group
2. Add `handleTemplateAddMember` and `handleTemplateRemoveMember` handler functions
3. Dispatch to new handlers in the `execute` method
4. Extend `handleAutocomplete` to respond for the new `name` options (already works because the focused-option check is name-agnostic)

## Processing Flow

**add-member:**
1. Parse `members` with existing `parseParticipants`
2. Fetch template by name; error if not found
3. Merge new names (dedup against existing participants)
4. Error if merged count > 50
5. Call `upsertTemplate` with updated participants list
6. Reply: "Added X member(s) to **\<name\>**. Now has Y participant(s)."

**remove-member:**
1. Parse `members` with existing `parseParticipants`
2. Fetch template by name; error if not found
3. Check every requested name exists in the template; error listing any that don't
4. Error if removal would leave 0 participants
5. Call `upsertTemplate` with filtered participants list
6. `selectionCounts` for removed members are cleaned up automatically by existing reconciliation logic in `upsertTemplate`
7. Reply: "Removed X member(s) from **\<name\>**. Now has Y participant(s)."

## Validation

| Condition | Response |
|---|---|
| Template not found | "Template **\<name\>** not found. Use `/rotate template list` to see available templates." |
| add-member: result > 50 participants | "Cannot add: would exceed the 50-participant limit (currently Y, adding X)." |
| remove-member: one or more names not in template | "The following member(s) are not in template **\<name\>**: \<list\>" |
| remove-member: would remove all participants | "Cannot remove: template must have at least 1 participant." |

## Data Model

No changes to `FacilitatorTemplate` or `FacilitatorTemplateStorage`. The existing `upsertTemplate` already:
- Reconciles `selectionCounts` to only include current participants (handles removal cleanup)
- Preserves `id` and `createdAt` on update

## Testing

New tests in `src/__tests__/rotate.test.ts`:

- `add-member`: adds one member, adds multiple members, deduplicates, errors on template-not-found, errors when exceeding 50 limit
- `remove-member`: removes one member, removes multiple members, errors on template-not-found, errors on member-not-found (with list), errors when removing all participants
- Confirm `selectionCounts` for removed members are absent after remove-member

Follow existing test pattern: mock Discord interactions, use temp file path for storage.
