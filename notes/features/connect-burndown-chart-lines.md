# Connect Burndown Chart Lines for Days Without Input

## Issue Description
バーンダンチャートで、未入力の日があったとしてもグラフの線を繋げる感じにして欲しい。
例えば、期間が7/18~7/24の時に18日と20日と22日が入力されていたら、19日は18日のポイントのまま、21日は20日のポイント、23と24日はまだ表示しないようにしたい。

Translation:
For the burndown chart, I want to connect the graph lines even if there are days without input. For example, if the period is from 7/18 to 7/24, and data is entered for the 18th, 20th, and 22nd, then the 19th should maintain the same point value as the 18th, the 21st should maintain the same point value as the 20th, and the 23rd and 24th should not be displayed yet.

## Implementation

### Changes Made
1. Modified the `prepareChartData` method in `QuickChartService` to:
   - Find the last day with data
   - Fill gaps between data points with the last known value
   - Maintain the behavior of not showing days after the last data point

2. Added a new test that specifically verifies this behavior, ensuring that:
   - Gaps between data points are filled with the last known value
   - Days after the last data point are not shown

### Files Modified
- `src/services/quickChartService.ts`
- `src/services/__tests__/quickChartService.test.ts`

### Implementation Details
The key change was in the loop that processes the actual data points. Previously, the code tracked the last known value but didn't actually use it to fill in the gaps. The updated implementation:

1. Finds the last day with data by iterating through the `actualData` array
2. Iterates through the days again and:
   - If the day has actual data, it updates the last known value
   - If the day is after the last day with data, it keeps the value as null (no line shown)
   - Otherwise, it fills the gap with the last known value (connecting the line between data points)

This ensures that the burndown chart shows a continuous line up to the last known data point, with gaps filled with the last known value, while still not showing days after the last data point.

### Testing
Added a new test case that:
1. Creates a mock burndown chart with a 7-day sprint and progress entries on days 0, 2, and 4
2. Verifies that:
   - Day 1 is filled with the value from day 0
   - Day 3 is filled with the value from day 2
   - Days 5 and 6 have null values (no data after the last entry)

All tests pass, confirming that the implementation works as expected.