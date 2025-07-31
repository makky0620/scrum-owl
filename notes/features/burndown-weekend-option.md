# Burndown Weekend Option

## Feature Description
Add option to burndown view command to include or exclude weekends (Saturday and Sunday) from the chart visualization.

## Requirements
- Add boolean option to burndown view command for weekend inclusion
- Default behavior: exclude weekends (土日を含めない)
- User can choose to include weekends if desired
- Modify QuickChart service to filter weekend dates when option is false

## Current Implementation Analysis
- Burndown view command: `src/commands/burndown.ts` handleView function (lines 229-283)
- Chart generation: QuickChart service at line 245
- Need to examine: `src/services/quickChartService.ts` for chart data preparation

## Implementation Plan
1. Add boolean option to view subcommand in burndown.ts ✓
2. Pass weekend inclusion flag to QuickChart service ✓
3. Modify QuickChart service to filter weekend dates ✓
4. Update chart data preparation logic ✓
5. Write tests for weekend filtering functionality ✓

## Files Modified
- `src/commands/burndown.ts` - Added include_weekends boolean option to view subcommand ✓
- `src/services/quickChartService.ts` - Implemented weekend filtering logic ✓
- `src/services/__tests__/quickChartService.test.ts` - Added comprehensive tests ✓

## Implementation Details
- Added `include_weekends` boolean option to burndown view command (defaults to false)
- Modified `generateBurndownChartUrl` method to accept `includeWeekends` parameter
- Updated `prepareChartData` to filter weekend dates when `includeWeekends` is false
- Ideal burndown calculation now accounts for working days vs total days
- Progress entries are correctly mapped to filtered working days
- All tests passing (85 tests, 8 test suites)

## Notes
- Japanese requirement: 土日を含めるか選べる (choose whether to include weekends) ✓
- Default: 含めない (don't include) ✓
- Weekend filtering uses JavaScript day values: Sunday = 0, Saturday = 6