export interface Reminder {
  id: string;
  userId: string;
  channelId: string;
  title: string;
  description?: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  time: string; // HH:mm format
  timezone: string; // e.g., "Asia/Tokyo"
  isActive: boolean;
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
}

export interface CreateReminderData {
  userId: string;
  channelId: string;
  title: string;
  description?: string;
  dayOfWeek: number;
  time: string;
  timezone?: string;
}

export interface UpdateReminderData {
  title?: string;
  description?: string;
  dayOfWeek?: number;
  time?: string;
  timezone?: string;
  isActive?: boolean;
}