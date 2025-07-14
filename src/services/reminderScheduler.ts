import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { ReminderStorage } from '../utils/storage';
import { Reminder } from '../models/reminder';
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
            // Skip to next valid day for recurring reminders
            if (reminder.type === 'recurring') {
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
    if (!reminder.recurringConfig?.dayFilter) {
      return true;
    }

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sunday, 6=Saturday
    const filter = reminder.recurringConfig.dayFilter;

    // Check skip weekends
    if (filter.skipWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
      return false;
    }

    // Check allowed days
    if (filter.allowedDays && !filter.allowedDays.includes(dayOfWeek)) {
      return false;
    }

    return true;
  }

  calculateNextTriggerTime(reminder: Reminder): Date {
    if (!reminder.recurringConfig) {
      return reminder.nextTriggerTime;
    }

    let nextTime = dayjs(reminder.nextTriggerTime);
    const config = reminder.recurringConfig;

    // Calculate base next time based on interval
    switch (config.interval) {
      case 'daily':
        nextTime = nextTime.add(1, 'day');
        break;
      case 'weekly':
        nextTime = nextTime.add(1, 'week');
        break;
      case 'monthly':
        nextTime = nextTime.add(1, 'month');
        break;
      case 'custom':
        if (config.customInterval) {
          nextTime = nextTime.add(config.customInterval, 'minute');
        }
        break;
    }

    // Apply day filter if present
    if (config.dayFilter) {
      nextTime = this.findNextValidDay(nextTime, config.dayFilter);
    }

    return nextTime.toDate();
  }

  private findNextValidDay(startTime: dayjs.Dayjs, dayFilter: any): dayjs.Dayjs {
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

      // Check allowed days
      if (dayFilter.allowedDays && !dayFilter.allowedDays.includes(dayOfWeek)) {
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
      await channel.send(message);

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
    if (!reminder.recurringConfig) {
      return;
    }

    const config = reminder.recurringConfig;
    const newCount = config.currentCount + 1;

    // Check if reminder should be deactivated
    const shouldDeactivate = 
      (config.maxOccurrences && newCount >= config.maxOccurrences) ||
      (config.endDate && dayjs().isAfter(config.endDate));

    if (shouldDeactivate) {
      await this.deactivateReminder(reminder);
      return;
    }

    // Update for next occurrence
    const updatedReminder: Reminder = {
      ...reminder,
      nextTriggerTime: this.calculateNextTriggerTime(reminder),
      recurringConfig: {
        ...config,
        currentCount: newCount
      },
      updatedAt: new Date()
    };

    await this.storage.updateReminder(updatedReminder);
  }

  async deactivateReminder(reminder: Reminder): Promise<void> {
    const updatedReminder: Reminder = {
      ...reminder,
      isActive: false,
      updatedAt: new Date()
    };

    await this.storage.updateReminder(updatedReminder);
    console.log(`[ReminderScheduler] Deactivated reminder: ${reminder.title}`);
  }

  formatReminderMessage(reminder: Reminder): { content: string; embeds: EmbedBuilder[] } {
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`🔔 ${reminder.title}`)
      .setDescription(reminder.message)
      .setTimestamp()
      .setFooter({ text: 'Scrum Owl Reminder' });

    // Add recurring information
    if (reminder.type === 'recurring' && reminder.recurringConfig) {
      const config = reminder.recurringConfig;
      const intervalText = config.interval.charAt(0).toUpperCase() + config.interval.slice(1);
      const occurrenceText = `Occurrence: ${config.currentCount + 1}`;

      embed.addFields(
        { name: 'Type', value: `${intervalText} reminder`, inline: true },
        { name: 'Count', value: occurrenceText, inline: true }
      );

      if (config.maxOccurrences) {
        embed.addFields({ 
          name: 'Progress', 
          value: `${config.currentCount + 1}/${config.maxOccurrences}`, 
          inline: true 
        });
      }
    }

    return {
      content: `<@${reminder.userId}>`,
      embeds: [embed]
    };
  }
}
