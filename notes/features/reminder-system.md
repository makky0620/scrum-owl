# Reminder System Feature Notes

## Overview
Implementing a comprehensive reminder system for the Discord bot with the following requirements:
1. Set time and day of week for periodic reminders
2. Add comments later
3. Edit time and day of week later
4. File persistence

## Architecture Analysis

### Existing Project Structure
- TypeScript Discord bot using discord.js v14
- Command pattern with automatic loading from `src/commands/`
- Commands implement `Command` interface with `data` and `execute` properties
- Uses embeds and buttons for rich interactions
- dayjs v1.11.10 already available for time handling
- Jest for testing

### Data Structures (from issue description)
```typescript
interface Reminder {
  id: string;
  userId: string;
  channelId: string;
  title: string;
  description?: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  time: string; // HH:mm format
  timezone: string; // e.g., "Asia/Tokyo"
  isActive: boolean;
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
}

interface Comment {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
}
```

### File Storage Structure
```
data/
├── reminders/
│   ├── reminders.json          # Main reminders data
│   └── comments/
│       ├── {reminderId}.json   # Comments for each reminder
└── backup/
    └── reminders_backup.json   # Daily backup
```

## Implementation Plan

### Phase 1: Core Infrastructure
1. Create data directory structure
2. Implement ReminderStorage service
3. Implement ReminderScheduler service
4. Create types/interfaces

### Phase 2: Discord Commands
1. `/reminder create` - Create new reminder
2. `/reminder list` - List user's reminders
3. `/reminder edit` - Edit existing reminder
4. `/reminder delete` - Delete reminder
5. `/reminder comment` - Add comment to reminder
6. `/reminder toggle` - Enable/disable reminder

### Phase 3: Advanced Features
1. Comment system
2. Backup & recovery
3. Error handling

## TDD Approach
Following Red-Green-Refactor cycle:
1. Write failing test
2. Write minimal code to pass
3. Refactor and improve
4. Commit when all tests pass

## Progress Tracking
- [ ] Phase 1: Core Infrastructure
  - [ ] Data structures and types
  - [ ] ReminderStorage service
  - [ ] ReminderScheduler service
- [ ] Phase 2: Discord Commands
  - [ ] `/reminder create`
  - [ ] `/reminder list`
  - [ ] `/reminder edit`
  - [ ] `/reminder delete`
  - [ ] `/reminder comment`
  - [ ] `/reminder toggle`
- [ ] Phase 3: Advanced Features
  - [ ] Comment system enhancements
  - [ ] Backup & recovery
  - [ ] Error handling improvements