import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ComponentType,
  ChatInputCommandInteraction,
  ButtonInteraction,
  Message
} from 'discord.js';
import { Command } from '../command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('pairtimer')
    .setDescription('Start a timer for pair programming sessions')
    .addIntegerOption(option =>
      option.setName('minutes')
        .setDescription('Duration in minutes (default: 25)')
        .setRequired(false)) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    // Get the duration from options or use default (25 minutes)
    const minutes = interaction.options.getInteger('minutes') || 25;
    const durationMs = minutes * 60 * 1000;
    
    // Create initial embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Pair Programming Timer')
      .setDescription(`Timer set for ${minutes} minutes`)
      .addFields(
        { name: 'Status', value: 'Ready to start', inline: true },
        { name: 'Time Remaining', value: `${minutes}:00`, inline: true },
        { name: 'Participants', value: `Started by: ${interaction.user.username}`, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'Use the buttons below to control the timer' });

    // Create control buttons
    const controlRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('start_timer')
          .setLabel('Start')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('pause_timer')
          .setLabel('Pause')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('reset_timer')
          .setLabel('Reset')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('end_timer')
          .setLabel('End')
          .setStyle(ButtonStyle.Danger)
      );

    // Send the initial message with the embed and buttons
    const message = await interaction.reply({
      embeds: [embed],
      components: [controlRow],
      fetchReply: true
    }) as Message;

    // Variables to track timer state
    let startTime: number | null = null;
    let pauseTime: number | null = null;
    let remainingMs = durationMs;
    let timerInterval: NodeJS.Timeout | null = null;
    let isRunning = false;

    // Function to update the timer display
    const updateTimerDisplay = async () => {
      if (!isRunning) return;
      
      const now = Date.now();
      const elapsedSincePause = startTime ? now - startTime : 0;
      remainingMs = Math.max(0, remainingMs - elapsedSincePause);
      
      if (remainingMs <= 0) {
        // Timer finished
        clearInterval(timerInterval!);
        isRunning = false;
        
        embed.setColor('#FF0000');
        embed.spliceFields(0, 1, { name: 'Status', value: 'Time\'s up!', inline: true });
        embed.spliceFields(1, 1, { name: 'Time Remaining', value: '0:00', inline: true });
        
        const finishedRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('start_timer')
              .setLabel('Start')
              .setStyle(ButtonStyle.Success)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('pause_timer')
              .setLabel('Pause')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('reset_timer')
              .setLabel('Reset')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('end_timer')
              .setLabel('End')
              .setStyle(ButtonStyle.Danger)
          );
        
        await message.edit({
          embeds: [embed],
          components: [finishedRow]
        });
        
        // Notify that time is up
        await interaction.followUp({
          content: '⏰ Time\'s up! The pair programming session has ended.',
          ephemeral: false
        });
        
        return;
      }
      
      // Update the timer display
      const minutes = Math.floor(remainingMs / 60000);
      const seconds = Math.floor((remainingMs % 60000) / 1000);
      const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      embed.spliceFields(1, 1, { name: 'Time Remaining', value: timeString, inline: true });
      
      // Reset the start time to now for the next update
      startTime = now;
      
      await message.edit({
        embeds: [embed]
      });
    };

    // Create a collector for button interactions
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: (durationMs + 5 * 60 * 1000) // Timer duration plus 5 minutes
    });

    collector.on('collect', async (i: ButtonInteraction) => {
      // Verify that the user who clicked is the one who started the timer or has appropriate permissions
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: 'Only the person who started the timer can control it.', ephemeral: true });
        return;
      }

      const customId = i.customId;

      switch (customId) {
        case 'start_timer':
          // Start or resume the timer
          isRunning = true;
          startTime = Date.now();
          
          // Update status
          embed.spliceFields(0, 1, { name: 'Status', value: 'Running', inline: true });
          
          // Update button states
          const runningRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('start_timer')
                .setLabel('Start')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId('pause_timer')
                .setLabel('Pause')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(false),
              new ButtonBuilder()
                .setCustomId('reset_timer')
                .setLabel('Reset')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('end_timer')
                .setLabel('End')
                .setStyle(ButtonStyle.Danger)
            );
          
          await i.update({
            embeds: [embed],
            components: [runningRow]
          });
          
          // Start the interval to update the timer
          timerInterval = setInterval(updateTimerDisplay, 1000);
          break;
          
        case 'pause_timer':
          // Pause the timer
          isRunning = false;
          if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
          }
          
          // Update the remaining time before pausing
          await updateTimerDisplay();
          
          // Update status
          embed.spliceFields(0, 1, { name: 'Status', value: 'Paused', inline: true });
          
          // Update button states
          const pausedRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('start_timer')
                .setLabel('Resume')
                .setStyle(ButtonStyle.Success)
                .setDisabled(false),
              new ButtonBuilder()
                .setCustomId('pause_timer')
                .setLabel('Pause')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId('reset_timer')
                .setLabel('Reset')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('end_timer')
                .setLabel('End')
                .setStyle(ButtonStyle.Danger)
            );
          
          await i.update({
            embeds: [embed],
            components: [pausedRow]
          });
          break;
          
        case 'reset_timer':
          // Reset the timer
          isRunning = false;
          if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
          }
          
          // Reset remaining time
          remainingMs = durationMs;
          
          // Update status and time
          embed.spliceFields(0, 1, { name: 'Status', value: 'Ready to start', inline: true });
          embed.spliceFields(1, 1, { 
            name: 'Time Remaining', 
            value: `${minutes}:00`, 
            inline: true 
          });
          
          // Update button states
          const resetRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('start_timer')
                .setLabel('Start')
                .setStyle(ButtonStyle.Success)
                .setDisabled(false),
              new ButtonBuilder()
                .setCustomId('pause_timer')
                .setLabel('Pause')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId('reset_timer')
                .setLabel('Reset')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('end_timer')
                .setLabel('End')
                .setStyle(ButtonStyle.Danger)
            );
          
          await i.update({
            embeds: [embed],
            components: [resetRow]
          });
          break;
          
        case 'end_timer':
          // End the timer session
          isRunning = false;
          if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
          }
          
          // Update status
          embed.setColor('#FF0000');
          embed.spliceFields(0, 1, { name: 'Status', value: 'Ended', inline: true });
          
          await i.update({
            embeds: [embed],
            components: [] // Remove all buttons
          });
          
          // Stop the collector
          collector.stop();
          break;
      }
    });

    collector.on('end', async () => {
      // Clean up when the collector ends
      if (timerInterval) {
        clearInterval(timerInterval);
      }
      
      // Only update if the timer wasn't explicitly ended
      if (isRunning) {
        embed.setColor('#FF0000');
        embed.spliceFields(0, 1, { name: 'Status', value: 'Session timed out', inline: true });
        
        await message.edit({
          embeds: [embed],
          components: [] // Remove all buttons
        });
      }
    });
  },
};

module.exports = command;