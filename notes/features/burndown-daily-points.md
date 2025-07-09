# Burndown Daily Points Feature

## Issue Description
burndwnChartで日付ごとに達成したポイントを記録できるようにしたい
(Translation: I want to be able to record points achieved per day in the burndown chart)

## Current Implementation Analysis

### Current Sprint Interface
```typescript
interface Sprint {
  name: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  totalPoints: number;
  userId: string;
  guildId: string;
  createdAt: string; // ISO date string
}
```

### Current Limitations
1. The `/burndown view` command only takes a single `completed_points` parameter for the current moment
2. Historical data uses linear interpolation instead of actual daily progress
3. No way to record daily achievements - only current total completed points
4. Comment in code explicitly states: "In a real implementation, you would use actual historical data"

## Proposed Solution

### Enhanced Sprint Interface
```typescript
interface Sprint {
  name: string;
  startDate: string;
  endDate: string;
  totalPoints: number;
  userId: string;
  guildId: string;
  createdAt: string;
  dailyProgress: DailyProgress[]; // New field for daily tracking
}

interface DailyProgress {
  date: string; // ISO date string (YYYY-MM-DD)
  pointsCompleted: number; // Points completed on this specific day
  totalPointsCompleted: number; // Cumulative points completed up to this day
}
```

### New Commands to Add
1. `/burndown record` - Record points achieved for a specific day
   - Parameters: index (sprint), date (optional, defaults to today), points_achieved
2. Modify `/burndown view` to use actual historical data when available

### Implementation Plan
1. Update Sprint interface to include dailyProgress
2. Add new subcommand for recording daily progress
3. Modify view command to use actual data instead of interpolation
4. Handle data migration for existing sprints
5. Add validation for daily progress entries

## Test Cases to Implement
1. Record daily progress for a sprint ✅
2. View burndown chart with actual daily data ✅
3. Handle edge cases (recording for past dates, duplicate entries, etc.) ✅
4. Validate that daily progress doesn't exceed total points ✅
5. Test data persistence across bot restarts ✅

## Implementation Status: COMPLETED ✅

### What was implemented:
1. **Enhanced Sprint Interface**: Added `dailyProgress` field with `DailyProgress` interface
2. **New `/burndown record` command**: Record points achieved for specific days
3. **Enhanced `/burndown view` command**: Uses actual daily data when available, falls back to interpolation
4. **Backward compatibility**: Existing sprints work seamlessly with new functionality
5. **Data validation**: Comprehensive validation for dates, points, and sprint boundaries
6. **Cumulative tracking**: Proper calculation of running totals for daily progress
7. **Updated documentation**: README.md updated with new command usage

### Key Features:
- ✅ Record daily progress with `/burndown record index:1 points_achieved:3 date:2025-07-01`
- ✅ Date parameter is optional (defaults to today)
- ✅ Handles duplicate entries (updates existing records)
- ✅ Validates points don't exceed sprint total
- ✅ Validates dates are within sprint range
- ✅ Uses actual historical data for burndown charts when available
- ✅ Maintains backward compatibility with existing sprints
- ✅ Proper error handling and user feedback

### Testing Results:
- ✅ Build successful (no TypeScript errors)
- ✅ Commands deployed successfully to Discord
- ✅ Backward compatibility verified with existing sprint data
- ✅ Daily progress recording works correctly
- ✅ Burndown calculation uses actual data properly
- ✅ Data persistence confirmed

### Pull Request:
- Branch: `feature/burndown-daily-points`
- Commit: `b8459dc - Add daily point tracking to burndown charts`
- GitHub PR: https://github.com/makky0620/scrum-owl/pull/new/feature/burndown-daily-points
