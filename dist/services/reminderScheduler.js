"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReminderScheduler = void 0;
const discord_js_1 = require("discord.js");
const dayjs_1 = __importDefault(require("dayjs"));
const utc_1 = __importDefault(require("dayjs/plugin/utc"));
const timezone_1 = __importDefault(require("dayjs/plugin/timezone"));
dayjs_1.default.extend(utc_1.default);
dayjs_1.default.extend(timezone_1.default);
class ReminderScheduler {
    constructor(client) {
        this.intervals = new Map();
        this.client = client;
    }
    scheduleReminder(reminder) {
        if (!reminder.isActive) {
            return;
        }
        // Unschedule existing reminder if it exists
        this.unscheduleReminder(reminder.id);
        const nextOccurrence = this.getNextOccurrence(reminder.dayOfWeek, reminder.time, reminder.timezone);
        const delay = nextOccurrence.getTime() - Date.now();
        const timeout = setTimeout(async () => {
            await this.sendReminder(reminder);
            // Reschedule for next week
            this.scheduleReminder(reminder);
        }, delay);
        this.intervals.set(reminder.id, timeout);
    }
    unscheduleReminder(reminderId) {
        const timeout = this.intervals.get(reminderId);
        if (timeout) {
            clearTimeout(timeout);
            this.intervals.delete(reminderId);
        }
    }
    rescheduleReminder(reminder) {
        this.unscheduleReminder(reminder.id);
        this.scheduleReminder(reminder);
    }
    isScheduled(reminderId) {
        return this.intervals.has(reminderId);
    }
    async sendReminder(reminder) {
        try {
            const channel = await this.client.channels.fetch(reminder.channelId);
            if (!channel || !channel.isTextBased()) {
                console.error(`Channel ${reminder.channelId} not found or not text-based`);
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`🔔 Reminder: ${reminder.title}`)
                .setTimestamp()
                .setFooter({ text: `Reminder ID: ${reminder.id}` });
            if (reminder.description) {
                embed.setDescription(reminder.description);
            }
            // Add comments if any
            if (reminder.comments.length > 0) {
                const commentsText = reminder.comments
                    .slice(-3) // Show last 3 comments
                    .map(comment => `• ${comment.content}`)
                    .join('\n');
                embed.addFields({
                    name: 'Recent Comments',
                    value: commentsText,
                    inline: false
                });
            }
            // Add next occurrence info
            const nextOccurrence = this.getNextOccurrence(reminder.dayOfWeek, reminder.time, reminder.timezone);
            embed.addFields({
                name: 'Next Reminder',
                value: `<t:${Math.floor(nextOccurrence.getTime() / 1000)}:F>`,
                inline: true
            });
            await channel.send({ embeds: [embed] });
        }
        catch (error) {
            console.error(`Error sending reminder ${reminder.id}:`, error);
        }
    }
    scheduleAllReminders(reminders) {
        // Clear all existing schedules
        this.intervals.forEach((timeout) => clearTimeout(timeout));
        this.intervals.clear();
        // Schedule all active reminders
        reminders.forEach(reminder => {
            if (reminder.isActive) {
                this.scheduleReminder(reminder);
            }
        });
    }
    getNextOccurrence(dayOfWeek, time, tz) {
        const now = (0, dayjs_1.default)().tz(tz);
        const [hours, minutes] = time.split(':').map(Number);
        let next = now.day(dayOfWeek).hour(hours).minute(minutes).second(0);
        if (next.isBefore(now)) {
            next = next.add(1, 'week');
        }
        return next.toDate();
    }
    getScheduledCount() {
        return this.intervals.size;
    }
    getScheduledIds() {
        return Array.from(this.intervals.keys());
    }
}
exports.ReminderScheduler = ReminderScheduler;
