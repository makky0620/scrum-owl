import { Reminder, ReminderType, RecurringInterval } from '../models/reminder';
import dayjs from 'dayjs';

describe('Reminder Model', () => {
  describe('Reminder Interface', () => {
    it('should create a valid one-time reminder', () => {
      const reminder: Reminder = {
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

      expect(reminder.id).toBe('test-id-1');
      expect(reminder.type).toBe('once');
      expect(reminder.recurringConfig).toBeUndefined();
      expect(reminder.isActive).toBe(true);
    });

    it('should create a valid recurring reminder with day filter', () => {
      const reminder: Reminder = {
        id: 'test-id-2',
        userId: 'user123',
        channelId: 'channel123',
        guildId: 'guild123',
        title: 'Daily Standup',
        message: 'Time for daily standup!',
        nextTriggerTime: dayjs().add(1, 'day').toDate(),
        type: 'recurring',
        recurringConfig: {
          interval: 'daily',
          currentCount: 0,
          dayFilter: {
            skipWeekends: true,
            allowedDays: [1, 2, 3, 4, 5] // Monday to Friday
          }
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(reminder.type).toBe('recurring');
      expect(reminder.recurringConfig).toBeDefined();
      expect(reminder.recurringConfig?.dayFilter?.skipWeekends).toBe(true);
      expect(reminder.recurringConfig?.dayFilter?.allowedDays).toEqual([1, 2, 3, 4, 5]);
    });

    it('should create a recurring reminder with end conditions', () => {
      const endDate = dayjs().add(1, 'month').toDate();
      
      const reminder: Reminder = {
        id: 'test-id-3',
        userId: 'user123',
        channelId: 'channel123',
        guildId: 'guild123',
        title: 'Weekly Review',
        message: 'Time for weekly review',
        nextTriggerTime: dayjs().add(1, 'week').toDate(),
        type: 'recurring',
        recurringConfig: {
          interval: 'weekly',
          currentCount: 0,
          endDate: endDate,
          maxOccurrences: 4
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(reminder.recurringConfig?.endDate).toEqual(endDate);
      expect(reminder.recurringConfig?.maxOccurrences).toBe(4);
    });

    it('should create a custom interval reminder', () => {
      const reminder: Reminder = {
        id: 'test-id-4',
        userId: 'user123',
        channelId: 'channel123',
        guildId: 'guild123',
        title: 'Custom Reminder',
        message: 'Every 3 days reminder',
        nextTriggerTime: dayjs().add(3, 'day').toDate(),
        type: 'recurring',
        recurringConfig: {
          interval: 'custom',
          customInterval: 4320, // 3 days in minutes
          currentCount: 0
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(reminder.recurringConfig?.interval).toBe('custom');
      expect(reminder.recurringConfig?.customInterval).toBe(4320);
    });
  });
});