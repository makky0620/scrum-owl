# Planning Poker Revote — Design Spec

**Date:** 2026-06-24

## Problem

Once votes are revealed in a Planning Poker session, there is no way to re-vote on the same item without running `/poker` again. This creates friction when the team wants to discuss and vote again after seeing the results.

## Goal

Add a "Revote" button that resets the current session to the initial voting state, allowing the team to vote again on the same item without starting a new session.

## UX Flow

1. `/poker description:XXX` starts a session — voting buttons + "Show Results" + "End Session" appear (unchanged).
2. Anyone clicks "Show Results" → results are displayed in the embed, and a **"Revote"** button is added to the control row.
3. Anyone clicks "Revote" → `votes` map is cleared, embed resets to the voting-in-progress state, and the "Revote" button is removed from the control row (back to step 1 state).
4. Steps 2–3 can be repeated any number of times within the 15-minute session window.

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Who can trigger revote | Anyone | Consistent with who can vote and show results |
| What happens to previous votes | Completely cleared | Simpler; no round history needed |
| When "Revote" button appears | After "Show Results" only | Natural flow; avoids accidental resets |
| Message behavior | Update in place | Keeps channel clean; no extra messages |

## Implementation

**File changed:** `src/commands/planningPoker.ts` only.

### Key changes

1. Store the initial control row (without "Revote") as `originalControlRow` before the collector starts.
2. In the `show_results` handler, rebuild the control row with a "Revote" button added and call `i.update()`.
3. Add a `revote` handler that:
   - Calls `votes.clear()`
   - Resets the embed fields to the initial voting state (`Status: Voting in progress...`, `Participants: No votes yet`)
   - Restores `rows[rows.length - 1]` to `originalControlRow`
   - Calls `i.update({ embeds: [embed], components: rows })`

### Button layout after "Show Results"

```
[0] [1] [2] [3] [5]
[8] [13] [21] [?]
[Show Results] [Revote] [End Session]
```

### Button layout during voting (initial and after "Revote")

```
[0] [1] [2] [3] [5]
[8] [13] [21] [?]
[Show Results] [End Session]
```

## Testing

No new automated tests. The existing `planningPoker.test.ts` covers command structure only; Discord interaction mocking has low ROI for this codebase.

Manual verification steps:
1. Run `/poker description:test`
2. Cast votes, then click "Show Results" → confirm "Revote" button appears
3. Click "Revote" → confirm embed resets and "Revote" button disappears
4. Vote again and click "Show Results" → confirm results display correctly
5. Click "End Session" after a revote → confirm session ends normally
