import { ReminderScheduler } from '../services/reminderScheduler';
import { Reminder } from '../types/reminder';
import { Client } from 'discord.js';

// Mock dayjs
jest.mock('dayjs', () => {
  const mockDayjs = jest.fn(() => ({
    tz: jest.fn().mockReturnThis(),
    day: jest.fn().mockReturnThis(),
    hour: jest.fn().mockReturnThis(),
    minute: jest.fn().mockReturnThis(),
    second: jest.fn().mockReturnThis(),
    isBefore: jest.fn().mockReturnValue(false),
    add: jest.fn().mockReturnThis(),
    toDate: jest.fn().mockReturnValue(new Date('2023-01-02T09:00:00Z'))
  }));

  return Object.assign(mockDayjs, {
    extend: jest.fn()
  });
});

// Mock Discord client
const mockClient = {
  channels: {
    fetch: jest.fn()
  }
} as unknown as Client;

const mockChannel = {
  send: jest.fn(),
  isTextBased: jest.fn().mockReturnValue(true)
};

describe('ReminderScheduler', () => {
  let scheduler: ReminderScheduler;

  beforeEach(() => {
    scheduler = new ReminderScheduler(mockClient);
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('scheduleReminder', () => {
    it('should schedule a reminder for the correct time', () => {
      const reminder: Reminder = {
        id: 'reminder123',
        userId: 'user123',
        channelId: 'channel123',
        title: 'Daily Standup',
        description: 'Morning standup meeting',
        dayOfWeek: 1, // Monday
        time: '09:00',
        timezone: 'Asia/Tokyo',
        isActive: true,
        comments: [],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      };

      scheduler.scheduleReminder(reminder);

      // Verify that a timeout was set
      expect(setTimeout).toHaveBeenCalledTimes(1);
      expect(scheduler.isScheduled(reminder.id)).toBe(true);
    });

    it('should not schedule inactive reminders', () => {
      const reminder: Reminder = {
        id: 'reminder123',
        userId: 'user123',
        channelId: 'channel123',
        title: 'Daily Standup',
        dayOfWeek: 1,
        time: '09:00',
        timezone: 'Asia/Tokyo',
        isActive: false,
        comments: [],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      };

      scheduler.scheduleReminder(reminder);

      expect(setTimeout).not.toHaveBeenCalled();
      expect(scheduler.isScheduled(reminder.id)).toBe(false);
    });
  });

  describe('unscheduleReminder', () => {
    it('should unschedule an existing reminder', () => {
      const reminder: Reminder = {
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
      };

      scheduler.scheduleReminder(reminder);
      expect(scheduler.isScheduled(reminder.id)).toBe(true);

      scheduler.unscheduleReminder(reminder.id);
      expect(scheduler.isScheduled(reminder.id)).toBe(false);
    });

    it('should handle unscheduling non-existent reminder gracefully', () => {
      expect(() => {
        scheduler.unscheduleReminder('nonexistent');
      }).not.toThrow();
    });
  });

  describe('rescheduleReminder', () => {
    it('should unschedule old and schedule new reminder', () => {
      const originalReminder: Reminder = {
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
      };

      const updatedReminder: Reminder = {
        ...originalReminder,
        time: '10:00',
        updatedAt: '2023-01-01T01:00:00Z'
      };

      scheduler.scheduleReminder(originalReminder);
      expect(scheduler.isScheduled(originalReminder.id)).toBe(true);

      scheduler.rescheduleReminder(updatedReminder);
      expect(scheduler.isScheduled(updatedReminder.id)).toBe(true);
    });
  });

  describe('sendReminder', () => {
    it('should send reminder message to correct channel', async () => {
      const reminder: Reminder = {
        id: 'reminder123',
        userId: 'user123',
        channelId: 'channel123',
        title: 'Daily Standup',
        description: 'Morning standup meeting',
        dayOfWeek: 1,
        time: '09:00',
        timezone: 'Asia/Tokyo',
        isActive: true,
        comments: [
          {
            id: 'comment1',
            userId: 'user456',
            content: 'Don\'t forget the agenda!',
            createdAt: '2023-01-01T08:00:00Z'
          }
        ],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      };

      (mockClient.channels.fetch as jest.Mock).mockResolvedValue(mockChannel);

      await scheduler.sendReminder(reminder);

      expect(mockClient.channels.fetch).toHaveBeenCalledWith('channel123');
      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: '🔔 Reminder: Daily Standup',
                description: 'Morning standup meeting'
              })
            })
          ])
        })
      );
    });

    it('should handle channel fetch errors gracefully', async () => {
      const reminder: Reminder = {
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
      };

      (mockClient.channels.fetch as jest.Mock).mockRejectedValue(new Error('Channel not found'));

      // Should not throw
      await expect(scheduler.sendReminder(reminder)).resolves.not.toThrow();
    });
  });

  describe('scheduleAllReminders', () => {
    it('should schedule all active reminders', () => {
      const reminders: Reminder[] = [
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
          userId: 'user123',
          channelId: 'channel123',
          title: 'Weekly Review',
          dayOfWeek: 5,
          time: '17:00',
          timezone: 'Asia/Tokyo',
          isActive: false,
          comments: [],
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        }
      ];

      scheduler.scheduleAllReminders(reminders);

      // Only active reminder should be scheduled
      expect(scheduler.isScheduled('reminder1')).toBe(true);
      expect(scheduler.isScheduled('reminder2')).toBe(false);
    });
  });
});
