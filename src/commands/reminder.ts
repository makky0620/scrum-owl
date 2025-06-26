import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  ChannelType,
  TextChannel,
  EmbedBuilder
} from 'discord.js';
import { Command } from '../command';
import * as fs from 'fs';
import * as path from 'path';
import dayjs from '../utils/dayjs';

// Interface for reminder data
interface Reminder {
  channelId: string;
  message: string;
  content?: string[]; // Array of content items
  time: Date;
  userId: string;
  guildId: string;
  recurring?: boolean;
  frequency?: 'daily';
  timeOfDay?: string; // Format: HH:MM
}

// File path for storing reminders
const remindersFilePath = path.join(__dirname, '../../data/reminders.json');

// Ensure the data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Function to save reminders to file
function saveReminders(reminders: Reminder[]) {
  // Convert Date objects to strings for JSON serialization
  const remindersToSave = reminders.map(reminder => ({
    ...reminder,
    time: reminder.time.toISOString()
  }));

  try {
    fs.writeFileSync(remindersFilePath, JSON.stringify(remindersToSave, null, 2));
    console.log('Reminders saved to file');
  } catch (error) {
    console.error('Error saving reminders to file:', error);
  }
}

// Function to load reminders from file
function loadReminders(): Reminder[] {
  try {
    if (fs.existsSync(remindersFilePath)) {
      const data = fs.readFileSync(remindersFilePath, 'utf8');
      const parsedReminders = JSON.parse(data);

      // Convert string dates back to Date objects
      return parsedReminders.map((reminder: any) => ({
        ...reminder,
        time: new Date(reminder.time)
      }));
    }
  } catch (error) {
    console.error('Error loading reminders from file:', error);
  }
  return [];
}

// Load reminders from file or initialize empty array
const reminders: Reminder[] = loadReminders();

// Check for reminders every minute
setInterval(() => {
  checkReminders();
}, 60 * 1000);

