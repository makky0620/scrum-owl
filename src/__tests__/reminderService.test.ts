import { ReminderService } from '../services/reminderService';
import { ReminderStorage } from '../utils/storage';
import { Reminder } from '../models/reminder';
import dayjs from 'dayjs';

// Mock the storage
jest.mock('../utils/storage');
const MockedReminderStorage = ReminderStorage as jest.MockedClass<typeof ReminderStorage>;

describe('ReminderService', () => {
  let reminderService: ReminderService;
  let mockStorage: jest.Mocked<ReminderStorage>;

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
    mockStorage = new MockedReminderStorage() as jest.Mocked<ReminderStorage>;
    reminderService = new ReminderService(mockStorage);
    jest.clearAllMocks();
  });

  describe('createReminder', () => {
    it('should create a one-time reminder with valid data', async () => {
      const futureTime = dayjs().add(1, 'hour').format('YYYY-MM-DD HH:mm');
      const reminderData = {
        userId: 'user123',
        channelId: 'channel123',
        guildId: 'guild123',
        title: 'Test Reminder',
        message: 'This is a test reminder',
        time: futureTime,
        type: 'once' as const
      };

      mockStorage.addReminder.mockResolvedValue();

      const result = await reminderService.createReminder(reminderData);

      expect(result.id).toBeDefined();
      expect(result.title).toBe('Test Reminder');
      expect(result.type).toBe('once');
      expect(result.isActive).toBe(true);
      expect(mockStorage.addReminder).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Test Reminder',
        type: 'once'
      }));
    });

    it('should create a daily reminder with skip weekends option', async () => {
      const reminderData = {
        userId: 'user123',
        channelId: 'channel123',
        guildId: 'guild123',
        title: 'Daily Standup',
        message: 'Time for standup!',
        time: '09:00',
        type: 'daily' as const,
        skipWeekends: true
      };

      mockStorage.addReminder.mockResolvedValue();

      const result = await reminderService.createReminder(reminderData);

      expect(result.type).toBe('daily');
      expect(result.dayFilter?.skipWeekends).toBe(true);
    });

    it('should create a daily reminder without skip weekends option', async () => {
      const reminderData = {
        userId: 'user123',
        channelId: 'channel123',
        guildId: 'guild123',
        title: 'Daily Report',
        message: 'Time to write daily report!',
        time: '17:00',
        type: 'daily' as const
      };

      mockStorage.addReminder.mockResolvedValue();

      const result = await reminderService.createReminder(reminderData);

      expect(result.type).toBe('daily');
      expect(result.dayFilter?.skipWeekends).toBe(false);
    });

    it('should reject weekly and monthly reminder types', async () => {
      const weeklyReminderData = {
        userId: 'user123',
        channelId: 'channel123',
        guildId: 'guild123',
        title: 'Weekly Meeting',
        message: 'Time for weekly meeting!',
        time: '09:00',
        type: 'weekly' as any
      };

      await expect(reminderService.createReminder(weeklyReminderData))
        .rejects.toThrow('Invalid reminder type. Only "once" and "daily" are supported.');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        userId: 'user123',
        channelId: 'channel123',
        guildId: 'guild123',
        title: '',
        message: 'Test message',
        time: '2024-07-15 14:30',
        type: 'once' as const
      };

      await expect(reminderService.createReminder(invalidData))
        .rejects.toThrow('Title is required');
    });

    it('should validate time format', async () => {
      const invalidData = {
        userId: 'user123',
        channelId: 'channel123',
        guildId: 'guild123',
        title: 'Test',
        message: 'Test message',
        time: 'invalid-time',
        type: 'once' as const
      };

      await expect(reminderService.createReminder(invalidData))
        .rejects.toThrow('Invalid time format');
    });

    it('should validate past time for one-time reminders', async () => {
      const pastTime = dayjs().subtract(1, 'hour').format('YYYY-MM-DD HH:mm');
      const invalidData = {
        userId: 'user123',
        channelId: 'channel123',
        guildId: 'guild123',
        title: 'Test',
        message: 'Test message',
        time: pastTime,
        type: 'once' as const
      };

      await expect(reminderService.createReminder(invalidData))
        .rejects.toThrow('Cannot set reminder for past time');
    });

  });

  describe('updateReminder', () => {
    it('should update an existing reminder', async () => {
      const updatedData = {
        id: 'test-id-1',
        title: 'Updated Title',
        message: 'Updated message'
      };

      mockStorage.getReminderById.mockResolvedValue(mockReminder);
      mockStorage.updateReminder.mockResolvedValue();

      const result = await reminderService.updateReminder(updatedData);

      expect(result.title).toBe('Updated Title');
      expect(result.message).toBe('Updated message');
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(mockStorage.updateReminder).toHaveBeenCalled();
    });

    it('should throw error if reminder not found', async () => {
      mockStorage.getReminderById.mockResolvedValue(undefined);

      await expect(reminderService.updateReminder({ id: 'non-existent' }))
        .rejects.toThrow('Reminder not found');
    });
  });

  describe('deleteReminder', () => {
    it('should delete a reminder by id', async () => {
      mockStorage.deleteReminder.mockResolvedValue();

      await reminderService.deleteReminder('test-id-1');

      expect(mockStorage.deleteReminder).toHaveBeenCalledWith('test-id-1');
    });
  });

  describe('getUserReminders', () => {
    it('should return reminders for a specific user', async () => {
      const userReminders = [mockReminder];
      mockStorage.getRemindersByUser.mockResolvedValue(userReminders);

      const result = await reminderService.getUserReminders('user123');

      expect(result).toEqual(userReminders);
      expect(mockStorage.getRemindersByUser).toHaveBeenCalledWith('user123');
    });
  });

  describe('getUserRemindersInGuild', () => {
    it('should return reminders for a specific user in a specific guild', async () => {
      const userGuildReminders = [mockReminder];
      mockStorage.getRemindersByUserAndGuild.mockResolvedValue(userGuildReminders);

      const result = await reminderService.getUserRemindersInGuild('user123', 'guild123');

      expect(result).toEqual(userGuildReminders);
      expect(mockStorage.getRemindersByUserAndGuild).toHaveBeenCalledWith('user123', 'guild123');
    });

    it('should return empty array when no reminders found for user in guild', async () => {
      mockStorage.getRemindersByUserAndGuild.mockResolvedValue([]);

      const result = await reminderService.getUserRemindersInGuild('user123', 'guild123');

      expect(result).toEqual([]);
      expect(mockStorage.getRemindersByUserAndGuild).toHaveBeenCalledWith('user123', 'guild123');
    });
  });

  describe('parseTimeString', () => {
    it('should parse relative time strings', () => {
      const result = reminderService.parseTimeString('30m');
      const expected = dayjs().add(30, 'minute');

      expect(dayjs(result).diff(expected, 'minute')).toBeLessThan(1);
    });

    it('should parse absolute time strings', () => {
      const result = reminderService.parseTimeString('2024-07-15 14:30');
      const expected = dayjs('2024-07-15 14:30');

      expect(dayjs(result).isSame(expected)).toBe(true);
    });

    it('should parse time-only strings for today', () => {
      const result = reminderService.parseTimeString('14:30');
      const resultDayjs = dayjs(result);

      expect(resultDayjs.hour()).toBe(14);
      expect(resultDayjs.minute()).toBe(30);
      expect(resultDayjs.second()).toBe(0);

      // Should be either today or tomorrow depending on current time
      const today = dayjs().hour(14).minute(30).second(0).millisecond(0);
      const tomorrow = today.add(1, 'day');

      const isToday = resultDayjs.isSame(today, 'minute');
      const isTomorrow = resultDayjs.isSame(tomorrow, 'minute');

      expect(isToday || isTomorrow).toBe(true);
    });

    it('should throw error for invalid time format', () => {
      expect(() => reminderService.parseTimeString('invalid'))
        .toThrow('Invalid time format');
    });
  });

  describe('validateDayFilter', () => {
    it('should validate day filter with skipWeekends', () => {
      const validFilter = {
        skipWeekends: true
      };

      expect(() => reminderService.validateDayFilter(validFilter)).not.toThrow();
    });

    it('should validate day filter without skipWeekends', () => {
      const validFilter = {
        skipWeekends: false
      };

      expect(() => reminderService.validateDayFilter(validFilter)).not.toThrow();
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = reminderService.generateId();
      const id2 = reminderService.generateId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });
  });
});
