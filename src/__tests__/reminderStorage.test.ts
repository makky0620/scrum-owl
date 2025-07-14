import { ReminderStorage } from '../services/reminderStorage';
import { Reminder, CreateReminderData, Comment } from '../types/reminder';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('ReminderStorage', () => {
  let storage: ReminderStorage;
  const testDataPath = './test-data/reminders/';

  beforeEach(() => {
    storage = new ReminderStorage(testDataPath);
    jest.clearAllMocks();
  });

  describe('saveReminder', () => {
    it('should save a new reminder to file', async () => {
      const createData: CreateReminderData = {
        userId: 'user123',
        channelId: 'channel123',
        title: 'Daily Standup',
        description: 'Morning standup meeting',
        dayOfWeek: 1, // Monday
        time: '09:00',
        timezone: 'Asia/Tokyo'
      };

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.writeFile.mockResolvedValue(undefined);

      const reminder = await storage.saveReminder(createData);

      expect(reminder.id).toBeDefined();
      expect(reminder.userId).toBe('user123');
      expect(reminder.title).toBe('Daily Standup');
      expect(reminder.dayOfWeek).toBe(1);
      expect(reminder.time).toBe('09:00');
      expect(reminder.timezone).toBe('Asia/Tokyo');
      expect(reminder.isActive).toBe(true);
      expect(reminder.comments).toEqual([]);
      expect(reminder.createdAt).toBeDefined();
      expect(reminder.updatedAt).toBeDefined();

      expect(mockFs.mkdir).toHaveBeenCalledWith(testDataPath, { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should use default timezone when not provided', async () => {
      const createData: CreateReminderData = {
        userId: 'user123',
        channelId: 'channel123',
        title: 'Daily Standup',
        dayOfWeek: 1,
        time: '09:00'
      };

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.writeFile.mockResolvedValue(undefined);

      const reminder = await storage.saveReminder(createData);

      expect(reminder.timezone).toBe('Asia/Tokyo');
    });
  });

  describe('getReminder', () => {
    it('should return reminder by id', async () => {
      const mockReminders: Reminder[] = [{
        id: 'reminder123',
        userId: 'user123',
        channelId: 'channel123',
        title: 'Daily Standup',
        dayOfWeek: 1,
        time: '09:00',
        timezone: 'Asia/Tokyo',
        isActive: true,
        comments: [],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      }];

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockReminders));

      const reminder = await storage.getReminder('reminder123');

      expect(reminder).toBeDefined();
      expect(reminder?.id).toBe('reminder123');
      expect(reminder?.title).toBe('Daily Standup');
    });

    it('should return null when reminder not found', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify([]));

      const reminder = await storage.getReminder('nonexistent');

      expect(reminder).toBeNull();
    });
  });

  describe('getUserReminders', () => {
    it('should return all reminders for a user', async () => {
      const mockReminders: Reminder[] = [
        {
          id: 'reminder1',
          userId: 'user123',
          channelId: 'channel123',
          title: 'Daily Standup',
          dayOfWeek: 1,
          time: '09:00',
          timezone: 'Asia/Tokyo',
          isActive: true,
          comments: [],
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        },
        {
          id: 'reminder2',
          userId: 'user456',
          channelId: 'channel123',
          title: 'Other Meeting',
          dayOfWeek: 2,
          time: '10:00',
          timezone: 'Asia/Tokyo',
          isActive: true,
          comments: [],
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        }
      ];

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockReminders));

      const userReminders = await storage.getUserReminders('user123');

      expect(userReminders).toHaveLength(1);
      expect(userReminders[0].id).toBe('reminder1');
      expect(userReminders[0].userId).toBe('user123');
    });
  });

  describe('deleteReminder', () => {
    it('should remove reminder from storage', async () => {
      const mockReminders: Reminder[] = [{
        id: 'reminder123',
        userId: 'user123',
        channelId: 'channel123',
        title: 'Daily Standup',
        dayOfWeek: 1,
        time: '09:00',
        timezone: 'Asia/Tokyo',
        isActive: true,
        comments: [],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      }];

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockReminders));
      mockFs.writeFile.mockResolvedValue(undefined);

      await storage.deleteReminder('reminder123');

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(testDataPath, 'reminders.json'),
        JSON.stringify([], null, 2)
      );
    });
  });

  describe('addComment', () => {
    it('should add comment to existing reminder', async () => {
      const mockReminders: Reminder[] = [{
        id: 'reminder123',
        userId: 'user123',
        channelId: 'channel123',
        title: 'Daily Standup',
        dayOfWeek: 1,
        time: '09:00',
        timezone: 'Asia/Tokyo',
        isActive: true,
        comments: [],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      }];

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockReminders));
      mockFs.writeFile.mockResolvedValue(undefined);

      const comment = await storage.addComment('reminder123', 'user456', 'Great reminder!');

      expect(comment.id).toBeDefined();
      expect(comment.userId).toBe('user456');
      expect(comment.content).toBe('Great reminder!');
      expect(comment.createdAt).toBeDefined();

      expect(mockFs.writeFile).toHaveBeenCalled();
    });
  });
});