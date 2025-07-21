import { Reminder } from '../models/reminder';
import * as fs from 'fs';
import * as path from 'path';

export class ReminderStorage {
  private dataPath: string;

  constructor(dataPath: string = path.join(__dirname, '../../data/reminders.json')) {
    this.dataPath = dataPath;
  }

  async loadReminders(): Promise<Reminder[]> {
    try {
      if (!fs.existsSync(this.dataPath)) {
        return [];
      }

      const data = fs.readFileSync(this.dataPath, 'utf8');
      const reminders = JSON.parse(data);

      // Convert date strings back to Date objects
      return reminders.map((reminder: any) => ({
        ...reminder,
        nextTriggerTime: new Date(reminder.nextTriggerTime),
        createdAt: new Date(reminder.createdAt),
        updatedAt: new Date(reminder.updatedAt),
        recurringConfig: reminder.recurringConfig ? {
          ...reminder.recurringConfig,
          endDate: reminder.recurringConfig.endDate ? new Date(reminder.recurringConfig.endDate) : undefined
        } : undefined
      }));
    } catch (error) {
      console.error('Error loading reminders:', error);
      return [];
    }
  }

  async saveReminders(reminders: Reminder[]): Promise<void> {
    try {
      const dir = path.dirname(this.dataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.dataPath, JSON.stringify(reminders, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving reminders:', error);
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
    const index = reminders.findIndex(r => r.id === updatedReminder.id);
    
    if (index === -1) {
      throw new Error(`Reminder with id ${updatedReminder.id} not found`);
    }

    reminders[index] = updatedReminder;
    await this.saveReminders(reminders);
  }

  async deleteReminder(id: string): Promise<void> {
    const reminders = await this.loadReminders();
    const index = reminders.findIndex(r => r.id === id);
    
    if (index === -1) {
      throw new Error(`Reminder with id ${id} not found`);
    }

    reminders.splice(index, 1);
    await this.saveReminders(reminders);
  }

  async getRemindersByUser(userId: string): Promise<Reminder[]> {
    const reminders = await this.loadReminders();
    return reminders.filter(r => r.userId === userId);
  }

  async getRemindersByUserAndGuild(userId: string, guildId: string): Promise<Reminder[]> {
    const reminders = await this.loadReminders();
    return reminders.filter(r => r.userId === userId && r.guildId === guildId);
  }

  async getActiveReminders(): Promise<Reminder[]> {
    const reminders = await this.loadReminders();
    return reminders.filter(r => r.isActive);
  }

  async getReminderById(id: string): Promise<Reminder | undefined> {
    const reminders = await this.loadReminders();
    return reminders.find(r => r.id === id);
  }
}