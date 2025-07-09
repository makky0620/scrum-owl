import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { Command } from '../command';
import dayjs from '../utils/dayjs';
import * as fs from 'fs';
import * as path from 'path';

// Interface for daily progress tracking
interface DailyProgress {
  date: string; // ISO date string (YYYY-MM-DD)
  pointsCompleted: number; // Points completed on this specific day
  totalPointsCompleted: number; // Cumulative points completed up to this day
}

// Interface for sprint data
interface Sprint {
  name: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  totalPoints: number;
  userId: string;
  guildId: string;
  createdAt: string; // ISO date string
  dailyProgress?: DailyProgress[]; // Optional for backward compatibility
}

// File path for storing sprints
const sprintsFilePath = path.join(__dirname, '../../data/sprints.json');

// Ensure the data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Function to save sprints to file
function saveSprints(sprints: Sprint[]) {
  try {
    fs.writeFileSync(sprintsFilePath, JSON.stringify(sprints, null, 2));
    console.log('Sprints saved to file');
  } catch (error) {
    console.error('Error saving sprints to file:', error);
  }
}

// Function to load sprints from file
function loadSprints(): Sprint[] {
  try {
    if (fs.existsSync(sprintsFilePath)) {
      const data = fs.readFileSync(sprintsFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading sprints from file:', error);
  }
  return [];
}

// Load sprints from file or initialize empty array
const sprints: Sprint[] = loadSprints();

// Create a class that implements the Command interface
class BurndownCommand implements Command {
  data = new SlashCommandBuilder()
    .setName('burndown')
    .setDescription('Manage sprint burndown charts')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('register')
        .setDescription('Register a new sprint')
        .addStringOption((option) =>
          option.setName('name').setDescription('Name of the sprint').setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('start_date')
            .setDescription('Start date of the sprint (YYYY-MM-DD)')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('end_date')
            .setDescription('End date of the sprint (YYYY-MM-DD)')
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName('total_points')
            .setDescription('Total story points for the sprint')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('view')
        .setDescription('View a burndown chart for a registered sprint')
        .addIntegerOption((option) =>
          option
            .setName('index')
            .setDescription('Index of the sprint to view (from list command)')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('list').setDescription('List all registered sprints'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('delete')
        .setDescription('Delete a registered sprint')
        .addIntegerOption((option) =>
          option
            .setName('index')
            .setDescription('Index of the sprint to delete (from list command)')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('record')
        .setDescription('Record points achieved for a specific day')
        .addIntegerOption((option) =>
          option
            .setName('index')
            .setDescription('Index of the sprint (from list command)')
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName('points_achieved')
            .setDescription('Points achieved on this day')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('date')
            .setDescription('Date for the record (YYYY-MM-DD, defaults to today)')
            .setRequired(false),
        ),
    ) as SlashCommandBuilder;

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'register':
        await this.handleRegisterSprint(interaction);
        break;
      case 'view':
        await this.handleViewBurndown(interaction);
        break;
      case 'list':
        await this.handleListSprints(interaction);
        break;
      case 'delete':
        await this.handleDeleteSprint(interaction);
        break;
      case 'record':
        await this.handleRecordProgress(interaction);
        break;
      default:
        await interaction.reply({ content: 'Unknown subcommand.', flags: MessageFlags.Ephemeral });
    }
  }

  // Handle registering a new sprint
  async handleRegisterSprint(interaction: ChatInputCommandInteraction) {
    const name = interaction.options.getString('name', true);
    const startDateStr = interaction.options.getString('start_date', true);
    const endDateStr = interaction.options.getString('end_date', true);
    const totalPoints = interaction.options.getInteger('total_points', true);

    // Validate date formats (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr) || !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
      await interaction.reply({
        content: 'Invalid date format. Please use YYYY-MM-DD (e.g., 2023-12-31).',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Validate total points
    if (totalPoints <= 0) {
      await interaction.reply({
        content: 'Total points must be a positive number.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Parse dates
    const startDate = dayjs(startDateStr);
    const endDate = dayjs(endDateStr);

    // Validate date range
    if (!startDate.isValid() || !endDate.isValid()) {
      await interaction.reply({
        content: 'Invalid date. Please check your date format.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (endDate.isBefore(startDate)) {
      await interaction.reply({
        content: 'End date cannot be before start date.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Create the sprint
    const sprint: Sprint = {
      name,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalPoints,
      userId: interaction.user.id,
      guildId: interaction.guildId || '',
      createdAt: new Date().toISOString(),
      dailyProgress: [], // Initialize empty daily progress array
    };

    // Add to sprints array
    sprints.push(sprint);
    saveSprints(sprints);

    // Create an embed for the confirmation
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Sprint Registered')
      .setDescription(`Sprint "${name}" has been registered`)
      .addFields(
        { name: 'Start Date', value: startDateStr, inline: true },
        { name: 'End Date', value: endDateStr, inline: true },
        { name: 'Total Points', value: totalPoints.toString(), inline: true },
        {
          name: 'Duration',
          value: `${endDate.diff(startDate, 'day')} days`,
          inline: true,
        },
      )
      .setTimestamp()
      .setFooter({ text: `Registered by ${interaction.user.tag}` });

    await interaction.reply({ embeds: [embed] });
  }

  // Helper function to check if a date is a weekend (Saturday or Sunday)
  private isWeekend(date: dayjs.Dayjs): boolean {
    const dayOfWeek = date.day(); // 0 = Sunday, 6 = Saturday
    return dayOfWeek === 0 || dayOfWeek === 6;
  }

  // Helper function to get working days between two dates (excluding weekends)
  private getWorkingDaysBetween(startDate: dayjs.Dayjs, endDate: dayjs.Dayjs): number {
    let workingDays = 0;
    let currentDate = startDate;

    while (currentDate.isSameOrBefore(endDate, 'day')) {
      if (!this.isWeekend(currentDate)) {
        workingDays++;
      }
      currentDate = currentDate.add(1, 'day');
    }

    return workingDays;
  }

  // Helper function to get the nth working day from start date
  private getNthWorkingDay(startDate: dayjs.Dayjs, workingDayIndex: number): dayjs.Dayjs {
    let currentDate = startDate;
    let workingDaysCount = 0;

    while (workingDaysCount < workingDayIndex) {
      if (!this.isWeekend(currentDate)) {
        workingDaysCount++;
      }
      if (workingDaysCount < workingDayIndex) {
        currentDate = currentDate.add(1, 'day');
      }
    }

    return currentDate;
  }

  // Handle viewing a burndown chart
  async handleViewBurndown(interaction: ChatInputCommandInteraction) {
    const sprintIndex = interaction.options.getInteger('index', true) - 1; // Convert to 0-based index

    // Check if index is valid
    if (sprintIndex < 0 || sprintIndex >= sprints.length) {
      await interaction.reply({
        content: `Invalid sprint index. Use /burndown list to see available sprints.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Get the sprint at the specified index
    const sprint = sprints[sprintIndex];

    // Calculate completed points from daily progress data
    let completedPoints = 0;
    if (sprint.dailyProgress && sprint.dailyProgress.length > 0) {
      // Find the most recent progress record to get total completed points
      const sortedProgress = [...sprint.dailyProgress].sort((a, b) => a.date.localeCompare(b.date));
      const latestProgress = sortedProgress[sortedProgress.length - 1];
      completedPoints = latestProgress.totalPointsCompleted;
    }

    await interaction.deferReply();

    try {
      const startDate = dayjs(sprint.startDate);
      const endDate = dayjs(sprint.endDate);
      const today = dayjs();

      // Calculate sprint duration in working days (excluding weekends)
      const sprintDays = this.getWorkingDaysBetween(startDate, endDate) - 1; // -1 because we want the number of intervals, not days

      // Calculate working days completed
      let daysCompleted = this.getWorkingDaysBetween(startDate, today.isBefore(endDate) ? today : endDate) - 1;

      // Ensure daysCompleted is within bounds
      if (daysCompleted < 0) daysCompleted = 0;
      if (daysCompleted > sprintDays) daysCompleted = sprintDays;

      // Calculate remaining points
      const remainingPoints = sprint.totalPoints - completedPoints;

      // Calculate ideal burndown line (using working days only)
      const idealBurndown = [];
      for (let workingDay = 0; workingDay <= sprintDays; workingDay++) {
        const idealRemaining = sprint.totalPoints - (sprint.totalPoints * workingDay) / sprintDays;
        idealBurndown.push(Math.round(idealRemaining * 100) / 100); // Round to 2 decimal places
      }

      // Calculate actual burndown line
      const actualBurndown = [];

      // Use actual daily progress data if available, otherwise fall back to interpolation
      if (sprint.dailyProgress && sprint.dailyProgress.length > 0) {
        // Sort daily progress by date
        const sortedProgress = [...sprint.dailyProgress].sort((a, b) =>
          a.date.localeCompare(b.date),
        );

        // Fill in actual data for each working day
        for (let workingDay = 0; workingDay <= daysCompleted; workingDay++) {
          const currentDate = this.getNthWorkingDay(startDate, workingDay).format('YYYY-MM-DD');

          // Find progress record for this date
          const progressRecord = sortedProgress.find((record) => record.date === currentDate);

          if (progressRecord) {
            // Use actual data: total points - total completed points = remaining points
            const remainingForDay = sprint.totalPoints - progressRecord.totalPointsCompleted;
            actualBurndown.push(Math.round(remainingForDay * 100) / 100);
          } else {
            // Find the most recent progress record before this date
            const previousRecord = sortedProgress
              .filter((record) => record.date < currentDate)
              .pop(); // Get the last (most recent) record

            if (previousRecord) {
              // Use the most recent data
              const remainingForDay = sprint.totalPoints - previousRecord.totalPointsCompleted;
              actualBurndown.push(Math.round(remainingForDay * 100) / 100);
            } else {
              // No progress recorded yet, all points remain
              actualBurndown.push(sprint.totalPoints);
            }
          }
        }
      } else {
        // Fall back to linear interpolation when no daily progress data is available
        for (let workingDay = 0; workingDay <= daysCompleted; workingDay++) {
          if (workingDay === daysCompleted) {
            actualBurndown.push(remainingPoints);
          } else {
            // Linear interpolation for past working days
            const pastRemaining = sprint.totalPoints - (completedPoints * workingDay) / daysCompleted;
            actualBurndown.push(Math.round(pastRemaining * 100) / 100);
          }
        }
      }

      // Generate labels for the x-axis (working days only)
      const labels = [];

      for (let workingDay = 0; workingDay <= sprintDays; workingDay++) {
        const date = this.getNthWorkingDay(startDate, workingDay);
        labels.push(date.format('MM/DD'));
      }

      // Create chart configuration
      const chartConfig = {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Ideal Burndown',
              data: idealBurndown,
              borderColor: 'rgba(54, 162, 235, 1)',
              backgroundColor: 'rgba(54, 162, 235, 0.2)',
              borderWidth: 2,
              fill: false,
            },
            {
              label: 'Actual Burndown',
              data: actualBurndown,
              borderColor: 'rgba(255, 99, 132, 1)',
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              borderWidth: 2,
              fill: false,
              // Only show points for days we have data
              pointRadius: Array(sprintDays + 1)
                .fill(0)
                .map((_, i) => (i <= daysCompleted ? 5 : 0)),
            },
          ],
        },
        options: {
          title: {
            display: true,
            text: `Burndown Chart - ${sprint.name} (Weekends Excluded)`,
            fontSize: 16,
          },
          scales: {
            x: {
              title: {
                display: true,
                text: 'Working Days',
              },
            },
            y: {
              title: {
                display: true,
                text: 'Story Points Remaining',
              },
              min: 0,
              max: Math.ceil(sprint.totalPoints * 1.1), // Add 10% padding to the top
            },
          },
        },
      };

      // Encode the chart configuration for the URL
      const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));
      const chartUrl = `https://quickchart.io/chart?c=${encodedConfig}`;

      // Create an embed with the chart
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`Burndown Chart - ${sprint.name} (Weekends Excluded)`)
        .setDescription(`Sprint progress: Working day ${daysCompleted} of ${sprintDays}`)
        .addFields(
          { name: 'Total Story Points', value: sprint.totalPoints.toString(), inline: true },
          { name: 'Remaining Points', value: remainingPoints.toString(), inline: true },
          { name: 'Completed Points', value: completedPoints.toString(), inline: true },
          {
            name: 'Completion Rate',
            value: `${Math.round((completedPoints / sprint.totalPoints) * 100)}%`,
            inline: true,
          },
          {
            name: 'Sprint Progress',
            value: `${Math.round((daysCompleted / sprintDays) * 100)}%`,
            inline: true,
          },
        )
        .setImage(chartUrl)
        .setTimestamp()
        .setFooter({ text: 'Generated with QuickChart.io' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error generating burndown chart:', error);
      await interaction.editReply(
        'An error occurred while generating the burndown chart. Please check the logs for details.',
      );
    }
  }

  // Handle listing sprints
  async handleListSprints(interaction: ChatInputCommandInteraction) {
    if (sprints.length === 0) {
      await interaction.reply({ content: 'No sprints registered.', flags: MessageFlags.Ephemeral });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Registered Sprints')
      .setTimestamp()
      .setFooter({ text: `Requested by ${interaction.user.tag}` });

    // Add fields for each sprint
    sprints.forEach((sprint, index) => {
      const startDate = dayjs(sprint.startDate).format('YYYY-MM-DD');
      const endDate = dayjs(sprint.endDate).format('YYYY-MM-DD');
      const duration = dayjs(sprint.endDate).diff(dayjs(sprint.startDate), 'day');

      embed.addFields({
        name: `${index + 1}. ${sprint.name}`,
        value: `Start: ${startDate}\nEnd: ${endDate}\nDuration: ${duration} days\nTotal Points: ${sprint.totalPoints}`,
      });
    });

    await interaction.reply({ embeds: [embed] });
  }

  // Handle deleting a sprint
  async handleDeleteSprint(interaction: ChatInputCommandInteraction) {
    const sprintIndex = interaction.options.getInteger('index', true) - 1; // Convert to 0-based index

    // Check if index is valid
    if (sprintIndex < 0 || sprintIndex >= sprints.length) {
      await interaction.reply({
        content: `Invalid sprint index. Use /burndown list to see available sprints.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Remove the sprint
    const deletedSprint = sprints.splice(sprintIndex, 1)[0];
    saveSprints(sprints);

    // Create an embed for the confirmation
    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('Sprint Deleted')
      .setDescription(`Sprint "${deletedSprint.name}" has been deleted`)
      .addFields(
        {
          name: 'Start Date',
          value: dayjs(deletedSprint.startDate).format('YYYY-MM-DD'),
          inline: true,
        },
        {
          name: 'End Date',
          value: dayjs(deletedSprint.endDate).format('YYYY-MM-DD'),
          inline: true,
        },
        { name: 'Total Points', value: deletedSprint.totalPoints.toString(), inline: true },
      )
      .setTimestamp()
      .setFooter({ text: `Deleted by ${interaction.user.tag}` });

    await interaction.reply({ embeds: [embed] });
  }

  // Handle recording daily progress
  async handleRecordProgress(interaction: ChatInputCommandInteraction) {
    const sprintIndex = interaction.options.getInteger('index', true) - 1; // Convert to 0-based index
    const pointsAchieved = interaction.options.getInteger('points_achieved', true);
    const dateStr = interaction.options.getString('date') || dayjs().format('YYYY-MM-DD');

    // Check if index is valid
    if (sprintIndex < 0 || sprintIndex >= sprints.length) {
      await interaction.reply({
        content: `Invalid sprint index. Use /burndown list to see available sprints.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      await interaction.reply({
        content: 'Invalid date format. Please use YYYY-MM-DD (e.g., 2023-12-31).',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const sprint = sprints[sprintIndex];
    const recordDate = dayjs(dateStr);
    const sprintStart = dayjs(sprint.startDate);
    const sprintEnd = dayjs(sprint.endDate);

    // Validate date is within sprint range
    if (recordDate.isBefore(sprintStart, 'day') || recordDate.isAfter(sprintEnd, 'day')) {
      await interaction.reply({
        content: `Date must be within the sprint range (${sprintStart.format('YYYY-MM-DD')} to ${sprintEnd.format('YYYY-MM-DD')}).`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Validate points achieved
    if (pointsAchieved < 0) {
      await interaction.reply({
        content: 'Points achieved cannot be negative.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Initialize dailyProgress array if it doesn't exist
    if (!sprint.dailyProgress) {
      sprint.dailyProgress = [];
    }

    // Check if there's already a record for this date
    const existingRecordIndex = sprint.dailyProgress.findIndex((record) => record.date === dateStr);

    // Calculate total points completed up to this date
    let totalPointsCompleted = 0;
    const sortedProgress = [...sprint.dailyProgress]
      .filter((record) => record.date !== dateStr) // Exclude current date if updating
      .sort((a, b) => a.date.localeCompare(b.date));

    // Add up all points up to the day before this record
    for (const record of sortedProgress) {
      if (record.date < dateStr) {
        totalPointsCompleted += record.pointsCompleted;
      }
    }

    // Add the new points for this day
    totalPointsCompleted += pointsAchieved;

    // Validate that total doesn't exceed sprint total
    if (totalPointsCompleted > sprint.totalPoints) {
      await interaction.reply({
        content: `Total completed points (${totalPointsCompleted}) would exceed sprint total (${sprint.totalPoints}). Current record would add ${pointsAchieved} points.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Create or update the daily progress record
    const progressRecord: DailyProgress = {
      date: dateStr,
      pointsCompleted: pointsAchieved,
      totalPointsCompleted: totalPointsCompleted,
    };

    if (existingRecordIndex >= 0) {
      // Update existing record
      sprint.dailyProgress[existingRecordIndex] = progressRecord;
    } else {
      // Add new record
      sprint.dailyProgress.push(progressRecord);
    }

    // Recalculate totalPointsCompleted for all records after this date
    const allRecords = sprint.dailyProgress.sort((a, b) => a.date.localeCompare(b.date));
    let runningTotal = 0;

    for (const record of allRecords) {
      runningTotal += record.pointsCompleted;
      record.totalPointsCompleted = runningTotal;
    }

    // Save the updated sprints
    saveSprints(sprints);

    // Create confirmation embed
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('Daily Progress Recorded')
      .setDescription(`Progress recorded for sprint "${sprint.name}"`)
      .addFields(
        { name: 'Date', value: dateStr, inline: true },
        { name: 'Points Achieved', value: pointsAchieved.toString(), inline: true },
        { name: 'Total Completed', value: totalPointsCompleted.toString(), inline: true },
        {
          name: 'Remaining Points',
          value: (sprint.totalPoints - totalPointsCompleted).toString(),
          inline: true,
        },
      )
      .setTimestamp()
      .setFooter({ text: `Recorded by ${interaction.user.tag}` });

    await interaction.reply({ embeds: [embed] });
  }
}

const command = new BurndownCommand();

module.exports = command;
