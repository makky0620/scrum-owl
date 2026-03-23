import { ReminderStorage } from '../utils/storage';
import { Reminder } from '../models/reminder';
import dayjs from 'dayjs';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
  }
}));

const mockReadFile = jest.mocked(fs.promises.readFile);
const mockWriteFile = jest.mocked(fs.promises.writeFile);
const mockMkdir = jest.mocked(fs.promises.mkdir);

describe('ReminderStorage', () => {
  let storage: ReminderStorage;
  const testDataPath = path.join(__dirname, '../../data/test-reminders.json');

  const mockReminder: Reminder = {
    id: 'test-id-1',
    userId: 'user123',
    channelId: 'channel123',
    guildId: 'guild123',
    title: 'Test Reminder',
    message: 'This is a test reminder',
    nextTriggerTime: dayjs().add(1, 'hour').toDate(),
    type: 'once',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    storage = new ReminderStorage(testDataPath);
    jest.clearAllMocks();
  });

  describe('loadReminders', () => {
    it('should return empty array when file does not exist', async () => {
      const enoentError = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      mockReadFile.mockRejectedValue(enoentError);

      const reminders = await storage.loadReminders();

      expect(reminders).toEqual([]);
    });

    it('should load reminders from existing file', async () => {
      const mockData = [mockReminder];
      mockReadFile.mockResolvedValue(JSON.stringify(mockData) as any);

      const reminders = await storage.loadReminders();

      expect(reminders).toHaveLength(1);
      expect(reminders[0].id).toBe('test-id-1');
      expect(mockReadFile).toHaveBeenCalledWith(testDataPath, 'utf8');
    });

    it('should handle corrupted JSON file gracefully', async () => {
      mockReadFile.mockResolvedValue('invalid json' as any);

      const reminders = await storage.loadReminders();

      expect(reminders).toEqual([]);
    });

    it('should convert date strings back to Date objects', async () => {
      const mockDataWithStringDates = [{
        ...mockReminder,
        nextTriggerTime: mockReminder.nextTriggerTime.toISOString(),
        createdAt: mockReminder.createdAt.toISOString(),
        updatedAt: mockReminder.updatedAt.toISOString()
      }];

      mockReadFile.mockResolvedValue(JSON.stringify(mockDataWithStringDates) as any);

      const reminders = await storage.loadReminders();

      expect(reminders[0].nextTriggerTime).toBeInstanceOf(Date);
      expect(reminders[0].createdAt).toBeInstanceOf(Date);
      expect(reminders[0].updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('saveReminders', () => {
    it('should create directory and save reminders', async () => {
      const reminders = [mockReminder];
      mockMkdir.mockResolvedValue(undefined as any);
      mockWriteFile.mockResolvedValue(undefined);

      await storage.saveReminders(reminders);

      expect(mockMkdir).toHaveBeenCalledWith(path.dirname(testDataPath), { recursive: true });
      expect(mockWriteFile).toHaveBeenCalledWith(
        testDataPath,
        JSON.stringify(reminders, null, 2),
        'utf8'
      );
    });

    it('should handle write errors gracefully', async () => {
      const reminders = [mockReminder];
      mockMkdir.mockResolvedValue(undefined as any);
      mockWriteFile.mockRejectedValue(new Error('Write failed'));

      await expect(storage.saveReminders(reminders)).rejects.toThrow('Write failed');
    });
  });

  describe('addReminder', () => {
    it('should add a new reminder to existing reminders', async () => {
      const existingReminders = [mockReminder];
      const newReminder: Reminder = {
        ...mockReminder,
        id: 'test-id-2',
        title: 'New Reminder'
      };

      mockReadFile.mockResolvedValue(JSON.stringify(existingReminders) as any);
      mockMkdir.mockResolvedValue(undefined as any);
      mockWriteFile.mockResolvedValue(undefined);

      await storage.addReminder(newReminder);

      expect(mockWriteFile).toHaveBeenCalledWith(
        testDataPath,
        expect.stringContaining('"id": "test-id-2"'),
        'utf8'
      );
    });
  });

  describe('updateReminder', () => {
    it('should update an existing reminder', async () => {
      const existingReminders = [mockReminder];
      const updatedReminder: Reminder = {
        ...mockReminder,
        title: 'Updated Title',
        updatedAt: new Date()
      };

      mockReadFile.mockResolvedValue(JSON.stringify(existingReminders) as any);
      mockMkdir.mockResolvedValue(undefined as any);
      mockWriteFile.mockResolvedValue(undefined);

      await storage.updateReminder(updatedReminder);

      expect(mockWriteFile).toHaveBeenCalledWith(
        testDataPath,
        expect.stringContaining('"title": "Updated Title"'),
        'utf8'
      );
    });

    it('should throw error if reminder not found', async () => {
      const existingReminders = [mockReminder];
      const nonExistentReminder: Reminder = {
        ...mockReminder,
        id: 'non-existent-id'
      };

      mockReadFile.mockResolvedValue(JSON.stringify(existingReminders) as any);

      await expect(storage.updateReminder(nonExistentReminder))
        .rejects.toThrow('Reminder with id non-existent-id not found');
    });
  });

  describe('deleteReminder', () => {
    it('should delete an existing reminder', async () => {
      const existingReminders = [mockReminder];

      mockReadFile.mockResolvedValue(JSON.stringify(existingReminders) as any);
      mockMkdir.mockResolvedValue(undefined as any);
      mockWriteFile.mockResolvedValue(undefined);

      await storage.deleteReminder('test-id-1');

      expect(mockWriteFile).toHaveBeenCalledWith(
        testDataPath,
        '[]',
        'utf8'
      );
    });

    it('should throw error if reminder not found', async () => {
      const existingReminders = [mockReminder];

      mockReadFile.mockResolvedValue(JSON.stringify(existingReminders) as any);

      await expect(storage.deleteReminder('non-existent-id'))
        .rejects.toThrow('Reminder with id non-existent-id not found');
    });
  });

  describe('getRemindersByUser', () => {
    it('should return reminders for specific user', async () => {
      const reminders = [
        mockReminder,
        { ...mockReminder, id: 'test-id-2', userId: 'user456' }
      ];

      mockReadFile.mockResolvedValue(JSON.stringify(reminders) as any);

      const userReminders = await storage.getRemindersByUser('user123');

      expect(userReminders).toHaveLength(1);
      expect(userReminders[0].userId).toBe('user123');
    });
  });

  describe('getActiveReminders', () => {
    it('should return only active reminders', async () => {
      const reminders = [
        mockReminder,
        { ...mockReminder, id: 'test-id-2', isActive: false }
      ];

      mockReadFile.mockResolvedValue(JSON.stringify(reminders) as any);

      const activeReminders = await storage.getActiveReminders();

      expect(activeReminders).toHaveLength(1);
      expect(activeReminders[0].isActive).toBe(true);
    });
  });

  describe('getRemindersByUserAndGuild', () => {
    it('should return reminders for specific user and guild', async () => {
      const reminders = [
        mockReminder, // user123, guild123
        { ...mockReminder, id: 'test-id-2', userId: 'user456', guildId: 'guild123' },
        { ...mockReminder, id: 'test-id-3', userId: 'user123', guildId: 'guild456' },
        { ...mockReminder, id: 'test-id-4', userId: 'user456', guildId: 'guild456' }
      ];

      mockReadFile.mockResolvedValue(JSON.stringify(reminders) as any);

      const userGuildReminders = await storage.getRemindersByUserAndGuild('user123', 'guild123');

      expect(userGuildReminders).toHaveLength(1);
      expect(userGuildReminders[0].userId).toBe('user123');
      expect(userGuildReminders[0].guildId).toBe('guild123');
      expect(userGuildReminders[0].id).toBe('test-id-1');
    });

    it('should return empty array when no reminders match user and guild', async () => {
      const reminders = [
        { ...mockReminder, userId: 'user456', guildId: 'guild456' }
      ];

      mockReadFile.mockResolvedValue(JSON.stringify(reminders) as any);

      const userGuildReminders = await storage.getRemindersByUserAndGuild('user123', 'guild123');

      expect(userGuildReminders).toHaveLength(0);
    });
  });
});
