# Facilitator Selection Feature

## Issue Description
ファシリテーターを選ぶ機能を作りたい。
入力されたユーザからランダムに選択する感じが良い

Translation: Want to create a feature to select a facilitator. It would be good to randomly select from input users.

## Current State
- Found existing implementation in `src/commands/facilitator.old.ts`
- Feature is fully implemented with:
  - Slash command `/facilitator participants: [comma-separated names]`
  - Interactive UI with start/cancel buttons
  - Spinning wheel animation effect
  - Random selection from participants
  - Proper error handling and timeout

## Implementation Plan
1. Activate the existing feature by renaming `facilitator.old.ts` to `facilitator.ts`
2. Write tests for the functionality
3. Test the implementation
4. Deploy and verify

## Notes
- The existing implementation already matches the requirements perfectly
- No new development needed, just activation of existing code
- Feature includes nice UX with animations and interactive buttons