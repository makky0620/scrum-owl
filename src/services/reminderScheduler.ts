import { Reminder } from '../types/reminder';
import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export class ReminderScheduler {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  scheduleReminder(reminder: Reminder): void {
    if (!reminder.isActive) {
      return;
    }

    // Unschedule existing reminder if it exists
    this.unscheduleReminder(reminder.id);

    const nextOccurrence = this.getNextOccurrence(
      reminder.dayOfWeek,
      reminder.time,
      reminder.timezone
    );

    const delay = nextOccurrence.getTime() - Date.now();

    const timeout = setTimeout(async () => {
      await this.sendReminder(reminder);
      // Reschedule for next week
      this.scheduleReminder(reminder);
    }, delay);

    this.intervals.set(reminder.id, timeout);
  }

  unscheduleReminder(reminderId: string): void {
    const timeout = this.intervals.get(reminderId);
    if (timeout) {
      clearTimeout(timeout);
      this.intervals.delete(reminderId);
    }
  }

  rescheduleReminder(reminder: Reminder): void {
    this.unscheduleReminder(reminder.id);
    this.scheduleReminder(reminder);
  }

  isScheduled(reminderId: string): boolean {
    return this.intervals.has(reminderId);
  }

  async sendReminder(reminder: Reminder): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(reminder.channelId);
      
      if (!channel || !channel.isTextBased()) {
        console.error(`Channel ${reminder.channelId} not found or not text-based`);
        return;
      }

      const embed = new EmbedBuilder()
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
      const nextOccurrence = this.getNextOccurrence(
        reminder.dayOfWeek,
        reminder.time,
        reminder.timezone
      );
      
      embed.addFields({
        name: 'Next Reminder',
        value: `<t:${Math.floor(nextOccurrence.getTime() / 1000)}:F>`,
        inline: true
      });

      await (channel as TextChannel).send({ embeds: [embed] });
    } catch (error) {
      console.error(`Error sending reminder ${reminder.id}:`, error);
    }
  }

  scheduleAllReminders(reminders: Reminder[]): void {
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

  private getNextOccurrence(dayOfWeek: number, time: string, tz: string): Date {
    const now = dayjs().tz(tz);
    const [hours, minutes] = time.split(':').map(Number);
    
    let next = now.day(dayOfWeek).hour(hours).minute(minutes).second(0);
    
    if (next.isBefore(now)) {
      next = next.add(1, 'week');
    }
    
    return next.toDate();
  }

  getScheduledCount(): number {
    return this.intervals.size;
  }

  getScheduledIds(): string[] {
    return Array.from(this.intervals.keys());
  }
}