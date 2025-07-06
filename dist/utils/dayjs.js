"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWeekend = isWeekend;
exports.businessHoursDiff = businessHoursDiff;
const dayjs_1 = __importDefault(require("dayjs"));
const utc_1 = __importDefault(require("dayjs/plugin/utc"));
const timezone_1 = __importDefault(require("dayjs/plugin/timezone"));
const isSameOrAfter_1 = __importDefault(require("dayjs/plugin/isSameOrAfter"));
const isSameOrBefore_1 = __importDefault(require("dayjs/plugin/isSameOrBefore"));
// Extend dayjs with plugins
dayjs_1.default.extend(utc_1.default);
dayjs_1.default.extend(timezone_1.default);
dayjs_1.default.extend(isSameOrAfter_1.default);
dayjs_1.default.extend(isSameOrBefore_1.default);
// Set default timezone to JST (Japan Standard Time)
dayjs_1.default.tz.setDefault('Asia/Tokyo');
// Function to check if a date is a weekend (Saturday or Sunday)
function isWeekend(date) {
    const day = date.day();
    return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
}
// Function to calculate business hours between two dates
function businessHoursDiff(startDate, endDate) {
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
exports.default = dayjs_1.default;
