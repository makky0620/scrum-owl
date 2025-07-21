# Guild-Specific Reminder List Feature

## Issue Description
When using the reminder list command, users should only see reminders registered within the current guild, not reminders from all guilds they're in.

## Current Problem
- The `/reminder list` command calls `reminderService.getUserReminders(interaction.user.id)`
- This method only filters by user ID, showing reminders from all guilds
- Users can see reminders from different Discord servers they're in

## Analysis
- Guild ID is already stored in reminder data structure (`guildId` field)
- `ReminderStorage.getRemindersByUser()` only filters by `userId`
- Need to add guild-based filtering to the storage layer
- Need to modify the service layer to use guild-specific filtering
- Need to update the command to pass guild ID

## Implementation Plan

### 1. Storage Layer Changes (src/utils/storage.ts)
- Add new method `getRemindersByUserAndGuild(userId: string, guildId: string): Promise<Reminder[]>`
- This method will filter reminders by both user ID and guild ID

### 2. Service Layer Changes (src/services/reminderService.ts)
- Add new method `getUserRemindersInGuild(userId: string, guildId: string): Promise<Reminder[]>`
- This will use the new storage method

### 3. Command Layer Changes (src/commands/reminder.ts)
- Update `handleList` function to use `getUserRemindersInGuild` instead of `getUserReminders`
- Pass `interaction.guildId` along with `interaction.user.id`

### 4. Test Changes
- Add tests for the new storage method
- Add tests for the new service method
- Update existing tests to ensure guild filtering works correctly

## Edge Cases to Consider
- What if `interaction.guildId` is null (DM context)?
- Ensure backward compatibility with existing reminders
- Ensure other operations (delete, edit) still work correctly with guild filtering

## Files to Modify
- `src/utils/storage.ts`
- `src/services/reminderService.ts`
- `src/commands/reminder.ts`
- `src/__tests__/storage.test.ts`
- `src/__tests__/reminderService.test.ts`