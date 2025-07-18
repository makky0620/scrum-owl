import { BurndownChart } from '../models/burndownChart';
import * as fs from 'fs';
import * as path from 'path';

export class BurndownChartStorage {
  private dataPath: string;

  constructor(dataPath: string = path.join(__dirname, '../../data/burndownCharts.json')) {
    this.dataPath = dataPath;
  }

  async loadCharts(): Promise<BurndownChart[]> {
    try {
      if (!fs.existsSync(this.dataPath)) {
        return [];
      }

      const data = fs.readFileSync(this.dataPath, 'utf8');
      const charts = JSON.parse(data);

      // Convert date strings back to Date objects
      return charts.map((chart: any) => ({
        ...chart,
        startDate: new Date(chart.startDate),
        endDate: new Date(chart.endDate),
        createdAt: new Date(chart.createdAt),
        updatedAt: new Date(chart.updatedAt),
        progressEntries: chart.progressEntries.map((entry: any) => ({
          ...entry,
          date: new Date(entry.date)
        }))
      }));
    } catch (error) {
      console.error('Error loading burndown charts:', error);
      return [];
    }
  }

  async saveCharts(charts: BurndownChart[]): Promise<void> {
    try {
      const dir = path.dirname(this.dataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.dataPath, JSON.stringify(charts, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving burndown charts:', error);
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
    const index = charts.findIndex(c => c.id === updatedChart.id);

    if (index === -1) {
      throw new Error(`Chart with id ${updatedChart.id} not found`);
    }

    charts[index] = updatedChart;
    await this.saveCharts(charts);
  }

  async deleteChart(id: string): Promise<void> {
    const charts = await this.loadCharts();
    const index = charts.findIndex(c => c.id === id);

    if (index === -1) {
      throw new Error(`Chart with id ${id} not found`);
    }

    charts.splice(index, 1);
    await this.saveCharts(charts);
  }

  async getChartsByUser(userId: string): Promise<BurndownChart[]> {
    const charts = await this.loadCharts();
    return charts.filter(c => c.userId === userId);
  }

  async getActiveCharts(): Promise<BurndownChart[]> {
    const charts = await this.loadCharts();
    return charts.filter(c => c.isActive);
  }

  async getChartById(id: string): Promise<BurndownChart | undefined> {
    const charts = await this.loadCharts();
    return charts.find(c => c.id === id);
  }
}