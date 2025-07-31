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
    
    // Expected data (weekends excluded, only working days):
    // - Working day 0 (Mon): 100 (from entry)
    // - Working day 1 (Tue): 100 (filled with last known value)
    // - Working day 2 (Wed): 80 (from entry)
    // - Working day 3 (Thu): 80 (filled with last known value)
    // - Working day 4 (Fri): 60 (from entry)
    
    // Verify the data (only 5 working days)
    expect(actualData.length).toBe(5);
    expect(actualData[0]).toBe(100); // Monday (from entry)
    expect(actualData[1]).toBe(100); // Tuesday (filled with last known value)
    expect(actualData[2]).toBe(80);  // Wednesday (from entry)
    expect(actualData[3]).toBe(80);  // Thursday (filled with last known value)
    expect(actualData[4]).toBe(60);  // Friday (from entry)
  });

  describe('weekend filtering', () => {
    it('should exclude weekends by default', () => {
      // Create a chart spanning Friday to Tuesday (includes weekend)
      const mockChart: BurndownChart = {
        id: 'test-id',
        userId: 'user-123',
        channelId: 'channel-123',
        guildId: 'guild-123',
        title: 'Weekend Test Sprint',
        totalPoints: 60,
        startDate: dayjs('2024-01-05').toDate(), // Friday
        endDate: dayjs('2024-01-09').toDate(),   // Tuesday
        currentPoints: 60,
        progressEntries: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const chartUrl = service.generateBurndownChartUrl(mockChart);
      const encodedConfig = chartUrl.split('?c=')[1].split('&')[0];
      const decodedConfig = JSON.parse(decodeURIComponent(encodedConfig));
      const labels = decodedConfig.data.labels;

      // Should only include weekdays: Friday (01/05), Monday (01/08), Tuesday (01/09)
      expect(labels).toEqual(['01/05', '01/08', '01/09']);
      expect(labels).not.toContain('01/06'); // Saturday
      expect(labels).not.toContain('01/07'); // Sunday
    });

    it('should include weekends when explicitly requested', () => {
      const mockChart: BurndownChart = {
        id: 'test-id',
        userId: 'user-123',
        channelId: 'channel-123',
        guildId: 'guild-123',
        title: 'Weekend Test Sprint',
        totalPoints: 60,
        startDate: dayjs('2024-01-05').toDate(), // Friday
        endDate: dayjs('2024-01-09').toDate(),   // Tuesday
        currentPoints: 60,
        progressEntries: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const chartUrl = service.generateBurndownChartUrl(mockChart, true);
      const encodedConfig = chartUrl.split('?c=')[1].split('&')[0];
      const decodedConfig = JSON.parse(decodeURIComponent(encodedConfig));
      const labels = decodedConfig.data.labels;

      // Should include all days: Friday through Tuesday
      expect(labels).toEqual(['01/05', '01/06', '01/07', '01/08', '01/09']);
      expect(labels).toContain('01/06'); // Saturday
      expect(labels).toContain('01/07'); // Sunday
    });

    it('should calculate ideal burndown correctly with weekend exclusion', () => {
      const mockChart: BurndownChart = {
        id: 'test-id',
        userId: 'user-123',
        channelId: 'channel-123',
        guildId: 'guild-123',
        title: 'Weekend Test Sprint',
        totalPoints: 60,
        startDate: dayjs('2024-01-05').toDate(), // Friday
        endDate: dayjs('2024-01-09').toDate(),   // Tuesday (3 working days)
        currentPoints: 60,
        progressEntries: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const chartUrl = service.generateBurndownChartUrl(mockChart);
      const encodedConfig = chartUrl.split('?c=')[1].split('&')[0];
      const decodedConfig = JSON.parse(decodeURIComponent(encodedConfig));
      const idealData = decodedConfig.data.datasets[0].data;

      // For 3 working days with 60 points: 60, 30, 0 (Friday, Monday, Tuesday)
      expect(idealData).toEqual([60, 30, 0]);
    });

    it('should calculate ideal burndown correctly with weekend inclusion', () => {
      const mockChart: BurndownChart = {
        id: 'test-id',
        userId: 'user-123',
        channelId: 'channel-123',
        guildId: 'guild-123',
        title: 'Weekend Test Sprint',
        totalPoints: 60,
        startDate: dayjs('2024-01-05').toDate(), // Friday
        endDate: dayjs('2024-01-09').toDate(),   // Tuesday (5 total days)
        currentPoints: 60,
        progressEntries: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const chartUrl = service.generateBurndownChartUrl(mockChart, true);
      const encodedConfig = chartUrl.split('?c=')[1].split('&')[0];
      const decodedConfig = JSON.parse(decodeURIComponent(encodedConfig));
      const idealData = decodedConfig.data.datasets[0].data;

      // For 5 total days with 60 points: 60, 45, 30, 15, 0 (Friday through Tuesday)
      expect(idealData).toEqual([60, 45, 30, 15, 0]);
    });

    it('should map progress entries correctly with weekend exclusion', () => {
      const mockChart: BurndownChart = {
        id: 'test-id',
        userId: 'user-123',
        channelId: 'channel-123',
        guildId: 'guild-123',
        title: 'Weekend Test Sprint',
        totalPoints: 60,
        startDate: dayjs('2024-01-05').toDate(), // Friday
        endDate: dayjs('2024-01-09').toDate(),   // Tuesday
        currentPoints: 20,
        progressEntries: [
          {
            date: dayjs('2024-01-05').toDate(), // Friday
            pointsRemaining: 60,
            pointsBurned: 0
          },
          {
            date: dayjs('2024-01-08').toDate(), // Monday
            pointsRemaining: 40,
            pointsBurned: 20
          },
          {
            date: dayjs('2024-01-09').toDate(), // Tuesday
            pointsRemaining: 20,
            pointsBurned: 20
          }
        ],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const chartUrl = service.generateBurndownChartUrl(mockChart);
      const encodedConfig = chartUrl.split('?c=')[1].split('&')[0];
      const decodedConfig = JSON.parse(decodeURIComponent(encodedConfig));
      const actualData = decodedConfig.data.datasets[1].data;

      // Should map to working days only: [60, 40, 20]
      expect(actualData).toEqual([60, 40, 20]);
    });
  });
});
