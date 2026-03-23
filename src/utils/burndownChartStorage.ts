import type { BurndownChart } from '../models/burndownChart';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

interface StoredProgressEntry {
  date: string;
  [key: string]: unknown;
}

interface StoredBurndownChart {
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  progressEntries: StoredProgressEntry[];
  [key: string]: unknown;
}

export class BurndownChartStorage {
  private dataPath: string;

  constructor(dataPath: string = path.join(__dirname, '../../data/burndownCharts.json')) {
    this.dataPath = dataPath;
  }

  async loadCharts(): Promise<BurndownChart[]> {
    try {
      const data = await fs.promises.readFile(this.dataPath, 'utf8');
      const charts = JSON.parse(data) as StoredBurndownChart[];

      return charts.map((chart) => ({
        ...chart,
        startDate: new Date(chart.startDate),
        endDate: new Date(chart.endDate),
        createdAt: new Date(chart.createdAt),
        updatedAt: new Date(chart.updatedAt),
        progressEntries: chart.progressEntries.map((entry) => ({
          ...entry,
          date: new Date(entry.date),
        })),
      })) as unknown as BurndownChart[];
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      logger.error('Error loading burndown charts:', error);
      return [];
    }
  }

  async saveCharts(charts: BurndownChart[]): Promise<void> {
    try {
      const dir = path.dirname(this.dataPath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(this.dataPath, JSON.stringify(charts, null, 2), 'utf8');
    } catch (error) {
      logger.error('Error saving burndown charts:', error);
      throw error;
    }
  }

  async addChart(chart: BurndownChart): Promise<void> {
    const charts = await this.loadCharts();
    charts.push(chart);
    await this.saveCharts(charts);
  }

  async updateChart(updatedChart: BurndownChart): Promise<void> {
    const charts = await this.loadCharts();
    const index = charts.findIndex((c) => c.id === updatedChart.id);

    if (index === -1) {
      throw new Error(`Chart with id ${updatedChart.id} not found`);
    }

    charts[index] = updatedChart;
    await this.saveCharts(charts);
  }

  async deleteChart(id: string): Promise<void> {
    const charts = await this.loadCharts();
    const index = charts.findIndex((c) => c.id === id);

    if (index === -1) {
      throw new Error(`Chart with id ${id} not found`);
    }

    charts.splice(index, 1);
    await this.saveCharts(charts);
  }

  async getChartsByUser(userId: string): Promise<BurndownChart[]> {
    const charts = await this.loadCharts();
    return charts.filter((c) => c.userId === userId);
  }

  async getActiveCharts(): Promise<BurndownChart[]> {
    const charts = await this.loadCharts();
    return charts.filter((c) => c.isActive);
  }

  async getChartById(id: string): Promise<BurndownChart | undefined> {
    const charts = await this.loadCharts();
    return charts.find((c) => c.id === id);
  }
}
