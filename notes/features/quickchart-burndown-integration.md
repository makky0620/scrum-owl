# QuickChart Burndown Integration

## Objective
Replace the current text-based progress bar in burndown charts with actual chart visualization using quickchart.io API.

## Current Implementation Analysis
- Current progress display: Text-based progress bar using Unicode characters (█ and ░)
- Location: `src/commands/burndown.ts` - `createProgressBar()` function (lines 347-353)
- Usage: In `handleView()` function at line 244 within Discord embed
- Data available: 
  - `progressEntries[]` with date, pointsRemaining, pointsBurned, note
  - `totalPoints`, `currentPoints`, `startDate`, `endDate`

## QuickChart.io Research
- API endpoint: https://quickchart.io/chart
- Supports Chart.js configuration
- Can generate line charts perfect for burndown visualization
- Returns image URL that can be embedded in Discord

## Implementation Plan
1. Create a new service/utility for generating quickchart URLs ✓
2. Write tests for the chart generation functionality ✓
3. Replace `createProgressBar()` with `generateBurndownChartUrl()` ✓
4. Update Discord embed to use image instead of text progress bar ✓
5. Handle edge cases (no progress entries, single entry, etc.) ✓

## Implementation Summary
- Created `QuickChartService` with `generateBurndownChartUrl()` method
- Implemented comprehensive Chart.js configuration for burndown visualization
- Added both ideal and actual burndown lines to the chart
- Replaced text-based progress bar with chart image in Discord embed
- All tests passing (3/3 for QuickChartService)
- Successfully integrated with existing burndown chart functionality

## Files Created/Modified
- `src/services/quickChartService.ts` - New service for generating chart URLs
- `src/services/__tests__/quickChartService.test.ts` - Tests for chart service
- `src/commands/burndown.ts` - Modified to use QuickChart instead of progress bar
- `src/services/burndownChartService.ts` - Burndown chart business logic
- `src/models/burndownChart.ts` - Data models for burndown charts
- `src/utils/burndownChartStorage.ts` - File-based storage for charts

## Data Structure for Chart
- X-axis: Dates from startDate to endDate
- Y-axis: Points remaining
- Ideal line: Linear decrease from totalPoints to 0
- Actual line: Based on progressEntries data
