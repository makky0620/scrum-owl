import { Reminder } from '../models/reminder';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

interface StoredReminder {
  nextTriggerTime: string;
  createdAt: string;
  updatedAt: string;
  recurringConfig?: {
    endDate?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export class ReminderStorage {
  private dataPath: string;

  constructor(dataPath: string = path.join(__dirname, '../../data/reminders.json')) {
    this.dataPath = dataPath;
  }

  async loadReminders(): Promise<Reminder[]> {
    try {
      const data = await fs.promises.readFile(this.dataPath, 'utf8');
      const reminders = JSON.parse(data) as StoredReminder[];

      return reminders.map((reminder) => ({
        ...reminder,
        nextTriggerTime: new Date(reminder.nextTriggerTime),
        createdAt: new Date(reminder.createdAt),
        updatedAt: new Date(reminder.updatedAt),
        recurringConfig: reminder.recurringConfig
          ? {
              ...reminder.recurringConfig,
              endDate: reminder.recurringConfig.endDate
                ? new Date(reminder.recurringConfig.endDate)
                : undefined,
            }
          : undefined,
      })) as unknown as Reminder[];
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      logger.error('Error loading reminders:', error);
      return [];
    }
  }

  async saveReminders(reminders: Reminder[]): Promise<void> {
    try {
      const dir = path.dirname(this.dataPath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(this.dataPath, JSON.stringify(reminders, null, 2), 'utf8');
    } catch (error) {
      logger.error('Error saving reminders:', error);
      throw error;
    }
  }

  async addReminder(reminder: Reminder): Promise<void> {
    const reminders = await this.loadReminders();
    reminders.push(reminder);
    await this.saveReminders(reminders);
  }

  async updateReminder(updatedReminder: Reminder): Promise<void> {
    const reminders = await this.loadReminders();
    const index = reminders.findIndex((r) => r.id === updatedReminder.id);

    if (index === -1) {
      throw new Error(`Reminder with id ${updatedReminder.id} not found`);
    }

    reminders[index] = updatedReminder;
    await this.saveReminders(reminders);
  }

  async deleteReminder(id: string): Promise<void> {
    const reminders = await this.loadReminders();
    const index = reminders.findIndex((r) => r.id === id);

    if (index === -1) {
      throw new Error(`Reminder with id ${id} not found`);
    }

    reminders.splice(index, 1);
    await this.saveReminders(reminders);
  }

  async getRemindersByUser(userId: string): Promise<Reminder[]> {
    const reminders = await this.loadReminders();
    return reminders.filter((r) => r.userId === userId);
  }

  async getRemindersByUserAndGuild(userId: string, guildId: string): Promise<Reminder[]> {
    const reminders = await this.loadReminders();
    return reminders.filter((r) => r.userId === userId && r.guildId === guildId);
  }

  async getActiveReminders(): Promise<Reminder[]> {
    const reminders = await this.loadReminders();
    return reminders.filter((r) => r.isActive);
  }

  async getReminderById(id: string): Promise<Reminder | undefined> {
    const reminders = await this.loadReminders();
    return reminders.find((r) => r.id === id);
  }
}
