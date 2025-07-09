# Burndown Weekend Exclusion Feature

## Issue Description
When viewing the burndown chart, exclude weekends (Saturday and Sunday) from the graph.

## Current Understanding
- Burndown functionality is in `src/commands/burndownChart.ts`
- Key function: `handleViewBurndown` (lines 254-451)
- Project uses dayjs for date handling
- Need to filter out weekends when generating the burndown chart

## Implementation Plan
1. Analyze current burndown chart generation logic
2. Write tests for weekend exclusion functionality
3. Implement weekend filtering in the chart generation
4. Test the implementation
5. Refactor if needed

## Implementation Details
- Added helper functions:
  - `isWeekend(date)`: Checks if a date is Saturday or Sunday
  - `getWorkingDaysBetween(startDate, endDate)`: Counts working days between dates
  - `getNthWorkingDay(startDate, workingDayIndex)`: Gets the nth working day from start date

- Modified burndown chart generation:
  - Sprint duration now calculated in working days only
  - Days completed calculation excludes weekends
  - Ideal burndown line uses working day intervals
  - Actual burndown processing only considers working days
  - Chart labels show only working days on x-axis
  - Chart title and descriptions updated to indicate weekend exclusion

## Testing
- Build completed successfully without compilation errors
- Manual testing needed with actual Discord bot interaction

## Status
✅ Implementation complete
✅ Build successful
⏳ Ready for pull request
