# Reminder Channel Specification Feature

## Overview
Add the ability to specify a destination channel for reminders instead of always sending them to the channel where the command was executed.

## Current Implementation Analysis
- **Reminder Model**: Already has `channelId` field
- **ReminderService**: Already accepts `channelId` in `CreateReminderData`
- **ReminderScheduler**: Already uses `reminder.channelId` to send messages
- **Command Interface**: Currently hardcodes `channelId` to `interaction.channelId!`

## Required Changes
1. Add a `channel` option to the `/reminder create` subcommand
2. Modify `handleCreate` function to use the specified channel or default to current channel
3. Update README.md documentation
4. Add tests for the new functionality

## Implementation Plan
1. Add `ChannelOption` to the create subcommand in `src/commands/reminder.ts`
2. Modify `handleCreate` to get channel from options or use current channel as fallback
3. Update command documentation in README.md
4. Write tests to verify channel specification works correctly

## Technical Details
- Use Discord.js `addChannelOption()` with channel types `[ChannelType.GuildText]`
- The option should be optional (not required) to maintain backward compatibility
- Validate that the specified channel exists and the bot has permission to send messages

## Edge Cases to Consider
- Channel doesn't exist
- Bot doesn't have permission to send messages in specified channel
- Channel is not a text channel
- Cross-guild channel specification (should be prevented)

## Implementation Status: ✅ COMPLETED

### Changes Made
1. **Added channel option to create subcommand** - Optional channel parameter with GuildText type restriction
2. **Modified handleCreate function** - Added logic to use specified channel or fallback to current channel
3. **Added validation** - Validates that specified channel is a text channel
4. **Created comprehensive tests** - Added test suite for channel specification functionality
5. **Updated documentation** - Updated README.md with new parameter and usage examples

### Files Modified
- `src/commands/reminder.ts` - Added channel option and logic
- `src/__tests__/reminderCommand.test.ts` - New test file for command functionality
- `README.md` - Updated documentation with channel parameter
- `notes/features/reminder-channel-specification.md` - This notes file

### Test Results
- All existing tests continue to pass (66 tests total)
- New channel specification tests pass (5 tests)
- Feature works as expected with proper validation

### Pull Request
- Branch: `feature/reminder-channel-specification`
- Status: Pushed to GitHub
- PR URL: https://github.com/makky0620/scrum-owl/pull/new/feature/reminder-channel-specification

### Usage
Users can now specify a destination channel for reminders:
```
/reminder create title: "Meeting" message: "Team meeting" time: "14:30" type: once channel: #general
```

If no channel is specified, the reminder will be sent to the current channel (backward compatible).
