import { Reminder, ReminderType, RecurringConfig, DayFilter } from '../models/reminder';
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
  recurringConfig?: Partial<RecurringConfig>;
}

export interface UpdateReminderData {
  id: string;
  title?: string;
  message?: string;
  time?: string;
  isActive?: boolean;
  recurringConfig?: Partial<RecurringConfig>;
}

export class ReminderService {
  private storage: ReminderStorage;

  constructor(storage?: ReminderStorage) {
    this.storage = storage || new ReminderStorage();
  }

  async createReminder(data: CreateReminderData): Promise<Reminder> {
    // Validate required fields
    this.validateRequiredFields(data);

    // Parse and validate time
    const nextTriggerTime = this.parseTimeString(data.time);

    // Validate past time for one-time reminders
    if (data.type === 'once' && dayjs(nextTriggerTime).isBefore(dayjs())) {
      throw new Error('Cannot set reminder for past time');
    }

    // Validate recurring config if provided
    let recurringConfig: RecurringConfig | undefined;
    if (data.type === 'recurring' && data.recurringConfig) {
      recurringConfig = {
        interval: data.recurringConfig.interval || 'daily',
        currentCount: 0,
        ...data.recurringConfig
      };

      if (recurringConfig.dayFilter) {
        this.validateDayFilter(recurringConfig.dayFilter);
      }
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
      recurringConfig,
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

    // Update recurring config if provided
    if (data.recurringConfig && existingReminder.recurringConfig) {
      updatedReminder.recurringConfig = {
        ...existingReminder.recurringConfig,
        ...data.recurringConfig
      };

      // Validate day filter if updated
      if (updatedReminder.recurringConfig.dayFilter) {
        this.validateDayFilter(updatedReminder.recurringConfig.dayFilter);
      }
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
    // Check for invalid day numbers
    if (dayFilter.allowedDays) {
      for (const day of dayFilter.allowedDays) {
        if (day < 0 || day > 6) {
          throw new Error('Invalid day number. Days must be 0-6 (0=Sunday, 6=Saturday)');
        }
      }

      // Check for conflicting settings
      if (dayFilter.skipWeekends) {
        const hasOnlyWeekends = dayFilter.allowedDays.every(day => day === 0 || day === 6);
        if (hasOnlyWeekends) {
          throw new Error('Cannot skip weekends and only allow weekends');
        }
      }
    }
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
