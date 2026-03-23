import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  ChannelType,
} from 'discord.js';
import { Command } from '../command';
import { BurndownChartService } from '../services/burndownChartService';
import { QuickChartService } from '../services/quickChartService';
import { CreateBurndownChartData, UpdateProgressData } from '../models/burndownChart';
import { safeReply } from '../utils/interactionHelpers';
import dayjs from 'dayjs';

const burndownService = new BurndownChartService();
const quickChartService = new QuickChartService();

function progressPercentage(totalPoints: number, currentPoints: number): string {
  return ((totalPoints - currentPoints) / totalPoints * 100).toFixed(1);
}

async function handleError(interaction: ChatInputCommandInteraction, context: string, error: unknown): Promise<void> {
  console.error(`[Burndown] Error ${context}:`, error);
  await safeReply(interaction, `Error ${context}: ${error instanceof Error ? error.message : 'Unknown error'}`);
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('burndown')
    .setDescription('Manage burndown charts for sprint tracking')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new burndown chart')
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Title of the burndown chart')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('total_points')
            .setDescription('Total story points for the sprint')
            .setRequired(true)
            .setMinValue(1))
        .addStringOption(option =>
          option.setName('start_date')
            .setDescription('Start date (YYYY-MM-DD)')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('end_date')
            .setDescription('End date (YYYY-MM-DD)')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('description')
            .setDescription('Optional description')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('update')
        .setDescription('Update progress on a burndown chart')
        .addStringOption(option =>
          option.setName('chart_id')
            .setDescription('ID of the burndown chart')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('points_burned')
            .setDescription('Number of points burned/completed')
            .setRequired(true)
            .setMinValue(0))
        .addStringOption(option =>
          option.setName('note')
            .setDescription('Optional note about the progress')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View a burndown chart')
        .addStringOption(option =>
          option.setName('chart_id')
            .setDescription('ID of the burndown chart')
            .setRequired(true))
        .addBooleanOption(option =>
          option.setName('include_weekends')
            .setDescription('Include weekends in the chart (default: false)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all your burndown charts'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a burndown chart')
        .addStringOption(option =>
          option.setName('chart_id')
            .setDescription('ID of the burndown chart to delete')
            .setRequired(true))) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create':
        await handleCreate(interaction);
        break;
      case 'update':
        await handleUpdate(interaction);
        break;
      case 'view':
        await handleView(interaction);
        break;
      case 'list':
        await handleList(interaction);
        break;
      case 'delete':
        await handleDelete(interaction);
        break;
      default:
        await interaction.reply({
          content: 'Unknown subcommand.',
          flags: MessageFlags.Ephemeral,
        });
    }
  },
};