// Function to check and trigger reminders
async function checkReminders() {
  const now = new Date();
  const triggeredReminders: Reminder[] = [];
  let remindersModified = false;

  // Find reminders that should be triggered
  for (let i = 0; i < reminders.length; i++) {
    const reminder = reminders[i];
    if (reminder.time <= now) {
      triggeredReminders.push({ ...reminder });

      if (reminder.recurring && reminder.frequency === 'daily' && reminder.timeOfDay) {
        // For recurring daily reminders, update the time to the next day
        const [hours, minutes] = reminder.timeOfDay.split(':').map(Number);
        const nextTime = new Date();
        nextTime.setDate(nextTime.getDate() + 1);
        nextTime.setHours(hours, minutes, 0, 0);
        reminder.time = nextTime;
        remindersModified = true;
      } else {
        // For one-time reminders, remove them from the array
        reminders.splice(i, 1);
        i--; // Adjust index after removing an element
        remindersModified = true;
      }
    }
  }

  // Save reminders if any were modified
  if (remindersModified) {
    saveReminders(reminders);
  }

  // Trigger each reminder
  for (const reminder of triggeredReminders) {
    try {
      const client = (await import('../index')).client;
      const channel = await client.channels.fetch(reminder.channelId) as TextChannel;

      if (channel && channel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle(reminder.recurring ? 'Daily Reminder' : 'Reminder')
          .setDescription(reminder.message);

        // Add content items if they exist
        if (reminder.content && reminder.content.length > 0) {
          const contentText = reminder.content.map(item => `• ${item}`).join('\n');
          embed.addFields({ name: 'Content', value: contentText });
        }

        embed.setTimestamp()
          .setFooter({ text: `Reminder set by <@${reminder.userId}>` });

        await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error sending reminder:', error);
    }
  }
}

// Create a class that implements the Command interface
class ReminderCommand implements Command {
  data = new SlashCommandBuilder()
    .setName('reminder')
    .setDescription('Set a reminder')
    .addSubcommand(subcommand =>
      subcommand
        .setName('once')
        .setDescription('Set a one-time reminder for a specific date and time')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('The channel to send the reminder to')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText))
        .addStringOption(option =>
          option.setName('message')
            .setDescription('The message to send')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('date')
            .setDescription('The date for the reminder (YYYY-MM-DD)')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('time')
            .setDescription('The time for the reminder (HH:MM)')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('daily')
        .setDescription('Set a daily reminder at a specific time')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('The channel to send the reminder to')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText))
        .addStringOption(option =>
          option.setName('message')
            .setDescription('The message to send')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('time')
            .setDescription('The time for the daily reminder (HH:MM)')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all active reminders'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a reminder')
        .addIntegerOption(option =>
          option.setName('index')
            .setDescription('The index of the reminder to delete')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('add-content')
        .setDescription('Add content to an existing reminder')
        .addIntegerOption(option =>
          option.setName('index')
            .setDescription('The index of the reminder to add content to')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('content')
            .setDescription('The content to add to the reminder')
            .setRequired(true))) as SlashCommandBuilder;

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'once':
        await this.handleOnceReminder(interaction);
        break;
      case 'daily':
        await this.handleDailyReminder(interaction);
        break;
      case 'list':
        await this.handleListReminders(interaction);
        break;
      case 'delete':
        await this.handleDeleteReminder(interaction);
        break;
      case 'add-content':
        await this.handleAddContent(interaction);
        break;
      default:
        await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
    }
  }

  // Handle one-time reminder
  async handleOnceReminder(interaction: ChatInputCommandInteraction) {
    const channel = interaction.options.getChannel('channel', true) as TextChannel;
    const message = interaction.options.getString('message', true);
    const dateStr = interaction.options.getString('date', true);
    const timeStr = interaction.options.getString('time', true);

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      await interaction.reply({ content: 'Invalid date format. Please use YYYY-MM-DD (e.g., 2023-12-31).', ephemeral: true });
      return;
    }

    // Validate time format (HH:MM)
    if (!/^\d{2}:\d{2}$/.test(timeStr)) {
      await interaction.reply({ content: 'Invalid time format. Please use HH:MM (e.g., 14:30).', ephemeral: true });
      return;
    }

    // Parse date and time
    const dateTimeStr = `${dateStr} ${timeStr}`;
    const reminderTime = dayjs(dateTimeStr).toDate();

    // Check if the time is in the past
    if (reminderTime <= new Date()) {
      await interaction.reply({ content: 'Cannot set a reminder for a time in the past.', ephemeral: true });
      return;
    }

    // Create the reminder
    const reminder: Reminder = {
      channelId: channel.id,
      message,
      time: reminderTime,
      userId: interaction.user.id,
      guildId: interaction.guildId || '',
      recurring: false
    };

    // Add to reminders array
    reminders.push(reminder);
    saveReminders(reminders);

    // Format the confirmation message
    const formattedTime = dayjs(reminderTime).format('YYYY-MM-DD HH:mm');

    // Create an embed for the confirmation
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('One-time Reminder Set')
      .setDescription(`I'll remind <#${channel.id}> at ${formattedTime}`)
      .addFields(
        { name: 'Message', value: message }
      )
      .setTimestamp()
      .setFooter({ text: `Requested by ${interaction.user.tag}` });

    await interaction.reply({ embeds: [embed] });
  }

  // Handle daily reminder
  async handleDailyReminder(interaction: ChatInputCommandInteraction) {
    const channel = interaction.options.getChannel('channel', true) as TextChannel;
    const message = interaction.options.getString('message', true);
    const timeStr = interaction.options.getString('time', true);

    // Validate time format (HH:MM)
    if (!/^\d{2}:\d{2}$/.test(timeStr)) {
      await interaction.reply({ content: 'Invalid time format. Please use HH:MM (e.g., 14:30).', ephemeral: true });
      return;
    }

    // Parse time
    const [hours, minutes] = timeStr.split(':').map(Number);

    // Set the first occurrence to today at the specified time
    const reminderTime = new Date();
    reminderTime.setHours(hours, minutes, 0, 0);

    // If the time has already passed today, set it for tomorrow
    if (reminderTime <= new Date()) {
      reminderTime.setDate(reminderTime.getDate() + 1);
    }

    // Create the reminder
    const reminder: Reminder = {
      channelId: channel.id,
      message,
      time: reminderTime,
      userId: interaction.user.id,
      guildId: interaction.guildId || '',
      recurring: true,
      frequency: 'daily',
      timeOfDay: timeStr
    };

    // Add to reminders array
    reminders.push(reminder);
    saveReminders(reminders);

    // Create an embed for the confirmation
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Daily Reminder Set')
      .setDescription(`I'll remind <#${channel.id}> daily at ${timeStr}`)
      .addFields(
        { name: 'Message', value: message },
        { name: 'First Occurrence', value: dayjs(reminderTime).format('YYYY-MM-DD HH:mm') }
      )
      .setTimestamp()
      .setFooter({ text: `Requested by ${interaction.user.tag}` });

    await interaction.reply({ embeds: [embed] });
  }

  // Handle listing reminders
  async handleListReminders(interaction: ChatInputCommandInteraction) {
    if (reminders.length === 0) {
      await interaction.reply({ content: 'No active reminders.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Active Reminders')
      .setTimestamp()
      .setFooter({ text: `Requested by ${interaction.user.tag}` });

    // Add fields for each reminder
    reminders.forEach((reminder, index) => {
      const channelMention = `<#${reminder.channelId}>`;
      const timeStr = dayjs(reminder.time).format('YYYY-MM-DD HH:mm');
      const typeStr = reminder.recurring ? `Daily at ${reminder.timeOfDay}` : 'One-time';

      let value = `Channel: ${channelMention}\nTime: ${timeStr}\nMessage: ${reminder.message}`;

      // Add content items if they exist
      if (reminder.content && reminder.content.length > 0) {
        const contentText = reminder.content.map(item => `• ${item}`).join('\n');
        value += `\n\nContent:\n${contentText}`;
      }

      embed.addFields({
        name: `${index + 1}. ${typeStr}`,
        value: value
      });
    });

    await interaction.reply({ embeds: [embed] });
  }

  // Handle deleting a reminder
  async handleDeleteReminder(interaction: ChatInputCommandInteraction) {
    const index = interaction.options.getInteger('index', true) - 1;

    if (index < 0 || index >= reminders.length) {
      await interaction.reply({ content: 'Invalid reminder index.', ephemeral: true });
      return;
    }

    const deletedReminder = reminders.splice(index, 1)[0];
    saveReminders(reminders);

    const typeStr = deletedReminder.recurring ? 'Daily' : 'One-time';
    const timeStr = dayjs(deletedReminder.time).format('YYYY-MM-DD HH:mm');

    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('Reminder Deleted')
      .setDescription(`Deleted a ${typeStr.toLowerCase()} reminder`)
      .addFields(
        { name: 'Channel', value: `<#${deletedReminder.channelId}>` },
        { name: 'Time', value: timeStr },
        { name: 'Message', value: deletedReminder.message }
      )
      .setTimestamp()
      .setFooter({ text: `Requested by ${interaction.user.tag}` });

    await interaction.reply({ embeds: [embed] });
  }

  // Handle adding content to a reminder
  async handleAddContent(interaction: ChatInputCommandInteraction) {
    const index = interaction.options.getInteger('index', true) - 1;
    const content = interaction.options.getString('content', true);

    if (index < 0 || index >= reminders.length) {
      await interaction.reply({ content: 'Invalid reminder index.', ephemeral: true });
      return;
    }

    const reminder = reminders[index];

    // Initialize content array if it doesn't exist
    if (!reminder.content) {
      reminder.content = [];
    }

    // Add the new content item
    reminder.content.push(content);

    // Save the updated reminders
    saveReminders(reminders);

    // Format the confirmation message
    const typeStr = reminder.recurring ? 'Daily' : 'One-time';
    const timeStr = dayjs(reminder.time).format('YYYY-MM-DD HH:mm');

    // Create a list of all content items
    const contentList = reminder.content.map(item => `• ${item}`).join('\n');

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Content Added to Reminder')
      .setDescription(`Added content to a ${typeStr.toLowerCase()} reminder`)
      .addFields(
        { name: 'Channel', value: `<#${reminder.channelId}>` },
        { name: 'Time', value: timeStr },
        { name: 'Message', value: reminder.message },
        { name: 'Content', value: contentList }
      )
      .setTimestamp()
      .setFooter({ text: `Requested by ${interaction.user.tag}` });

    await interaction.reply({ embeds: [embed] });
  }
}

const command = new ReminderCommand();

module.exports = command;
