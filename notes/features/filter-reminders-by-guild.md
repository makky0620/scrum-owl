# Filter Reminders by Guild

## Issue Description

When listing reminders, users should only see reminders from their current guild, not all reminders from all guilds.

## Current Behavior

The `handleListReminders` function in `src/commands/reminder.ts` shows all reminders regardless of guild.

## Required Changes

1. Filter the reminders array by `guildId` in the `handleListReminders` function
2. Use `interaction.guildId` to get the current guild ID
3. Only show reminders that match the current guild ID

## Implementation Plan

1. Modify the `handleListReminders` function to filter reminders by guild ID ✓
2. Handle the case where `interaction.guildId` might be null (DM context) ✓
3. Fix `handleDeleteReminder` to use guild filtering ✓
4. Fix `handleAddContent` to use guild filtering ✓
5. Test the functionality manually ✓

## Technical Details

- The Reminder interface already includes a `guildId` field
- The interaction object provides `interaction.guildId` for the current guild
- Need to filter the global `reminders` array before displaying

## Implementation Details

### Changes Made:

1. **handleListReminders**: Added guild ID filtering to only show reminders from the current guild
2. **handleDeleteReminder**: Added guild filtering and proper index mapping to prevent cross-guild deletions
3. **handleAddContent**: Added guild filtering and proper index mapping to prevent cross-guild modifications

### Key Features:

- All functions now check for `interaction.guildId` and reject DM usage
- Guild-specific filtering ensures data isolation between servers
- Proper index mapping prevents accidental cross-guild operations
- Improved error messages for better user experience

### Security Improvements:

- Users can no longer see reminders from other guilds
- Users can no longer delete/modify reminders from other guilds
- Index-based operations now work correctly with filtered results
