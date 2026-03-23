import { BurndownChartStorage } from '../utils/burndownChartStorage';
import type { BurndownChart } from '../models/burndownChart';
import * as fs from 'fs';
import * as path from 'path';
import dayjs from 'dayjs';

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
  },
}));

const mockReadFile = jest.mocked(fs.promises.readFile);
const mockWriteFile = jest.mocked(fs.promises.writeFile);
const mockMkdir = jest.mocked(fs.promises.mkdir);

describe('BurndownChartStorage', () => {
  let storage: BurndownChartStorage;
  const testDataPath = path.join(__dirname, '../../data/test-burndown.json');

  const mockChart: BurndownChart = {
    id: 'chart-id-1',
    userId: 'user123',
    channelId: 'channel123',
    guildId: 'guild123',
    title: 'Test Sprint',
    totalPoints: 100,
    startDate: dayjs('2024-01-01').toDate(),
    endDate: dayjs('2024-01-14').toDate(),
    currentPoints: 80,
    progressEntries: [
      {
        date: dayjs('2024-01-03').toDate(),
        pointsRemaining: 80,
        pointsBurned: 20,
      },
    ],
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-03'),
  };

  beforeEach(() => {
    storage = new BurndownChartStorage(testDataPath);
    jest.clearAllMocks();
  });

  describe('loadCharts', () => {
    it('should return empty array when file does not exist', async () => {
      const enoentError = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      mockReadFile.mockRejectedValue(enoentError);

      const charts = await storage.loadCharts();

      expect(charts).toEqual([]);
    });

    it('should load charts from existing file', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify([mockChart]));

      const charts = await storage.loadCharts();

      expect(charts).toHaveLength(1);
      expect(charts[0].id).toBe('chart-id-1');
      expect(mockReadFile).toHaveBeenCalledWith(testDataPath, 'utf8');
    });

    it('should convert date strings back to Date objects', async () => {
      const chartWithStringDates = {
        ...mockChart,
        startDate: mockChart.startDate.toISOString(),
        endDate: mockChart.endDate.toISOString(),
        createdAt: mockChart.createdAt.toISOString(),
        updatedAt: mockChart.updatedAt.toISOString(),
        progressEntries: [
          {
            ...mockChart.progressEntries[0],
            date: mockChart.progressEntries[0].date.toISOString(),
          },
        ],
      };
      mockReadFile.mockResolvedValue(JSON.stringify([chartWithStringDates]));

      const charts = await storage.loadCharts();

      expect(charts[0].startDate).toBeInstanceOf(Date);
      expect(charts[0].endDate).toBeInstanceOf(Date);
      expect(charts[0].createdAt).toBeInstanceOf(Date);
      expect(charts[0].updatedAt).toBeInstanceOf(Date);
      expect(charts[0].progressEntries[0].date).toBeInstanceOf(Date);
    });

    it('should handle corrupted JSON file gracefully', async () => {
      mockReadFile.mockResolvedValue('not valid json');

      const charts = await storage.loadCharts();

      expect(charts).toEqual([]);
    });
  });

  describe('saveCharts', () => {
    it('should create directory and write charts to file', async () => {
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      await storage.saveCharts([mockChart]);

      expect(mockMkdir).toHaveBeenCalledWith(path.dirname(testDataPath), { recursive: true });
      expect(mockWriteFile).toHaveBeenCalledWith(
        testDataPath,
        JSON.stringify([mockChart], null, 2),
        'utf8',
      );
    });

    it('should throw on write error', async () => {
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockRejectedValue(new Error('Disk full'));

      await expect(storage.saveCharts([mockChart])).rejects.toThrow('Disk full');
    });
  });

  describe('addChart', () => {
    it('should append a chart to existing charts', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify([mockChart]));
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const newChart = { ...mockChart, id: 'chart-id-2', title: 'Sprint 2' };
      await storage.addChart(newChart);

      expect(mockWriteFile).toHaveBeenCalledWith(
        testDataPath,
        expect.stringContaining('"id": "chart-id-2"'),
        'utf8',
      );
    });
  });

  describe('updateChart', () => {
    it('should update an existing chart', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify([mockChart]));
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const updated = { ...mockChart, currentPoints: 60 };
      await storage.updateChart(updated);

      expect(mockWriteFile).toHaveBeenCalledWith(
        testDataPath,
        expect.stringContaining('"currentPoints": 60'),
        'utf8',
      );
    });

    it('should throw when chart not found', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify([mockChart]));

      const nonExistent = { ...mockChart, id: 'missing-id' };
      await expect(storage.updateChart(nonExistent)).rejects.toThrow(
        'Chart with id missing-id not found',
      );
    });
  });

  describe('deleteChart', () => {
    it('should delete an existing chart', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify([mockChart]));
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      await storage.deleteChart('chart-id-1');

      expect(mockWriteFile).toHaveBeenCalledWith(testDataPath, '[]', 'utf8');
    });

    it('should throw when chart not found', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify([mockChart]));

      await expect(storage.deleteChart('missing-id')).rejects.toThrow(
        'Chart with id missing-id not found',
      );
    });
  });

  describe('getChartsByUser', () => {
    it('should return only charts belonging to the given user', async () => {
      const charts = [mockChart, { ...mockChart, id: 'chart-id-2', userId: 'user456' }];
      mockReadFile.mockResolvedValue(JSON.stringify(charts));

      const result = await storage.getChartsByUser('user123');

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user123');
    });
  });

  describe('getActiveCharts', () => {
    it('should return only active charts', async () => {
      const charts = [mockChart, { ...mockChart, id: 'chart-id-2', isActive: false }];
      mockReadFile.mockResolvedValue(JSON.stringify(charts));

      const result = await storage.getActiveCharts();

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(true);
    });
  });

  describe('getChartById', () => {
    it('should return the chart with the given id', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify([mockChart]));

      const result = await storage.getChartById('chart-id-1');

      expect(result?.id).toBe('chart-id-1');
    });

    it('should return undefined when chart not found', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify([mockChart]));

      const result = await storage.getChartById('missing-id');

      expect(result).toBeUndefined();
    });
  });
});
