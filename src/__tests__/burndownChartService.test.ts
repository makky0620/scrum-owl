import { BurndownChartService } from '../services/burndownChartService';
import { BurndownChartStorage } from '../utils/burndownChartStorage';
import { BurndownChart } from '../models/burndownChart';
import dayjs from 'dayjs';

jest.mock('../utils/burndownChartStorage');
const MockedStorage = BurndownChartStorage as jest.MockedClass<typeof BurndownChartStorage>;

describe('BurndownChartService', () => {
  let service: BurndownChartService;
  let mockStorage: jest.Mocked<BurndownChartStorage>;

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
    progressEntries: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockStorage = new MockedStorage() as jest.Mocked<BurndownChartStorage>;
    service = new BurndownChartService(mockStorage);
    jest.clearAllMocks();
  });

  describe('createChart', () => {
    const validData = {
      userId: 'user123',
      channelId: 'channel123',
      guildId: 'guild123',
      title: 'Sprint 1',
      totalPoints: 50,
      startDate: '2024-01-01',
      endDate: '2024-01-14',
    };

    it('should create a chart with valid data', async () => {
      mockStorage.addChart.mockResolvedValue();

      const chart = await service.createChart(validData);

      expect(chart.id).toBeDefined();
      expect(chart.title).toBe('Sprint 1');
      expect(chart.totalPoints).toBe(50);
      expect(chart.currentPoints).toBe(50);
      expect(chart.isActive).toBe(true);
      expect(chart.progressEntries).toHaveLength(0);
      expect(mockStorage.addChart).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sprint 1' }));
    });

    it('should reject when total points is zero', async () => {
      await expect(service.createChart({ ...validData, totalPoints: 0 }))
        .rejects.toThrow('Total points must be greater than 0');
    });

    it('should reject invalid start date', async () => {
      await expect(service.createChart({ ...validData, startDate: 'not-a-date' }))
        .rejects.toThrow('Invalid start date format');
    });

    it('should reject invalid end date', async () => {
      await expect(service.createChart({ ...validData, endDate: 'not-a-date' }))
        .rejects.toThrow('Invalid end date format');
    });

    it('should reject when end date is before start date', async () => {
      await expect(service.createChart({ ...validData, startDate: '2024-01-14', endDate: '2024-01-01' }))
        .rejects.toThrow('End date must be after start date');
    });

    it('should reject when end date equals start date', async () => {
      await expect(service.createChart({ ...validData, startDate: '2024-01-01', endDate: '2024-01-01' }))
        .rejects.toThrow('End date must be after start date');
    });

    it('should reject missing required fields', async () => {
      await expect(service.createChart({ ...validData, title: '' }))
        .rejects.toThrow('Title is required');

      await expect(service.createChart({ ...validData, userId: '' }))
        .rejects.toThrow('User ID is required');
    });
  });

  describe('updateProgress', () => {
    it('should update progress and record entry', async () => {
      mockStorage.getChartById.mockResolvedValue(mockChart);
      mockStorage.updateChart.mockResolvedValue();

      const result = await service.updateProgress({ chartId: 'chart-id-1', pointsBurned: 20 });

      expect(result.currentPoints).toBe(60);
      expect(result.progressEntries).toHaveLength(1);
      expect(result.progressEntries[0].pointsBurned).toBe(20);
      expect(result.progressEntries[0].pointsRemaining).toBe(60);
      expect(mockStorage.updateChart).toHaveBeenCalled();
    });

    it('should include note in progress entry when provided', async () => {
      mockStorage.getChartById.mockResolvedValue(mockChart);
      mockStorage.updateChart.mockResolvedValue();

      const result = await service.updateProgress({ chartId: 'chart-id-1', pointsBurned: 10, note: 'Done items' });

      expect(result.progressEntries[0].note).toBe('Done items');
    });

    it('should throw when chart not found', async () => {
      mockStorage.getChartById.mockResolvedValue(undefined);

      await expect(service.updateProgress({ chartId: 'missing', pointsBurned: 10 }))
        .rejects.toThrow('Chart not found');
    });

    it('should throw when burning more points than remaining', async () => {
      mockStorage.getChartById.mockResolvedValue(mockChart);

      await expect(service.updateProgress({ chartId: 'chart-id-1', pointsBurned: 999 }))
        .rejects.toThrow('Cannot burn more points than remaining');
    });

    it('should throw when points burned is negative', async () => {
      mockStorage.getChartById.mockResolvedValue(mockChart);

      await expect(service.updateProgress({ chartId: 'chart-id-1', pointsBurned: -1 }))
        .rejects.toThrow('Points burned cannot be negative');
    });

    it('should allow burning exactly the remaining points', async () => {
      mockStorage.getChartById.mockResolvedValue(mockChart);
      mockStorage.updateChart.mockResolvedValue();

      const result = await service.updateProgress({ chartId: 'chart-id-1', pointsBurned: 80 });

      expect(result.currentPoints).toBe(0);
    });
  });

  describe('getUserCharts', () => {
    it('should return charts for the given user', async () => {
      mockStorage.getChartsByUser.mockResolvedValue([mockChart]);

      const result = await service.getUserCharts('user123');

      expect(result).toEqual([mockChart]);
      expect(mockStorage.getChartsByUser).toHaveBeenCalledWith('user123');
    });
  });

  describe('deleteChart', () => {
    it('should call storage to delete the chart', async () => {
      mockStorage.deleteChart.mockResolvedValue();

      await service.deleteChart('chart-id-1');

      expect(mockStorage.deleteChart).toHaveBeenCalledWith('chart-id-1');
    });
  });

  describe('getChartById', () => {
    it('should return the chart by id', async () => {
      mockStorage.getChartById.mockResolvedValue(mockChart);

      const result = await service.getChartById('chart-id-1');

      expect(result).toEqual(mockChart);
      expect(mockStorage.getChartById).toHaveBeenCalledWith('chart-id-1');
    });

    it('should return undefined when chart not found', async () => {
      mockStorage.getChartById.mockResolvedValue(undefined);

      const result = await service.getChartById('missing-id');

      expect(result).toBeUndefined();
    });
  });

  describe('generateId', () => {
    it('should return unique UUIDs', () => {
      const id1 = service.generateId();
      const id2 = service.generateId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });
  });
});
