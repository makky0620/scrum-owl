# Design: `/rotate` command with multi-select

**Date:** 2026-03-24
**Status:** Approved

## Background

The existing `/facilitator` command randomly selects one person from a participant list. Users want to select multiple people at once — for example, to assign pair programming partners. The command is also renamed to `/rotate` to better reflect Scrum's role-rotation philosophy and broaden its use beyond facilitator selection.

## Command Structure

```
/rotate run participants:<names> [count:<n>]
/rotate template save   name:<name> participants:<names>
/rotate template use    name:<name> [count:<n>]
/rotate template delete name:<name>
/rotate template list
```

- `count` is an optional integer, default `1`
- The builder enforces `setMinValue(1)` so Discord rejects values below 1 before the bot receives the interaction
- The upper bound (`count < participant count`) is a runtime check; if violated, reply with an ephemeral error via `safeReply()`:
  > `count must be less than the number of participants (got count=N with M participants).`

## Selection Logic

Shuffle the participants array and take the first `count` elements. This guarantees no duplicate selections.

## UI Behavior

**Initial embed:** title changes from `Facilitator Selection` to `Rotation Selection`.

**Spinning animation:** unchanged in mechanics — participants shuffle visually for 10 iterations.
- Title: `Rotation Selection` (was `Facilitator Selection`)
- Footer: `Selection in progress...` (unchanged)

**Result embed (count = 1):**
- Title: `🎉 Selected! 🎉` (was `🎉 Facilitator Selected! 🎉`)
- Description: `**Alice** has been selected!` (was `**Alice** has been selected as the facilitator!` — "as the facilitator!" is intentionally removed)
- Field "All Participants": full original participant list
- Footer: `Thanks for using the Rotation Selector!` (was `Thanks for using the Facilitator Selector!`)

**Result embed (count > 1), e.g. count = 2:**
- Title: `🎉 Selected (2)! 🎉`
- Description (numbered list):
  ```
  1. Alice
  2. Bob
  ```
- Field "All Participants": full original participant list
- Footer: `Thanks for using the Rotation Selector!`

**Cancel embed:** title changes from `Facilitator Selection` to `Rotation Selection`.

**Timeout embed:** title changes from `Facilitator Selection` to `Rotation Selection`.

## File Changes

| File | Change |
|------|--------|
| `src/commands/facilitator.ts` → `src/commands/rotate.ts` | Rename; set command name to `rotate`; convert all `interaction.reply()` calls throughout the file to `safeReply()` per project convention; update all user-facing strings referencing `/facilitator` to `/rotate` (specifically: the not-found messages in `handleTemplateUse` and `handleTemplateDelete` that say `` Use `/facilitator template list` to see available templates. ``); update all embed titles/footers/descriptions as described in UI Behavior |
| `runRoulette()` | Add `count: number` parameter; select top `count` from shuffled array; show numbered list in description when `count > 1` |
| `handleRun()` | Add `count` option to builder with `setMinValue(1)`; read via `getInteger('count', false) ?? 1`; validate `count < participants.length` using `safeReply()` for the error; pass `count` to `runRoulette()` |
| `handleTemplateUse()` | Add `count` option to the `template use` builder with `setMinValue(1)`; same count read/validate/pass pattern as `handleRun()` |
| `FacilitatorTemplateStorage`, `facilitator-templates.json` | No change — internal implementation detail |
| `src/__tests__/facilitator.test.ts` → `src/__tests__/rotate.test.ts` | Rename (unconditionally); update existing tests for new command name and embed strings; add tests for: (a) `count = 2` returns exactly 2 distinct participants; (b) `count >= participant count` triggers ephemeral error via `safeReply()`; (c) result embed title contains `(2)` when `count = 2`; (d) structural test that `count` option is present as optional integer on both `run` and `template use` subcommands; (e) omitting `count` defaults to 1 and returns a single participant |
| `src/__tests__/facilitatorTemplateStorage.test.ts` | No change — tests the storage layer which is not being renamed |

## Constraints

- `count` lower bound enforced by `setMinValue(1)` in the Discord builder
- `count` upper bound validated at runtime before calling `runRoulette()`; error uses `safeReply()` per project convention
- All `interaction.reply()` calls converted to `safeReply()` as part of this change (pre-existing violations cleaned up during the rename)
- Existing template data (`facilitator-templates.json`) is preserved as-is — no data migration required
- After the bot process is restarted with the new code, run `npm run deploy` to register `/rotate` with Discord and deregister `/facilitator`. The old command will remain visible in Discord until that step completes.