async function handleCreate(interaction: ChatInputCommandInteraction) {
  try {
    const title = interaction.options.getString('title', true);
    const totalPoints = interaction.options.getInteger('total_points', true);
    const startDate = interaction.options.getString('start_date', true);
    const endDate = interaction.options.getString('end_date', true);

    if (!interaction.guild || !interaction.channel) {
      await interaction.reply({
        content: 'This command can only be used in a server channel.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.channel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: 'This command can only be used in text channels.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const createData: CreateBurndownChartData = {
      userId: interaction.user.id,
      channelId: interaction.channel.id,
      guildId: interaction.guild.id,
      title,
      totalPoints,
      startDate,
      endDate,
    };

    const chart = await burndownService.createChart(createData);

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Burndown Chart Created')
      .setDescription(`Successfully created burndown chart: **${chart.title}**`)
      .addFields(
        { name: 'Chart ID', value: chart.id, inline: true },
        { name: 'Total Points', value: chart.totalPoints.toString(), inline: true },
        { name: 'Duration', value: `${dayjs(chart.startDate).format('MM/DD')} - ${dayjs(chart.endDate).format('MM/DD')}`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    await handleError(interaction, 'creating burndown chart', error);
  }
}

async function handleUpdate(interaction: ChatInputCommandInteraction) {
  try {
    const chartId = interaction.options.getString('chart_id', true);
    const pointsBurned = interaction.options.getInteger('points_burned', true);
    const note = interaction.options.getString('note');

    const existingChart = await burndownService.getChartById(chartId);
    if (!existingChart) {
      await interaction.reply({
        content: 'Burndown chart not found.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (existingChart.userId !== interaction.user.id) {
      await interaction.reply({
        content: 'You can only update your own burndown charts.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const updateData: UpdateProgressData = {
      chartId,
      pointsBurned,
      note: note || undefined,
    };

    const updatedChart = await burndownService.updateProgress(updateData);

    const embed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('📈 Progress Updated')
      .setDescription(`Updated burndown chart: **${updatedChart.title}**`)
      .addFields(
        { name: 'Points Burned', value: pointsBurned.toString(), inline: true },
        { name: 'Points Remaining', value: updatedChart.currentPoints.toString(), inline: true },
        { name: 'Progress', value: `${progressPercentage(updatedChart.totalPoints, updatedChart.currentPoints)}%`, inline: true }
      );

    if (note) {
      embed.addFields({ name: 'Note', value: note });
    }

    embed.setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    await handleError(interaction, 'updating burndown chart', error);
  }
}

async function handleView(interaction: ChatInputCommandInteraction) {
  try {
    const chartId = interaction.options.getString('chart_id', true);
    const includeWeekends = interaction.options.getBoolean('include_weekends') ?? false;
    const chart = await burndownService.getChartById(chartId);

    if (!chart) {
      await interaction.reply({
        content: 'Burndown chart not found.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const chartImageUrl = quickChartService.generateBurndownChartUrl(chart, includeWeekends);

    const embed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle(`📊 ${chart.title}`)
      .setDescription(`Burndown chart visualization`)
      .addFields(
        { name: 'Chart ID', value: chart.id, inline: false },
        { name: 'Total Points', value: chart.totalPoints.toString(), inline: true },
        { name: 'Points Remaining', value: chart.currentPoints.toString(), inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: 'Start Date', value: dayjs(chart.startDate).format('YYYY-MM-DD'), inline: true },
        { name: 'End Date', value: dayjs(chart.endDate).format('YYYY-MM-DD'), inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: 'Status', value: chart.isActive ? '🟢 Active' : '🔴 Inactive', inline: true },
        { name: 'Progress', value: `${progressPercentage(chart.totalPoints, chart.currentPoints)}% Complete`, inline: true }
      )
      .setImage(chartImageUrl);

    if (chart.progressEntries.length > 0) {
      const recentEntries = chart.progressEntries
        .slice(-3)
        .map(entry => `${dayjs(entry.date).format('MM/DD')} - Burned ${entry.pointsBurned} points${entry.note ? ` (${entry.note})` : ''}`)
        .join('\n');
      embed.addFields({ name: 'Recent Progress', value: recentEntries });
    }

    embed.setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    await handleError(interaction, 'viewing burndown chart', error);
  }
}

async function handleList(interaction: ChatInputCommandInteraction) {
  try {
    const charts = await burndownService.getUserCharts(interaction.user.id);

    if (charts.length === 0) {
      await interaction.reply({
        content: 'You have no burndown charts. Use `/burndown create` to create one.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('📊 Your Burndown Charts')
      .setDescription(`You have ${charts.length} burndown chart(s):`);

    charts.forEach(chart => {
      const status = chart.isActive ? '🟢' : '🔴';
      embed.addFields({
        name: `${status} ${chart.title}`,
        value: `ID: \`${chart.id}\`\nProgress: ${progressPercentage(chart.totalPoints, chart.currentPoints)}% (${chart.currentPoints}/${chart.totalPoints} points remaining)\nPeriod: ${dayjs(chart.startDate).format('MM/DD')} - ${dayjs(chart.endDate).format('MM/DD')}`,
        inline: false
      });
    });

    embed.setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    await handleError(interaction, 'listing burndown charts', error);
  }
}

async function handleDelete(interaction: ChatInputCommandInteraction) {
  try {
    const chartId = interaction.options.getString('chart_id', true);

    const chart = await burndownService.getChartById(chartId);
    if (!chart) {
      await interaction.reply({
        content: 'Burndown chart not found.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (chart.userId !== interaction.user.id) {
      await interaction.reply({
        content: 'You can only delete your own burndown charts.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await burndownService.deleteChart(chartId);

    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('🗑️ Burndown Chart Deleted')
      .setDescription(`Successfully deleted burndown chart: **${chart.title}**`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    await handleError(interaction, 'deleting burndown chart', error);
  }
}

module.exports = command;
