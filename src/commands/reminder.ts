import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  ChannelType,
} from 'discord.js';
import { Command } from '../command';
import { ReminderService, CreateReminderData, UpdateReminderData } from '../services/reminderService';

const reminderService = new ReminderService();

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('reminder')
    .setDescription('Manage reminders')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new reminder')
        .addStringOption(option =>
          option
            .setName('title')
            .setDescription('Title of the reminder')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('message')
            .setDescription('Message content of the reminder')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('time')
            .setDescription('When to trigger (e.g., "14:30", "2h", "2024-07-15 14:30")')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Type of reminder')
            .setRequired(true)
            .addChoices(
              { name: 'Once', value: 'once' },
              { name: 'Daily', value: 'daily' }
            )
        )
        .addBooleanOption(option =>
          option
            .setName('skip_weekends')
            .setDescription('Skip weekends for daily reminders')
            .setRequired(false)
        )
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel to send the reminder to (defaults to current channel)')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List your reminders')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a reminder')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('ID of the reminder to delete')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('Edit a reminder')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('ID of the reminder to edit')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('title')
            .setDescription('New title')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('message')
            .setDescription('New message')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('time')
            .setDescription('New time')
            .setRequired(false)
        )
        .addBooleanOption(option =>
          option
            .setName('active')
            .setDescription('Set reminder active/inactive')
            .setRequired(false)
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'create':
          await handleCreate(interaction);
          break;
        case 'list':
          await handleList(interaction);
          break;
        case 'delete':
          await handleDelete(interaction);
          break;
        case 'edit':
          await handleEdit(interaction);
          break;
        default:
          await interaction.reply({
            content: 'Unknown subcommand.',
            flags: MessageFlags.Ephemeral,
          });
      }
    } catch (error) {
      console.error('[Reminder Command] Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: `Error: ${errorMessage}`,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          content: `Error: ${errorMessage}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};

async function handleCreate(interaction: ChatInputCommandInteraction) {
  const title = interaction.options.getString('title', true);
  const message = interaction.options.getString('message', true);
  const time = interaction.options.getString('time', true);
  const type = interaction.options.getString('type', true) as 'once' | 'daily';
  const skipWeekends = interaction.options.getBoolean('skip_weekends');
  const specifiedChannel = interaction.options.getChannel('channel');

  // Determine which channel to use
  let targetChannelId: string;

  if (specifiedChannel) {
    // Validate that the specified channel is a text channel
    if (specifiedChannel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: 'Please specify a text channel for the reminder.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    targetChannelId = specifiedChannel.id;
  } else {
    // Use current channel as fallback
    targetChannelId = interaction.channelId!;
  }

  const createData: CreateReminderData = {
    userId: interaction.user.id,
    channelId: targetChannelId,
    guildId: interaction.guildId!,
    title,
    message,
    time,
    type,
  };

  if (type === 'daily' && skipWeekends) {
    createData.skipWeekends = skipWeekends;
  }

  const reminder = await reminderService.createReminder(createData);

  const embed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('✅ Reminder Created')
    .setDescription(`**${reminder.title}** has been created successfully!`)
    .addFields(
      { name: 'Message', value: reminder.message, inline: false },
      { name: 'Next Trigger', value: reminder.nextTriggerTime.toLocaleString(), inline: true },
      { name: 'Type', value: reminder.type, inline: true },
      { name: 'ID', value: reminder.id, inline: true }
    )
    .setTimestamp()
    .setFooter({ text: 'Scrum Owl Reminder' });

  if (reminder.type === 'daily' && reminder.dayFilter?.skipWeekends) {
    embed.addFields({ name: 'Skip Weekends', value: 'Yes', inline: true });
  }

  await interaction.reply({ embeds: [embed] });
}

async function handleList(interaction: ChatInputCommandInteraction) {
  const reminders = await reminderService.getUserReminders(interaction.user.id);

  if (reminders.length === 0) {
    await interaction.reply({
      content: 'You have no reminders.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('📋 Your Reminders')
    .setTimestamp()
    .setFooter({ text: 'Scrum Owl Reminder' });

  const activeReminders = reminders.filter(r => r.isActive);
  const inactiveReminders = reminders.filter(r => !r.isActive);

  if (activeReminders.length > 0) {
    const activeList = activeReminders.map(r => {
      const nextTrigger = r.nextTriggerTime.toLocaleString();
      const typeInfo = r.type === 'daily' ? ' (daily)' : '';
      const skipWeekendsInfo = r.type === 'daily' && r.dayFilter?.skipWeekends ? ' - Skip weekends' : '';
      return `**${r.title}**${typeInfo}${skipWeekendsInfo}\nID: \`${r.id}\`\nNext: ${nextTrigger}`;
    }).join('\n\n');

    embed.addFields({ name: '🟢 Active Reminders', value: activeList, inline: false });
  }

  if (inactiveReminders.length > 0) {
    const inactiveList = inactiveReminders.map(r => {
      return `**${r.title}**\nID: \`${r.id}\``;
    }).join('\n\n');

    embed.addFields({ name: '🔴 Inactive Reminders', value: inactiveList, inline: false });
  }

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleDelete(interaction: ChatInputCommandInteraction) {
  const id = interaction.options.getString('id', true);

  // Check if reminder exists and belongs to user
  const reminders = await reminderService.getUserReminders(interaction.user.id);
  const reminder = reminders.find(r => r.id === id);

  if (!reminder) {
    await interaction.reply({
      content: 'Reminder not found or you do not have permission to delete it.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await reminderService.deleteReminder(id);

  const embed = new EmbedBuilder()
    .setColor('#FF0000')
    .setTitle('🗑️ Reminder Deleted')
    .setDescription(`**${reminder.title}** has been deleted successfully.`)
    .setTimestamp()
    .setFooter({ text: 'Scrum Owl Reminder' });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleEdit(interaction: ChatInputCommandInteraction) {
  const id = interaction.options.getString('id', true);
  const title = interaction.options.getString('title');
  const message = interaction.options.getString('message');
  const time = interaction.options.getString('time');
  const active = interaction.options.getBoolean('active');

  // Check if reminder exists and belongs to user
  const reminders = await reminderService.getUserReminders(interaction.user.id);
  const reminder = reminders.find(r => r.id === id);

  if (!reminder) {
    await interaction.reply({
      content: 'Reminder not found or you do not have permission to edit it.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const updateData: UpdateReminderData = { id };

  if (title !== null) updateData.title = title;
  if (message !== null) updateData.message = message;
  if (time !== null) updateData.time = time;
  if (active !== null) updateData.isActive = active;

  const updatedReminder = await reminderService.updateReminder(updateData);

  const embed = new EmbedBuilder()
    .setColor('#FFA500')
    .setTitle('✏️ Reminder Updated')
    .setDescription(`**${updatedReminder.title}** has been updated successfully.`)
    .addFields(
      { name: 'Message', value: updatedReminder.message, inline: false },
      { name: 'Next Trigger', value: updatedReminder.nextTriggerTime.toLocaleString(), inline: true },
      { name: 'Status', value: updatedReminder.isActive ? 'Active' : 'Inactive', inline: true }
    )
    .setTimestamp()
    .setFooter({ text: 'Scrum Owl Reminder' });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
