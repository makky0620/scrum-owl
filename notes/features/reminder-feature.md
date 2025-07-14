# Reminder Feature Implementation Notes

## Overview
Implementing a comprehensive reminder system for the Scrum Owl Discord Bot with the following key features:
- One-time and recurring reminders
- Day filtering (skip weekends, custom days)
- Full CRUD operations via slash commands
- Persistent storage using JSON files

## Current Codebase Understanding

### Architecture
- Discord.js v14 with TypeScript
- Commands auto-loaded from `src/commands/` directory
- Each command implements the `Command` interface with `data` and `execute` properties
- Tests located in `src/__tests__/`
- Dependencies: discord.js, dayjs (perfect for date handling), dotenv, axios

### Command Pattern
```typescript
interface Command {
  data: SlashCommandBuilder;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}
```

### Existing Commands
- `facilitator.ts` - Random facilitator selection with interactive UI
- `planningPoker.ts` - Planning poker functionality

## Implementation Plan

### Phase 1: Data Models and Storage
1. Create `src/models/reminder.ts` - Reminder interface definition
2. Create `src/utils/storage.ts` - JSON file storage utilities
3. Write tests for data models and storage

### Phase 2: Core Services
1. Create `src/services/reminderService.ts` - CRUD operations
2. Create `src/services/reminderScheduler.ts` - Scheduling and day filtering logic
3. Write comprehensive tests for services

### Phase 3: Discord Commands
1. Create `src/commands/reminder.ts` - Slash command implementation
2. Implement subcommands: create, list, delete, edit
3. Write tests for command interactions

### Phase 4: Integration and Testing
1. Integrate scheduler with bot startup
2. End-to-end testing
3. Update README.md

## Data Structure

```typescript
interface Reminder {
  id: string;
  userId: string;
  channelId: string;
  guildId: string;
  title: string;
  message: string;
  nextTriggerTime: Date;
  type: 'once' | 'recurring';
  recurringConfig?: {
    interval: 'daily' | 'weekly' | 'monthly' | 'custom';
    customInterval?: number;
    endDate?: Date;
    maxOccurrences?: number;
    currentCount: number;
    dayFilter?: {
      skipWeekends: boolean;
      allowedDays?: number[];
      skipHolidays?: boolean;
    };
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

## Key Technical Considerations

### Day Filtering Logic
- Use dayjs for consistent date handling
- Implement `shouldTriggerToday()` method
- Handle timezone considerations
- Skip weekends: check if day is Saturday (6) or Sunday (0)
- Custom days: check against allowedDays array

### Scheduling Strategy
- Use setInterval with 1-minute checks
- Load existing reminders on bot startup
- Efficient next trigger time calculation
- Handle bot restarts gracefully

### Storage Strategy
- JSON file storage in `data/reminders.json`
- Atomic write operations
- Backup and recovery considerations
- Future database migration readiness

## Command Interface Design

```
/reminder create
  - title: string (required)
  - message: string (required)
  - time: string (required) - supports relative and absolute time
  - recurring: choice (once, daily, weekly, monthly, custom)
  - skip_weekends: boolean
  - allowed_days: string (comma-separated day numbers)
  - end_date: string
  - max_occurrences: integer

/reminder list
  - Shows user's active reminders

/reminder delete
  - id: string (required)

/reminder edit
  - id: string (required)
  - [same options as create]
```

## Testing Strategy
- Unit tests for all services and utilities
- Mock Discord interactions for command tests
- Test day filtering logic thoroughly
- Test edge cases (timezone boundaries, invalid dates)
- Integration tests for full workflow

## Next Steps
1. Start with TDD approach - write failing tests first
2. Implement data models and storage
3. Build core services
4. Create Discord command interface
5. Integration and documentation