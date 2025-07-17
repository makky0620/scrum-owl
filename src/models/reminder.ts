export type ReminderType = 'once' | 'daily';

export interface DayFilter {
  skipWeekends: boolean;
  skipHolidays?: boolean; // Future extension
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
  dayFilter?: DayFilter;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
