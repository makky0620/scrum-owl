import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { ReminderStorage } from '../utils/storage';
import { Reminder, DayFilter } from '../models/reminder';
import dayjs from 'dayjs';

export class ReminderScheduler {
  private client: Client;
  private storage: ReminderStorage;
  private intervalId: NodeJS.Timeout | null = null;
  private isSchedulerRunning = false;
  private readonly checkInterval = 60000; // 1 minute

  constructor(client: Client, storage?: ReminderStorage) {
    this.client = client;
    this.storage = storage || new ReminderStorage();
  }

  async start(): Promise<void> {
    if (this.isSchedulerRunning) {
      return;
    }

    console.log('[ReminderScheduler] Starting reminder scheduler...');

    // Load existing reminders
    await this.storage.getActiveReminders();

    // Start the interval
    this.intervalId = setInterval(() => {
      this.checkReminders().catch(error => {
        console.error('[ReminderScheduler] Error checking reminders:', error);
      });
    }, this.checkInterval);

    this.isSchedulerRunning = true;
    console.log('[ReminderScheduler] Reminder scheduler started');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isSchedulerRunning = false;
    console.log('[ReminderScheduler] Reminder scheduler stopped');
  }

  isRunning(): boolean {
    return this.isSchedulerRunning;
  }

  async checkReminders(): Promise<void> {
    try {
      const activeReminders = await this.storage.getActiveReminders();
      const now = new Date();

      for (const reminder of activeReminders) {
        if (dayjs(reminder.nextTriggerTime).isBefore(now) || dayjs(reminder.nextTriggerTime).isSame(now, 'minute')) {
          // Check if reminder should trigger today (day filter)
          if (!this.shouldTriggerToday(reminder)) {
            // Skip to next valid day for daily reminders
            if (reminder.type === 'daily') {
              await this.processRecurringReminder(reminder);
            }
            continue;
          }

          await this.triggerReminder(reminder);
        }
      }
    } catch (error) {
      console.error('[ReminderScheduler] Error in checkReminders:', error);
    }
  }

  shouldTriggerToday(reminder: Reminder): boolean {
    if (!reminder.dayFilter) {
      return true;
    }

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sunday, 6=Saturday
    const filter = reminder.dayFilter;

    // Check skip weekends
    if (filter.skipWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
      return false;
    }

    return true;
  }

  calculateNextTriggerTime(reminder: Reminder): Date {
    if (reminder.type === 'once') {
      return reminder.nextTriggerTime;
    }

    let nextTime = dayjs(reminder.nextTriggerTime);

    // Calculate base next time (only daily is supported for recurring reminders)
    if (reminder.type === 'daily') {
      nextTime = nextTime.add(1, 'day');
    }

    // Apply day filter if present
    if (reminder.dayFilter) {
      nextTime = this.findNextValidDay(nextTime, reminder.dayFilter);
    }

    return nextTime.toDate();
  }

  private findNextValidDay(startTime: dayjs.Dayjs, dayFilter: DayFilter): dayjs.Dayjs {
    let currentTime = startTime;
    let attempts = 0;
    const maxAttempts = 14; // Prevent infinite loop

    while (attempts < maxAttempts) {
      const dayOfWeek = currentTime.day();

      // Check skip weekends
      if (dayFilter.skipWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
        currentTime = currentTime.add(1, 'day');
        attempts++;
        continue;
      }

      // Valid day found
      break;
    }

    return currentTime;
  }

  async triggerReminder(reminder: Reminder): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(reminder.channelId) as TextChannel;

      if (!channel) {
        console.error(`[ReminderScheduler] Channel ${reminder.channelId} not found`);
        return;
      }

      const message = this.formatReminderMessage(reminder);
      await channel.send({ embeds: [ message ] });

      console.log(`[ReminderScheduler] Triggered reminder: ${reminder.title} for user ${reminder.userId}`);

      // Handle post-trigger processing
      if (reminder.type === 'once') {
        await this.deactivateReminder(reminder);
      } else {
        await this.processRecurringReminder(reminder);
      }
    } catch (error) {
      console.error(`[ReminderScheduler] Error triggering reminder ${reminder.id}:`, error);
    }
  }

  async processRecurringReminder(reminder: Reminder): Promise<void> {
    // Update for next occurrence
    const updatedReminder: Reminder = {
      ...reminder,
      nextTriggerTime: this.calculateNextTriggerTime(reminder),
      updatedAt: new Date(),
    };

    await this.storage.updateReminder(updatedReminder);
  }

  async deactivateReminder(reminder: Reminder): Promise<void> {
    const updatedReminder: Reminder = {
      ...reminder,
      isActive: false,
      updatedAt: new Date(),
    };

    await this.storage.updateReminder(updatedReminder);
    console.log(`[ReminderScheduler] Deactivated reminder: ${reminder.title}`);
  }

  formatReminderMessage(reminder: Reminder): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`🔔 ${reminder.title}`)
      .setDescription(reminder.message)
      .setTimestamp()
      .setFooter({ text: 'Scrum Owl Reminder' });

    // Add type information for daily reminders
    if (reminder.type === 'daily') {
      embed.addFields(
        { name: 'Type', value: 'Daily reminder', inline: true }
      );
    }

    return embed;
  }
}
