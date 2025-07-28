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

  it('should fill gaps between data points with the last known value and not show days after the last data point', () => {
    // Create a mock chart with gaps between progress entries
    // Example: 7-day sprint with entries on days 1, 3, and 5
    const mockChart: BurndownChart = {
      id: 'test-id',
      userId: 'user-123',
      channelId: 'channel-123',
      guildId: 'guild-123',
      title: 'Gap Test Sprint',
      totalPoints: 100,
      startDate: dayjs('2024-01-01').toDate(),
      endDate: dayjs('2024-01-07').toDate(),
      currentPoints: 40,
      progressEntries: [
        {
          date: dayjs('2024-01-01').toDate(), // Day 0
          pointsRemaining: 100,
          pointsBurned: 0
        },
        {
          date: dayjs('2024-01-03').toDate(), // Day 2
          pointsRemaining: 80,
          pointsBurned: 20
        },
        {
          date: dayjs('2024-01-05').toDate(), // Day 4
          pointsRemaining: 60,
          pointsBurned: 20
        }
      ],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Generate the chart URL
    const chartUrl = service.generateBurndownChartUrl(mockChart);
    
    // Decode the URL to extract the chart configuration
    const encodedConfig = chartUrl.split('?c=')[1].split('&')[0];
    const decodedConfig = JSON.parse(decodeURIComponent(encodedConfig));
    
    // Extract the actual data from the chart configuration
    const actualData = decodedConfig.data.datasets[1].data;
    
    // Expected data:
    // - Day 0: 100 (from entry)
    // - Day 1: 100 (filled with last known value from day 0)
    // - Day 2: 80 (from entry)
    // - Day 3: 80 (filled with last known value from day 2)
    // - Day 4: 60 (from entry)
    // - Day 5: null (no data after last entry)
    // - Day 6: null (no data after last entry)
    
    // Verify the data
    expect(actualData[0]).toBe(100); // Day 0 (from entry)
    expect(actualData[1]).toBe(100); // Day 1 (filled with last known value)
    expect(actualData[2]).toBe(80);  // Day 2 (from entry)
    expect(actualData[3]).toBe(80);  // Day 3 (filled with last known value)
    expect(actualData[4]).toBe(60);  // Day 4 (from entry)
    expect(actualData[5]).toBe(null); // Day 5 (no data after last entry)
    expect(actualData[6]).toBe(null); // Day 6 (no data after last entry)
  });
});
