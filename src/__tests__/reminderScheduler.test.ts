import { ReminderScheduler } from '../services/reminderScheduler';
import { ReminderStorage } from '../utils/storage';
import type { Reminder } from '../models/reminder';
import type { Client } from 'discord.js';
import dayjs from 'dayjs';

// Mock dependencies
jest.mock('../utils/storage');

const MockedReminderStorage = ReminderStorage as jest.MockedClass<typeof ReminderStorage>;

describe('ReminderScheduler', () => {
  let scheduler: ReminderScheduler;
  let mockStorage: jest.Mocked<ReminderStorage>;
  let mockClient: jest.Mocked<Client>;
  let mockChannel: { send: jest.Mock; guild: { id: string } };

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
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    mockStorage = new MockedReminderStorage() as jest.Mocked<ReminderStorage>;

    mockChannel = {
      send: jest.fn().mockResolvedValue({}),
      guild: { id: 'guild123' },
    };

    mockClient = {
      channels: {
        fetch: jest.fn().mockResolvedValue(mockChannel),
      },
    } as unknown as jest.Mocked<Client>;

    scheduler = new ReminderScheduler(mockClient, mockStorage);
  });

  afterEach(() => {
    scheduler.stop();
  });

  describe('start', () => {
    it('should start the scheduler', async () => {
      await scheduler.start();

      expect(scheduler.isRunning()).toBe(true);
    });

    it('should not start if already running', async () => {
      await scheduler.start();
      await scheduler.start(); // Try to start again

      expect(scheduler.isRunning()).toBe(true);
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
        nextTriggerTime: dayjs().subtract(1, 'minute').toDate(),
      };

      mockStorage.getActiveReminders.mockResolvedValue([dueReminder]);

      await scheduler.checkReminders();

      expect(mockClient.channels.fetch).toHaveBeenCalledWith('channel123');
      expect(mockChannel.send).toHaveBeenCalled();
    });

    it('should not trigger reminders that are not due', async () => {
      const futureReminder = {
        ...mockReminder,
        nextTriggerTime: dayjs().add(1, 'hour').toDate(),
      };

      mockStorage.getActiveReminders.mockResolvedValue([futureReminder]);

      await scheduler.checkReminders();

      expect(mockClient.channels.fetch).not.toHaveBeenCalled();
      expect(mockChannel.send).not.toHaveBeenCalled();
    });

    it('should handle channel fetch errors gracefully', async () => {
      const dueReminder = {
        ...mockReminder,
        nextTriggerTime: dayjs().subtract(1, 'minute').toDate(),
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
        dayFilter: { skipWeekends: true },
      };

      const saturday = new Date(2026, 5, 20); // June 20 2026 = Saturday
      const sunday = new Date(2026, 5, 21);   // June 21 2026 = Sunday

      expect(scheduler.shouldTriggerToday(weekendReminder, saturday)).toBe(false);
      expect(scheduler.shouldTriggerToday(weekendReminder, sunday)).toBe(false);
    });

    it('should allow weekdays when skipWeekends is true', () => {
      const weekdayReminder = {
        ...mockReminder,
        type: 'daily' as const,
        dayFilter: { skipWeekends: true },
      };

      const monday = new Date(2026, 5, 22); // June 22 2026 = Monday

      expect(scheduler.shouldTriggerToday(weekdayReminder, monday)).toBe(true);
    });
  });

  describe('calculateNextTriggerTime', () => {
    it('should calculate next daily trigger time', () => {
      const dailyReminder = {
        ...mockReminder,
        type: 'daily' as const,
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
        dayFilter: {
          skipWeekends: true,
        },
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
      };

      mockStorage.updateReminder.mockResolvedValue();

      await scheduler.processRecurringReminder(dailyReminder);

      expect(mockStorage.updateReminder).toHaveBeenCalledWith(
        expect.objectContaining({
          nextTriggerTime: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
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
          isActive: false,
        }),
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
      };

      const result = scheduler.formatReminderMessage(dailyReminder);

      expect(result.data.fields).toBeDefined();

      const fields = result.data.fields;
      const typeField = fields?.find((f) => f.name === 'Type');

      expect(typeField?.value).toContain('Daily reminder');
    });
  });

  describe('triggerReminder double-fire prevention', () => {
    it('does not send the message twice when triggerReminder is called concurrently for the same reminder', async () => {
      const dueReminder: Reminder = {
        ...mockReminder,
        nextTriggerTime: dayjs().subtract(1, 'minute').toDate(),
      };

      mockStorage.updateReminder.mockResolvedValue();

      // Both calls are initiated synchronously before any await resolves.
      // The guard (triggeringIds) is checked synchronously at the top of triggerReminder,
      // so the second call sees the ID already in the set and returns immediately.
      await Promise.all([
        scheduler.triggerReminder(dueReminder),
        scheduler.triggerReminder(dueReminder),
      ]);

      expect(mockChannel.send).toHaveBeenCalledTimes(1);
    });

    it('allows triggering the same reminder again after the first trigger completes', async () => {
      const dueReminder: Reminder = {
        ...mockReminder,
        nextTriggerTime: dayjs().subtract(1, 'minute').toDate(),
      };

      mockStorage.updateReminder.mockResolvedValue();

      await scheduler.triggerReminder(dueReminder);
      await scheduler.triggerReminder(dueReminder);

      expect(mockChannel.send).toHaveBeenCalledTimes(2);
    });
  });
});
