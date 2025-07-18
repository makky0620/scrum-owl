export interface BurndownChart {
  id: string;
  userId: string;
  channelId: string;
  guildId: string;
  title: string;
  totalPoints: number;
  startDate: Date;
  endDate: Date;
  currentPoints: number;
  progressEntries: ProgressEntry[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProgressEntry {
  date: Date;
  pointsRemaining: number;
  pointsBurned: number;
  note?: string;
}

export interface CreateBurndownChartData {
  userId: string;
  channelId: string;
  guildId: string;
  title: string;
  totalPoints: number;
  startDate: string;
  endDate: string;
}

export interface UpdateProgressData {
  chartId: string;
  pointsBurned: number;
  note?: string;
}