import { Reminder, ReminderType } from '../models/reminder';
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

    it('should create a valid daily reminder with day filter', () => {
      const reminder: Reminder = {
        id: 'test-id-2',
        userId: 'user123',
        channelId: 'channel123',
        guildId: 'guild123',
        title: 'Daily Standup',
        message: 'Time for daily standup!',
        nextTriggerTime: dayjs().add(1, 'day').toDate(),
        type: 'daily',
        recurringConfig: {
          interval: 'daily',
          currentCount: 0,
          dayFilter: {
            skipWeekends: true
          }
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(reminder.type).toBe('daily');
      expect(reminder.recurringConfig).toBeDefined();
      expect(reminder.recurringConfig?.dayFilter?.skipWeekends).toBe(true);
    });

    it('should create a daily reminder with end conditions', () => {
      const endDate = dayjs().add(1, 'month').toDate();

      const reminder: Reminder = {
        id: 'test-id-3',
        userId: 'user123',
        channelId: 'channel123',
        guildId: 'guild123',
        title: 'Daily Report',
        message: 'Time for daily report',
        nextTriggerTime: dayjs().add(1, 'day').toDate(),
        type: 'daily',
        recurringConfig: {
          interval: 'daily',
          currentCount: 0,
          endDate: endDate
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(reminder.recurringConfig?.endDate).toEqual(endDate);
    });

  });
});
