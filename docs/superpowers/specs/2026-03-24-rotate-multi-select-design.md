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

- `count` is an optional integer, default `1`, minimum `1`
- `count` must be less than the number of participants (selecting everyone is not useful)
- If `count` >= participant count, reply with an ephemeral error message

## Selection Logic

Shuffle the participants array and take the first `count` elements. This guarantees no duplicate selections.

## UI Behavior

**Spinning animation:** unchanged from current behavior — participants shuffle visually for 10 iterations.

**Result embed (count = 1):**
> 🎉 Selected! 🎉
> **Alice** has been selected!

**Result embed (count > 1), e.g. count = 2:**
> 🎉 Selected (2)! 🎉
> 1. Alice
> 2. Bob

## File Changes

| File | Change |
|------|--------|
| `src/commands/facilitator.ts` | Rename to `rotate.ts`; update command name, UI strings |
| `runRoulette()` | Add `count: number` parameter; select top `count` from shuffled array |
| `handleRun()` | Read `count` via `getInteger('count', false) ?? 1` |
| `handleTemplateUse()` | Same `count` handling as `handleRun()` |
| `FacilitatorTemplateStorage`, `facilitator-templates.json` | No change — internal implementation detail |
| `src/__tests__/facilitator.test.ts` | Rename to `rotate.test.ts` if it exists; add tests for `count > 1` |

## Constraints

- `count` option: min 1, no hard max in the builder (validated at runtime against participant count)
- Existing template data is preserved as-is
- No database migration required
