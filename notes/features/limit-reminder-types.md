# Limit Reminder Types Feature

## Issue Description (Japanese)
リマインダー機能で選択できるタイプを毎日か一度かだけにして欲しい。毎日の場合には土日をスキップするかを選べるようにして欲しい

## Translation
- Limit reminder types to only "daily" or "once"
- For daily reminders, add option to skip weekends

## Current Implementation
- Type: "once" | "recurring"
- Recurring intervals: "daily" | "weekly" | "monthly"
- Skip weekends option exists for recurring reminders

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
- Need to handle existing reminders with weekly/monthly intervals
- Convert or disable incompatible reminders

## Implementation Plan
1. Write failing tests for new behavior
2. Update model types
3. Update service logic
4. Update command interface
5. Handle data migration
6. Update documentation