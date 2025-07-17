export type ReminderType = 'once' | 'daily';

export interface DayFilter {
  skipWeekends: boolean;
  skipHolidays?: boolean; // Future extension
}

export interface RecurringConfig {
  interval: 'daily';
  endDate?: Date;
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
