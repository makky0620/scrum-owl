import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

// Set default timezone to JST (Japan Standard Time)
dayjs.tz.setDefault('Asia/Tokyo');

// Function to check if a date is a weekend (Saturday or Sunday)
export function isWeekend(date: dayjs.Dayjs): boolean {
  const day = date.day();
  return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
}

// Function to calculate business hours between two dates
export function businessHoursDiff(startDate: dayjs.Dayjs, endDate: dayjs.Dayjs): number {
  // If dates are the same, return 0
  if (startDate.isSame(endDate)) {
    return 0;
  }

  // Ensure startDate is before endDate
  if (startDate.isAfter(endDate)) {
    return -businessHoursDiff(endDate, startDate);
  }

  let businessHours = 0;
  let currentDate = startDate.clone().startOf('hour');
  const end = endDate.clone().startOf('hour');

  // Loop through each hour
  while (currentDate.isSameOrBefore(end)) {
    // Skip weekends
    if (!isWeekend(currentDate)) {
      // Only count hours between 9:00 and 18:00 (business hours)
      const hour = currentDate.hour();
      if (hour >= 9 && hour < 18) {
        businessHours++;
      }
    }
    currentDate = currentDate.add(1, 'hour');
  }

  return businessHours;
}

export default dayjs;
