import { Reminder, CreateReminderData, UpdateReminderData, Comment } from '../types/reminder';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class ReminderStorage {
  private dataPath: string;
  private remindersFile: string;

  constructor(dataPath: string = './data/reminders/') {
    this.dataPath = dataPath;
    this.remindersFile = path.join(dataPath, 'reminders.json');
  }

  async saveReminder(createData: CreateReminderData): Promise<Reminder> {
    await this.ensureDataDirectory();

    const now = new Date().toISOString();
    const reminder: Reminder = {
      id: uuidv4(),
      userId: createData.userId,
      channelId: createData.channelId,
      title: createData.title,
      description: createData.description,
      dayOfWeek: createData.dayOfWeek,
      time: createData.time,
      timezone: createData.timezone || 'Asia/Tokyo',
      isActive: true,
      comments: [],
      createdAt: now,
      updatedAt: now
    };

    const reminders = await this.loadReminders();
    reminders.push(reminder);
    await this.saveReminders(reminders);

    return reminder;
  }

  async getReminder(id: string): Promise<Reminder | null> {
    const reminders = await this.loadReminders();
    return reminders.find(r => r.id === id) || null;
  }

  async getUserReminders(userId: string): Promise<Reminder[]> {
    const reminders = await this.loadReminders();
    return reminders.filter(r => r.userId === userId);
  }

  async updateReminder(id: string, updateData: UpdateReminderData): Promise<Reminder | null> {
    const reminders = await this.loadReminders();
    const reminderIndex = reminders.findIndex(r => r.id === id);

    if (reminderIndex === -1) {
      return null;
    }

    const reminder = reminders[reminderIndex];
    const updatedReminder: Reminder = {
      ...reminder,
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    reminders[reminderIndex] = updatedReminder;
    await this.saveReminders(reminders);

    return updatedReminder;
  }

  async deleteReminder(id: string): Promise<void> {
    const reminders = await this.loadReminders();
    const filteredReminders = reminders.filter(r => r.id !== id);
    await this.saveReminders(filteredReminders);
  }

  async addComment(reminderId: string, userId: string, content: string): Promise<Comment> {
    const reminders = await this.loadReminders();
    const reminderIndex = reminders.findIndex(r => r.id === reminderId);

    if (reminderIndex === -1) {
      throw new Error('Reminder not found');
    }

    const comment: Comment = {
      id: uuidv4(),
      userId,
      content,
      createdAt: new Date().toISOString()
    };

    reminders[reminderIndex].comments.push(comment);
    reminders[reminderIndex].updatedAt = new Date().toISOString();

    await this.saveReminders(reminders);

    return comment;
  }

  async getAllReminders(): Promise<Reminder[]> {
    return await this.loadReminders();
  }

  private async ensureDataDirectory(): Promise<void> {
    await fs.mkdir(this.dataPath, { recursive: true });
  }

  private async loadReminders(): Promise<Reminder[]> {
    try {
      const data = await fs.readFile(this.remindersFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // File doesn't exist or is invalid, return empty array
      return [];
    }
  }

  private async saveReminders(reminders: Reminder[]): Promise<void> {
    await fs.writeFile(this.remindersFile, JSON.stringify(reminders, null, 2));
  }
}