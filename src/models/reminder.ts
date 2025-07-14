export type ReminderType = 'once' | 'recurring';

export type RecurringInterval = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface DayFilter {
  skipWeekends: boolean;
  allowedDays?: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
  skipHolidays?: boolean; // Future extension
}

export interface RecurringConfig {
  interval: RecurringInterval;
  customInterval?: number; // Custom interval in minutes
  endDate?: Date;
  maxOccurrences?: number;
  currentCount: number;
  dayFilter?: DayFilter;
}

export interface Reminder {
  id: string;
  userId: string;
  channelId: string;
  guildId: string;
  title: string;
  message: string;
  nextTriggerTime: Date;
  type: ReminderType;
  recurringConfig?: RecurringConfig;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}