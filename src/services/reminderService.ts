import { Reminder, ReminderType, DayFilter } from '../models/reminder';
import { ReminderStorage } from '../utils/storage';
import dayjs from 'dayjs';
import { randomUUID } from 'crypto';

export interface CreateReminderData {
  userId: string;
  channelId: string;
  guildId: string;
  title: string;
  message: string;
  time: string;
  type: ReminderType;
  skipWeekends?: boolean;
}

export interface UpdateReminderData {
  id: string;
  title?: string;
  message?: string;
  time?: string;
  isActive?: boolean;
  dayFilter?: DayFilter;
}

export class ReminderService {
  private storage: ReminderStorage;

  constructor(storage?: ReminderStorage) {
    this.storage = storage || new ReminderStorage();
  }

  async createReminder(data: CreateReminderData): Promise<Reminder> {
    // Validate required fields
    this.validateRequiredFields(data);

    // Validate reminder type
    if (data.type !== 'once' && data.type !== 'daily') {
      throw new Error('Invalid reminder type. Only "once" and "daily" are supported.');
    }

    // Parse and validate time
    const nextTriggerTime = this.parseTimeString(data.time);

    // Validate past time for one-time reminders
    if (data.type === 'once' && dayjs(nextTriggerTime).isBefore(dayjs())) {
      throw new Error('Cannot set reminder for past time');
    }

    // Create day filter for daily reminders
    let dayFilter: DayFilter | undefined;
    if (data.type === 'daily') {
      dayFilter = {
        skipWeekends: data.skipWeekends || false
      };
    }

    const now = new Date();
    const reminder: Reminder = {
      id: this.generateId(),
      userId: data.userId,
      channelId: data.channelId,
      guildId: data.guildId,
      title: data.title,
      message: data.message,
      nextTriggerTime,
      type: data.type,
      dayFilter,
      isActive: true,
      createdAt: now,
      updatedAt: now
    };

    await this.storage.addReminder(reminder);
    return reminder;
  }

  async updateReminder(data: UpdateReminderData): Promise<Reminder> {
    const existingReminder = await this.storage.getReminderById(data.id);
    if (!existingReminder) {
      throw new Error('Reminder not found');
    }

    const updatedReminder: Reminder = {
      ...existingReminder,
      updatedAt: new Date()
    };

    // Update individual fields
    if (data.title !== undefined) updatedReminder.title = data.title;
    if (data.message !== undefined) updatedReminder.message = data.message;
    if (data.isActive !== undefined) updatedReminder.isActive = data.isActive;

    // Parse time if provided
    if (data.time) {
      updatedReminder.nextTriggerTime = this.parseTimeString(data.time);
    }

    // Update day filter if provided
    if (data.dayFilter) {
      updatedReminder.dayFilter = data.dayFilter;
      this.validateDayFilter(updatedReminder.dayFilter);
    }

    await this.storage.updateReminder(updatedReminder);
    return updatedReminder;
  }

  async deleteReminder(id: string): Promise<void> {
    await this.storage.deleteReminder(id);
  }

  async getUserReminders(userId: string): Promise<Reminder[]> {
    return await this.storage.getRemindersByUser(userId);
  }

  async getUserRemindersInGuild(userId: string, guildId: string): Promise<Reminder[]> {
    return await this.storage.getRemindersByUserAndGuild(userId, guildId);
  }

  parseTimeString(timeString: string): Date {
    // Handle relative time (e.g., "30m", "2h", "1d")
    const relativeTimeRegex = /^(\d+)([mhd])$/;
    const relativeMatch = timeString.match(relativeTimeRegex);

    if (relativeMatch) {
      const [, amount, unit] = relativeMatch;
      const unitMap = { m: 'minute', h: 'hour', d: 'day' };
      return dayjs().add(parseInt(amount), unitMap[unit as keyof typeof unitMap] as any).toDate();
    }

    // Handle absolute datetime (e.g., "2024-07-15 14:30")
    const absoluteDateTime = dayjs(timeString);
    if (absoluteDateTime.isValid()) {
      return absoluteDateTime.toDate();
    }

    // Handle time only (e.g., "14:30") - assume today, or tomorrow if time has passed
    const timeOnlyRegex = /^(\d{1,2}):(\d{2})$/;
    const timeMatch = timeString.match(timeOnlyRegex);

    if (timeMatch) {
      const [, hours, minutes] = timeMatch;
      let targetTime = dayjs().hour(parseInt(hours)).minute(parseInt(minutes)).second(0).millisecond(0);

      // If the time has already passed today, schedule for tomorrow
      if (targetTime.isBefore(dayjs())) {
        targetTime = targetTime.add(1, 'day');
      }

      return targetTime.toDate();
    }

    throw new Error('Invalid time format');
  }

  validateDayFilter(dayFilter: DayFilter): void {
    // Basic validation for day filter - currently only validates skipWeekends
    // Future extensions can add more validation logic here
  }

  generateId(): string {
    return randomUUID();
  }

  private validateRequiredFields(data: CreateReminderData): void {
    if (!data.userId || data.userId.trim() === '') {
      throw new Error('User ID is required');
    }
    if (!data.channelId || data.channelId.trim() === '') {
      throw new Error('Channel ID is required');
    }
    if (!data.guildId || data.guildId.trim() === '') {
      throw new Error('Guild ID is required');
    }
    if (!data.title || data.title.trim() === '') {
      throw new Error('Title is required');
    }
    if (!data.message || data.message.trim() === '') {
      throw new Error('Message is required');
    }
    if (!data.time || data.time.trim() === '') {
      throw new Error('Time is required');
    }
  }
}
