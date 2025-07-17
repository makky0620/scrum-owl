import { ReminderScheduler } from '../services/reminderScheduler';
import { ReminderStorage } from '../utils/storage';
import { Reminder } from '../models/reminder';
import { Client } from 'discord.js';
import dayjs from 'dayjs';

// Mock dependencies
jest.mock('../utils/storage');

const MockedReminderStorage = ReminderStorage as jest.MockedClass<typeof ReminderStorage>;

describe('ReminderScheduler', () => {
  let scheduler: ReminderScheduler;
  let mockStorage: jest.Mocked<ReminderStorage>;
  let mockClient: jest.Mocked<Client>;
  let mockChannel: any;

  const mockReminder: Reminder = {
    id: 'test-id-1',
    userId: 'user123',
    channelId: 'channel123',
    guildId: 'guild123',
    title: 'Test Reminder',
    message: 'This is a test reminder',
    nextTriggerTime: dayjs().add(1, 'minute').toDate(),
    type: 'once',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    mockStorage = new MockedReminderStorage() as jest.Mocked<ReminderStorage>;

    mockChannel = {
      send: jest.fn().mockResolvedValue({}),
      guild: { id: 'guild123' }
    };

    mockClient = {
      channels: {
        fetch: jest.fn().mockResolvedValue(mockChannel)
      }
    } as any;

    scheduler = new ReminderScheduler(mockClient, mockStorage);
    jest.clearAllMocks();
  });

  afterEach(() => {
    scheduler.stop();
  });

  describe('start', () => {
    it('should start the scheduler and load existing reminders', async () => {
      const reminders = [mockReminder];
      mockStorage.getActiveReminders.mockResolvedValue(reminders);

      await scheduler.start();

      expect(mockStorage.getActiveReminders).toHaveBeenCalled();
      expect(scheduler.isRunning()).toBe(true);
    });

    it('should not start if already running', async () => {
      mockStorage.getActiveReminders.mockResolvedValue([]);

      await scheduler.start();
      const firstCall = mockStorage.getActiveReminders.mock.calls.length;

      await scheduler.start(); // Try to start again

      expect(mockStorage.getActiveReminders).toHaveBeenCalledTimes(firstCall);
    });
  });

  describe('stop', () => {
    it('should stop the scheduler', async () => {
      mockStorage.getActiveReminders.mockResolvedValue([]);

      await scheduler.start();
      expect(scheduler.isRunning()).toBe(true);

      scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
    });
  });

  describe('checkReminders', () => {
    it('should trigger reminders that are due', async () => {
      const dueReminder = {
        ...mockReminder,
        nextTriggerTime: dayjs().subtract(1, 'minute').toDate()
      };

      mockStorage.getActiveReminders.mockResolvedValue([dueReminder]);

      await scheduler.checkReminders();

      expect(mockClient.channels.fetch).toHaveBeenCalledWith('channel123');
      expect(mockChannel.send).toHaveBeenCalled();
    });

    it('should not trigger reminders that are not due', async () => {
      const futureReminder = {
        ...mockReminder,
        nextTriggerTime: dayjs().add(1, 'hour').toDate()
      };

      mockStorage.getActiveReminders.mockResolvedValue([futureReminder]);

      await scheduler.checkReminders();

      expect(mockClient.channels.fetch).not.toHaveBeenCalled();
      expect(mockChannel.send).not.toHaveBeenCalled();
    });

    it('should handle channel fetch errors gracefully', async () => {
      const dueReminder = {
        ...mockReminder,
        nextTriggerTime: dayjs().subtract(1, 'minute').toDate()
      };

      mockStorage.getActiveReminders.mockResolvedValue([dueReminder]);
      (mockClient.channels.fetch as jest.Mock).mockRejectedValue(new Error('Channel not found'));

      await expect(scheduler.checkReminders()).resolves.not.toThrow();
    });
  });

  describe('shouldTriggerToday', () => {
    it('should return true for reminders without day filter', () => {
      const reminder = { ...mockReminder };

      expect(scheduler.shouldTriggerToday(reminder)).toBe(true);
    });

    it('should skip weekends when skipWeekends is true', () => {
      const weekendReminder = {
        ...mockReminder,
        type: 'daily' as const,
        recurringConfig: {
          interval: 'daily' as const,
          currentCount: 0,
          dayFilter: {
            skipWeekends: true
          }
        }
      };

      // Mock Saturday (6) and Sunday (0)
      jest.spyOn(Date.prototype, 'getDay')
        .mockReturnValueOnce(6) // Saturday
        .mockReturnValueOnce(0); // Sunday

      expect(scheduler.shouldTriggerToday(weekendReminder)).toBe(false);
      expect(scheduler.shouldTriggerToday(weekendReminder)).toBe(false);
    });

    it('should allow weekdays when skipWeekends is true', () => {
      const weekdayReminder = {
        ...mockReminder,
        type: 'daily' as const,
        recurringConfig: {
          interval: 'daily' as const,
          currentCount: 0,
          dayFilter: {
            skipWeekends: true
          }
        }
      };

      // Mock Monday (1)
      jest.spyOn(Date.prototype, 'getDay').mockReturnValue(1);

      expect(scheduler.shouldTriggerToday(weekdayReminder)).toBe(true);
    });

  });

  describe('calculateNextTriggerTime', () => {
    it('should calculate next daily trigger time', () => {
      const dailyReminder = {
        ...mockReminder,
        type: 'daily' as const,
        recurringConfig: {
          interval: 'daily' as const,
          currentCount: 0
        }
      };

      const result = scheduler.calculateNextTriggerTime(dailyReminder);
      const expected = dayjs(mockReminder.nextTriggerTime).add(1, 'day');

      expect(dayjs(result).isSame(expected, 'minute')).toBe(true);
    });


    it('should skip to next valid day when day filter is applied', () => {
      const weekdayOnlyReminder = {
        ...mockReminder,
        type: 'daily' as const,
        nextTriggerTime: dayjs().day(5).toDate(), // Friday
        recurringConfig: {
          interval: 'daily' as const,
          currentCount: 0,
          dayFilter: {
            skipWeekends: true
          }
        }
      };

      const result = scheduler.calculateNextTriggerTime(weekdayOnlyReminder);
      const resultDay = dayjs(result).day();

      // Should skip weekend and go to Monday (1)
      expect(resultDay).toBe(1);
    });
  });

  describe('processRecurringReminder', () => {
    it('should update daily reminder for next occurrence', async () => {
      const dailyReminder = {
        ...mockReminder,
        type: 'daily' as const,
        recurringConfig: {
          interval: 'daily' as const,
          currentCount: 0
        }
      };

      mockStorage.updateReminder.mockResolvedValue();

      await scheduler.processRecurringReminder(dailyReminder);

      expect(mockStorage.updateReminder).toHaveBeenCalledWith(
        expect.objectContaining({
          recurringConfig: expect.objectContaining({
            currentCount: 1
          })
        })
      );
    });


    it('should deactivate reminder when end date reached', async () => {
      const endDateReminder = {
        ...mockReminder,
        type: 'daily' as const,
        recurringConfig: {
          interval: 'daily' as const,
          currentCount: 0,
          endDate: dayjs().subtract(1, 'day').toDate()
        }
      };

      mockStorage.updateReminder.mockResolvedValue();

      await scheduler.processRecurringReminder(endDateReminder);

      expect(mockStorage.updateReminder).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false
        })
      );
    });
  });

  describe('deactivateReminder', () => {
    it('should deactivate one-time reminder after triggering', async () => {
      const oneTimeReminder = { ...mockReminder };
      mockStorage.updateReminder.mockResolvedValue();

      await scheduler.deactivateReminder(oneTimeReminder);

      expect(mockStorage.updateReminder).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false
        })
      );
    });
  });

  describe('formatReminderMessage', () => {
    it('should format reminder message without user mention', () => {
      const result = scheduler.formatReminderMessage(mockReminder);

      expect(result.data.title).toContain('Test Reminder');
      expect(result.data.description).toContain('This is a test reminder');
    });

    it('should include daily information for daily reminders', () => {
      const dailyReminder = {
        ...mockReminder,
        type: 'daily' as const,
        recurringConfig: {
          interval: 'daily' as const,
          currentCount: 5
        }
      };

      const result = scheduler.formatReminderMessage(dailyReminder);

      expect(result.data.fields).toBeDefined();

      const fields = result.data.fields;
      const typeField = fields?.find(f => f.name === 'Type');
      const countField = fields?.find(f => f.name === 'Count');

      expect(typeField?.value).toContain('Daily reminder');
      expect(countField?.value).toContain('Occurrence: 6');
    });
  });
});
