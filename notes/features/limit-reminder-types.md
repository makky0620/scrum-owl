# Limit Reminder Types Feature

## Issue Description (Japanese)
リマインダー機能で選択できるタイプを毎日か一度かだけにして欲しい。毎日の場合には土日をスキップするかを選べるようにして欲しい

## Translation
- Limit reminder types to only "daily" or "once"
- For daily reminders, add option to skip weekends

## Current Implementation
- Type: "once" | "daily"
- Skip weekends option exists for daily reminders

## Required Changes

### 1. Model Changes (src/models/reminder.ts)
- Change ReminderType from 'once' | 'recurring' to 'once' | 'daily'
- Remove RecurringInterval type (no longer needed)
- Simplify RecurringConfig or replace with DailyConfig

### 2. Service Changes (src/services/reminderService.ts)
- Update CreateReminderData interface
- Modify createReminder logic to handle new type structure
- Update validation logic

### 3. Command Changes (src/commands/reminder.ts)
- Update slash command choices to show "Once" and "Daily"
- Remove recurring interval option
- Keep skip_weekends option but only for daily type
- Update handleCreate logic

### 4. Data Migration
- Not needed - existing data structure remains compatible

## Implementation Plan
1. Write failing tests for new behavior ✓
2. Update model types ✓
3. Update service logic ✓
4. Update command interface ✓
5. Handle data migration (not needed - existing data will work)
6. Update documentation ✓

## Implementation Details

### Changes Made:
1. **Model (src/models/reminder.ts)**:
   - Changed ReminderType from 'once' | 'recurring' to 'once' | 'daily'
   - Removed RecurringInterval type (no longer needed)
   - Simplified RecurringConfig to use 'daily' directly

2. **Service (src/services/reminderService.ts)**:
   - Updated CreateReminderData interface to include skipWeekends and endDate directly
   - Added validation to reject non-supported reminder types
   - Simplified recurring config creation for daily reminders
   - Automatically creates dayFilter with skipWeekends option

3. **Command (src/commands/reminder.ts)**:
   - Updated slash command choices to show "Once" and "Daily" only
   - Removed recurring interval option
   - Simplified handleCreate logic to work with new structure
   - Updated display logic for reminder lists

4. **Scheduler (src/services/reminderScheduler.ts)**:
   - Updated type references from 'recurring' to 'daily'
   - Simplified calculateNextTriggerTime to only handle daily intervals
   - Updated formatReminderMessage for daily reminders

5. **Tests**:
   - Updated all test files to use new type structure
   - Added tests for rejecting unsupported reminder types
   - Verified weekend skipping functionality

### Features Implemented:
- ✅ Limited reminder types to "once" and "daily" only
- ✅ Added skip weekends option for daily reminders
- ✅ Maintained backward compatibility with existing data
- ✅ All tests passing (63/63)

### Cleanup Phase:
- ✅ Removed RecurringInterval type (no longer needed)
- ✅ Simplified RecurringConfig to use 'daily' directly
- ✅ Updated README.md to remove weekly/monthly references
- ✅ Cleaned up unused imports and references

## Status: COMPLETED ✅
