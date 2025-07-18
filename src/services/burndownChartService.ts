import { BurndownChart, CreateBurndownChartData, UpdateProgressData, ProgressEntry } from '../models/burndownChart';
import { BurndownChartStorage } from '../utils/burndownChartStorage';
import dayjs from 'dayjs';
import { randomUUID } from 'crypto';

export class BurndownChartService {
  private storage: BurndownChartStorage;

  constructor(storage?: BurndownChartStorage) {
    this.storage = storage || new BurndownChartStorage();
  }

  async createChart(data: CreateBurndownChartData): Promise<BurndownChart> {
    // Validate required fields
    this.validateRequiredFields(data);

    // Validate total points
    if (data.totalPoints <= 0) {
      throw new Error('Total points must be greater than 0');
    }

    // Parse and validate dates
    const startDate = dayjs(data.startDate);
    const endDate = dayjs(data.endDate);

    if (!startDate.isValid()) {
      throw new Error('Invalid start date format');
    }

    if (!endDate.isValid()) {
      throw new Error('Invalid end date format');
    }

    if (endDate.isBefore(startDate) || endDate.isSame(startDate)) {
      throw new Error('End date must be after start date');
    }

    const now = new Date();
    const chart: BurndownChart = {
      id: this.generateId(),
      userId: data.userId,
      channelId: data.channelId,
      guildId: data.guildId,
      title: data.title,
      totalPoints: data.totalPoints,
      startDate: startDate.toDate(),
      endDate: endDate.toDate(),
      currentPoints: data.totalPoints,
      progressEntries: [],
      isActive: true,
      createdAt: now,
      updatedAt: now
    };

    await this.storage.addChart(chart);
    return chart;
  }

  async updateProgress(data: UpdateProgressData): Promise<BurndownChart> {
    const chart = await this.storage.getChartById(data.chartId);
    if (!chart) {
      throw new Error('Chart not found');
    }

    if (data.pointsBurned < 0) {
      throw new Error('Points burned cannot be negative');
    }

    if (data.pointsBurned > chart.currentPoints) {
      throw new Error('Cannot burn more points than remaining');
    }

    const newCurrentPoints = chart.currentPoints - data.pointsBurned;
    const progressEntry: ProgressEntry = {
      date: new Date(),
      pointsRemaining: newCurrentPoints,
      pointsBurned: data.pointsBurned,
      note: data.note
    };

    const updatedChart: BurndownChart = {
      ...chart,
      currentPoints: newCurrentPoints,
      progressEntries: [...chart.progressEntries, progressEntry],
      updatedAt: new Date()
    };

    await this.storage.updateChart(updatedChart);
    return updatedChart;
  }

  async getUserCharts(userId: string): Promise<BurndownChart[]> {
    return await this.storage.getChartsByUser(userId);
  }

  async deleteChart(id: string): Promise<void> {
    await this.storage.deleteChart(id);
  }

  async getChartById(id: string): Promise<BurndownChart | undefined> {
    return await this.storage.getChartById(id);
  }

  generateId(): string {
    return randomUUID();
  }

  private validateRequiredFields(data: CreateBurndownChartData): void {
    if (!data.userId || data.userId.trim() === '') {
      throw new Error('User ID is required');
    }
    if (!data.channelId || data.channelId.trim() === '') {
      throw new Error('Channel ID is required');
    }
    if (!data.guildId || data.guildId.trim() === '') {
      throw new Error('Guild ID is required');
    }
    if (!data.title || data.title.trim() === '') {
      throw new Error('Title is required');
    }
    if (!data.startDate || data.startDate.trim() === '') {
      throw new Error('Start date is required');
    }
    if (!data.endDate || data.endDate.trim() === '') {
      throw new Error('End date is required');
    }
  }
}