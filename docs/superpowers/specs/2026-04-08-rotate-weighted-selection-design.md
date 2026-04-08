# Rotate: Weighted Fair Selection Design

**Date:** 2026-04-08  
**Status:** Approved

## Problem

The current `selectParticipants()` uses pure random shuffle (`Math.random()`), which can produce bias over many sessions — some people get selected repeatedly while others rarely get picked. The rotate feature is used to assign facilitators and demo presenters, so fairness matters.

## Scope

Fair selection applies **only to template-based rotation** (`/rotate template use`). Ad-hoc `/rotate run` remains purely random (no persistent state to track).

## Approach

**Weighted random selection based on cumulative selection counts.**

Each participant's weight is inversely proportional to how many times they have been selected:

```
weight = 1 / (selectionCount + 1)
```

| Selection count | Weight |
|----------------|--------|
| 0 (new)        | 1.0    |
| 1              | 0.5    |
| 2              | 0.33   |
| 5              | 0.17   |

This ensures infrequently-selected participants are more likely to be chosen, while still preserving randomness (no strict ordering).

## Data Model

Add `selectionCounts` to `FacilitatorTemplate`:

```ts
// src/models/facilitatorTemplate.ts
interface FacilitatorTemplate {
  id: string;
  guildId: string;
  name: string;
  participants: string[];
  selectionCounts: { [participantName: string]: number };  // NEW (optional for backward compat)
  createdAt: Date;
  updatedAt: Date;
}
```

- Field is optional (`?`) on the interface; loaded with `{}` default for existing templates
- `StoredFacilitatorTemplate` gets the same field (JSON-serializable, no extra work)

## Algorithm

**Single pick (count = 1):**
1. For each participant, compute `weight = 1 / ((selectionCounts[name] ?? 0) + 1)`
2. Normalize weights to sum to 1.0
3. Pick using cumulative probability random selection

**Multiple picks (count > 1):**
1. Pick one participant using weighted random
2. Remove them from the pool (do not adjust weights yet)
3. Repeat for remaining picks
4. After all picks are confirmed, increment `selectionCounts` for each selected participant by 1

**On cancel or timeout:** counts are not updated.

## State Update Flow

`runRoulette` return type changes from `Promise<void>` to `Promise<string[] | null>`:
- Returns the array of selected names on success
- Returns `null` on cancel or timeout

`handleTemplateUse` updates counts after selection:

```ts
const selected = await runRoulette(interaction, template.participants, count);
if (selected) {
  for (const name of selected) {
    template.selectionCounts[name] = (template.selectionCounts[name] ?? 0) + 1;
  }
  await templateStorage.upsertTemplate(template);
}
```

## Template Consistency

In `upsertTemplate`, before saving, reconcile `selectionCounts` against the current participant list:

```ts
const validNames = new Set(template.participants);
for (const name of Object.keys(template.selectionCounts ?? {})) {
  if (!validNames.has(name)) {
    delete template.selectionCounts[name];
  }
}
```

- Removed participant → their count entry is deleted
- New participant → not in `selectionCounts`, treated as 0
- Name change (remove + add) → old count deleted, new participant starts at 0

## UI

No change to result display. The selection result embed remains the same as today. History counts are not shown to users.

## Files Changed

| File | Change |
|------|--------|
| `src/models/facilitatorTemplate.ts` | Add optional `selectionCounts` field |
| `src/utils/facilitatorTemplateStorage.ts` | Reconcile counts in `upsertTemplate` |
| `src/utils/rotateHelpers.ts` | Replace `selectParticipants` with weighted version |
| `src/commands/rotate.ts` | Change `runRoulette` return type; update `handleTemplateUse` to persist counts |
| `src/__tests__/rotate.test.ts` | Update tests for new behavior |
| `src/__tests__/facilitatorTemplateStorage.test.ts` | Add test for count reconciliation |
