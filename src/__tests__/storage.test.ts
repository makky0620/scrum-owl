import { ReminderStorage } from '../utils/storage';
import { Reminder } from '../models/reminder';
import dayjs from 'dayjs';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

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
      mockedFs.existsSync.mockReturnValue(false);
      
      const reminders = await storage.loadReminders();
      
      expect(reminders).toEqual([]);
      expect(mockedFs.existsSync).toHaveBeenCalledWith(testDataPath);
    });

    it('should load reminders from existing file', async () => {
      const mockData = [mockReminder];
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockData));
      
      const reminders = await storage.loadReminders();
      
      expect(reminders).toHaveLength(1);
      expect(reminders[0].id).toBe('test-id-1');
      expect(mockedFs.readFileSync).toHaveBeenCalledWith(testDataPath, 'utf8');
    });

    it('should handle corrupted JSON file gracefully', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('invalid json');
      
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
      
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockDataWithStringDates));
      
      const reminders = await storage.loadReminders();
      
      expect(reminders[0].nextTriggerTime).toBeInstanceOf(Date);
      expect(reminders[0].createdAt).toBeInstanceOf(Date);
      expect(reminders[0].updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('saveReminders', () => {
    it('should create directory if it does not exist', async () => {
      const reminders = [mockReminder];
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockImplementation();
      mockedFs.writeFileSync.mockImplementation();
      
      await storage.saveReminders(reminders);
      
      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(path.dirname(testDataPath), { recursive: true });
    });

    it('should save reminders to file', async () => {
      const reminders = [mockReminder];
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.writeFileSync.mockImplementation();
      
      await storage.saveReminders(reminders);
      
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        testDataPath,
        JSON.stringify(reminders, null, 2),
        'utf8'
      );
    });

    it('should handle write errors gracefully', async () => {
      const reminders = [mockReminder];
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });
      
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
      
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(existingReminders));
      mockedFs.writeFileSync.mockImplementation();
      
      await storage.addReminder(newReminder);
      
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
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
      
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(existingReminders));
      mockedFs.writeFileSync.mockImplementation();
      
      await storage.updateReminder(updatedReminder);
      
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
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
      
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(existingReminders));
      
      await expect(storage.updateReminder(nonExistentReminder))
        .rejects.toThrow('Reminder with id non-existent-id not found');
    });
  });

  describe('deleteReminder', () => {
    it('should delete an existing reminder', async () => {
      const existingReminders = [mockReminder];
      
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(existingReminders));
      mockedFs.writeFileSync.mockImplementation();
      
      await storage.deleteReminder('test-id-1');
      
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        testDataPath,
        '[]',
        'utf8'
      );
    });

    it('should throw error if reminder not found', async () => {
      const existingReminders = [mockReminder];
      
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(existingReminders));
      
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
      
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(reminders));
      
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
      
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(reminders));
      
      const activeReminders = await storage.getActiveReminders();
      
      expect(activeReminders).toHaveLength(1);
      expect(activeReminders[0].isActive).toBe(true);
    });
  });

  describe('getRemindersByUserAndGuild', () => {
    it('should return reminders for specific user and guild', async () => {
      const reminders = [
        mockReminder, // user123, guild123
        { ...mockReminder, id: 'test-id-2', userId: 'user456', guildId: 'guild123' }, // different user, same guild
        { ...mockReminder, id: 'test-id-3', userId: 'user123', guildId: 'guild456' }, // same user, different guild
        { ...mockReminder, id: 'test-id-4', userId: 'user456', guildId: 'guild456' }  // different user, different guild
      ];
      
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(reminders));
      
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
      
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(reminders));
      
      const userGuildReminders = await storage.getRemindersByUserAndGuild('user123', 'guild123');
      
      expect(userGuildReminders).toHaveLength(0);
    });
  });
});