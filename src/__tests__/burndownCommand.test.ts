import { ChatInputCommandInteraction, ChannelType } from 'discord.js';
import dayjs from 'dayjs';

const mockCreateChart = jest.fn();
const mockUpdateProgress = jest.fn();
const mockGetChartById = jest.fn();
const mockGetUserCharts = jest.fn();
const mockDeleteChart = jest.fn();
const mockGenerateBurndownChartUrl = jest.fn();

jest.mock('../services/burndownChartService', () => ({
  BurndownChartService: jest.fn().mockImplementation(() => ({
    createChart: mockCreateChart,
    updateProgress: mockUpdateProgress,
    getChartById: mockGetChartById,
    getUserCharts: mockGetUserCharts,
    deleteChart: mockDeleteChart,
  })),
}));

jest.mock('../services/quickChartService', () => ({
  QuickChartService: jest.fn().mockImplementation(() => ({
    generateBurndownChartUrl: mockGenerateBurndownChartUrl,
  })),
}));

const command = require('../commands/burndown');

const mockChart = {
  id: 'chart-id-1',
  userId: 'user123',
  channelId: 'channel123',
  guildId: 'guild123',
  title: 'Test Sprint',
  totalPoints: 100,
  currentPoints: 80,
  startDate: dayjs('2024-01-01').toDate(),
  endDate: dayjs('2024-01-14').toDate(),
  progressEntries: [],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeInteraction(subcommand: string, overrides: Record<string, any> = {}): any {
  return {
    options: {
      getSubcommand: jest.fn().mockReturnValue(subcommand),
      getString: jest.fn().mockReturnValue(null),
      getInteger: jest.fn().mockReturnValue(null),
      getBoolean: jest.fn().mockReturnValue(null),
    } as any,
    user: { id: 'user123' } as any,
    guild: { id: 'guild123' } as any,
    channel: { id: 'channel123', type: ChannelType.GuildText } as any,
    channelId: 'channel123',
    guildId: 'guild123',
    reply: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('Burndown Command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateBurndownChartUrl.mockReturnValue('https://quickchart.io/chart?c=...');
  });

  describe('Command Structure', () => {
    it('should have correct name and description', () => {
      expect(command.data.name).toBe('burndown');
      expect(command.data.description).toContain('burndown');
    });

    it('should expose an execute function', () => {
      expect(typeof command.execute).toBe('function');
    });
  });

  describe('create subcommand', () => {
    it('should create a chart with valid inputs', async () => {
      const interaction = makeInteraction('create');
      (interaction.options!.getString as jest.Mock)
        .mockImplementation((name: string) => ({ title: 'Sprint 1', start_date: '2024-01-01', end_date: '2024-01-14' }[name] ?? null));
      (interaction.options!.getInteger as jest.Mock).mockReturnValue(50);
      mockCreateChart.mockResolvedValue(mockChart);

      await command.execute(interaction);

      expect(mockCreateChart).toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array) })
      );
    });

    it('should reject when not in a guild', async () => {
      const interaction = makeInteraction('create', { guild: null as any });

      await command.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('server'), flags: expect.any(Number) })
      );
      expect(mockCreateChart).not.toHaveBeenCalled();
    });

    it('should reject when not in a text channel', async () => {
      const interaction = makeInteraction('create', {
        channel: { id: 'channel123', type: ChannelType.GuildVoice } as any,
      });

      await command.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('text channel'), flags: expect.any(Number) })
      );
      expect(mockCreateChart).not.toHaveBeenCalled();
    });

    it('should reply with error embed when service throws', async () => {
      const interaction = makeInteraction('create');
      (interaction.options!.getString as jest.Mock)
        .mockImplementation((name: string) => ({ title: 'Sprint 1', start_date: 'bad', end_date: '2024-01-14' }[name] ?? null));
      (interaction.options!.getInteger as jest.Mock).mockReturnValue(50);
      mockCreateChart.mockRejectedValue(new Error('Invalid start date format'));

      await command.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('Invalid start date format'), flags: expect.any(Number) })
      );
    });
  });

  describe('update subcommand', () => {
    it('should update progress for own chart', async () => {
      const interaction = makeInteraction('update');
      (interaction.options!.getString as jest.Mock)
        .mockImplementation((name: string) => (name === 'chart_id' ? 'chart-id-1' : null));
      (interaction.options!.getInteger as jest.Mock).mockReturnValue(20);
      mockGetChartById.mockResolvedValue(mockChart);
      mockUpdateProgress.mockResolvedValue({ ...mockChart, currentPoints: 60 });

      await command.execute(interaction);

      expect(mockUpdateProgress).toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array) })
      );
    });

    it('should reject when chart not found', async () => {
      const interaction = makeInteraction('update');
      (interaction.options!.getString as jest.Mock).mockReturnValue('missing-id');
      (interaction.options!.getInteger as jest.Mock).mockReturnValue(10);
      mockGetChartById.mockResolvedValue(undefined);

      await command.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Burndown chart not found.', flags: expect.any(Number) })
      );
      expect(mockUpdateProgress).not.toHaveBeenCalled();
    });

    it('should reject when user does not own the chart', async () => {
      const interaction = makeInteraction('update', { user: { id: 'other-user' } as any });
      (interaction.options!.getString as jest.Mock).mockReturnValue('chart-id-1');
      (interaction.options!.getInteger as jest.Mock).mockReturnValue(10);
      mockGetChartById.mockResolvedValue(mockChart); // owned by user123

      await command.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('own'), flags: expect.any(Number) })
      );
      expect(mockUpdateProgress).not.toHaveBeenCalled();
    });
  });

  describe('view subcommand', () => {
    it('should display chart with image URL', async () => {
      const interaction = makeInteraction('view');
      (interaction.options!.getString as jest.Mock).mockReturnValue('chart-id-1');
      (interaction.options!.getBoolean as jest.Mock).mockReturnValue(false);
      mockGetChartById.mockResolvedValue(mockChart);

      await command.execute(interaction);

      expect(mockGenerateBurndownChartUrl).toHaveBeenCalledWith(mockChart, false);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array) })
      );
    });

    it('should reject when chart not found', async () => {
      const interaction = makeInteraction('view');
      (interaction.options!.getString as jest.Mock).mockReturnValue('missing-id');
      (interaction.options!.getBoolean as jest.Mock).mockReturnValue(null);
      mockGetChartById.mockResolvedValue(undefined);

      await command.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Burndown chart not found.', flags: expect.any(Number) })
      );
    });

    it('should pass includeWeekends option to chart URL generator', async () => {
      const interaction = makeInteraction('view');
      (interaction.options!.getString as jest.Mock).mockReturnValue('chart-id-1');
      (interaction.options!.getBoolean as jest.Mock).mockReturnValue(true);
      mockGetChartById.mockResolvedValue(mockChart);

      await command.execute(interaction);

      expect(mockGenerateBurndownChartUrl).toHaveBeenCalledWith(mockChart, true);
    });
  });

  describe('list subcommand', () => {
    it('should list all charts for the user', async () => {
      const interaction = makeInteraction('list');
      mockGetUserCharts.mockResolvedValue([mockChart]);

      await command.execute(interaction);

      expect(mockGetUserCharts).toHaveBeenCalledWith('user123');
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array) })
      );
    });

    it('should show empty message when no charts exist', async () => {
      const interaction = makeInteraction('list');
      mockGetUserCharts.mockResolvedValue([]);

      await command.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('no burndown charts'), flags: expect.any(Number) })
      );
    });
  });

  describe('delete subcommand', () => {
    it('should delete own chart', async () => {
      const interaction = makeInteraction('delete');
      (interaction.options!.getString as jest.Mock).mockReturnValue('chart-id-1');
      mockGetChartById.mockResolvedValue(mockChart);
      mockDeleteChart.mockResolvedValue(undefined);

      await command.execute(interaction);

      expect(mockDeleteChart).toHaveBeenCalledWith('chart-id-1');
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array) })
      );
    });

    it('should reject when chart not found', async () => {
      const interaction = makeInteraction('delete');
      (interaction.options!.getString as jest.Mock).mockReturnValue('missing-id');
      mockGetChartById.mockResolvedValue(undefined);

      await command.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Burndown chart not found.', flags: expect.any(Number) })
      );
      expect(mockDeleteChart).not.toHaveBeenCalled();
    });

    it('should reject when user does not own the chart', async () => {
      const interaction = makeInteraction('delete', { user: { id: 'other-user' } as any });
      (interaction.options!.getString as jest.Mock).mockReturnValue('chart-id-1');
      mockGetChartById.mockResolvedValue(mockChart); // owned by user123

      await command.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('own'), flags: expect.any(Number) })
      );
      expect(mockDeleteChart).not.toHaveBeenCalled();
    });
  });
});
