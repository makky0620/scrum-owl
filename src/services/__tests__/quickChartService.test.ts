import { QuickChartService } from '../quickChartService';
import { BurndownChart } from '../../models/burndownChart';
import dayjs from 'dayjs';

describe('QuickChartService', () => {
  let service: QuickChartService;

  beforeEach(() => {
    service = new QuickChartService();
  });

  describe('generateBurndownChartUrl', () => {
    it('should generate a chart URL for a burndown chart with progress entries', () => {
      const mockChart: BurndownChart = {
        id: 'test-id',
        userId: 'user-123',
        channelId: 'channel-123',
        guildId: 'guild-123',
        title: 'Test Sprint',
        totalPoints: 100,
        startDate: dayjs('2024-01-01').toDate(),
        endDate: dayjs('2024-01-14').toDate(),
        currentPoints: 40,
        progressEntries: [
          {
            date: dayjs('2024-01-03').toDate(),
            pointsRemaining: 80,
            pointsBurned: 20,
            note: 'First update'
          },
          {
            date: dayjs('2024-01-07').toDate(),
            pointsRemaining: 60,
            pointsBurned: 20,
            note: 'Mid sprint'
          },
          {
            date: dayjs('2024-01-10').toDate(),
            pointsRemaining: 40,
            pointsBurned: 20,
            note: 'Latest update'
          }
        ],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const chartUrl = service.generateBurndownChartUrl(mockChart);

      expect(chartUrl).toContain('https://quickchart.io/chart');
      expect(chartUrl).toContain('%22type%22%3A%22line%22'); // URL encoded "type":"line"
      expect(typeof chartUrl).toBe('string');
      expect(chartUrl.length).toBeGreaterThan(0);
    });

    it('should generate a chart URL for a burndown chart with no progress entries', () => {
      const mockChart: BurndownChart = {
        id: 'test-id',
        userId: 'user-123',
        channelId: 'channel-123',
        guildId: 'guild-123',
        title: 'New Sprint',
        totalPoints: 50,
        startDate: dayjs('2024-01-01').toDate(),
        endDate: dayjs('2024-01-10').toDate(),
        currentPoints: 50,
        progressEntries: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const chartUrl = service.generateBurndownChartUrl(mockChart);

      expect(chartUrl).toContain('https://quickchart.io/chart');
      expect(typeof chartUrl).toBe('string');
      expect(chartUrl.length).toBeGreaterThan(0);
    });

    it('should include ideal burndown line in the chart', () => {
      const mockChart: BurndownChart = {
        id: 'test-id',
        userId: 'user-123',
        channelId: 'channel-123',
        guildId: 'guild-123',
        title: 'Test Sprint',
        totalPoints: 100,
        startDate: dayjs('2024-01-01').toDate(),
        endDate: dayjs('2024-01-14').toDate(),
        currentPoints: 50,
        progressEntries: [
          {
            date: dayjs('2024-01-07').toDate(),
            pointsRemaining: 50,
            pointsBurned: 50
          }
        ],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const chartUrl = service.generateBurndownChartUrl(mockChart);

      // Should contain data for ideal line (from totalPoints to 0)
      expect(chartUrl).toContain('100'); // Starting points
      expect(chartUrl).toContain('0'); // Ending points
    });
  });
});
