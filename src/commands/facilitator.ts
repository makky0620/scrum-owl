import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
  ChatInputCommandInteraction,
  ButtonInteraction,
  User,
} from 'discord.js';
import { Command } from '../command';

// Emojis for game-like presentation
const emojis = ['🎲', '🎯', '🎮', '🎪', '🎭', '🎨', '🎬', '🎤', '🎧', '🎺', '🎸', '🎹', '🎻', '🎼'];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('facilitator')
    .setDescription('Randomly select a facilitator from a list of participants')
    .addStringOption((option) =>
      option
        .setName('participants')
        .setDescription('Comma-separated list of participant names')
        .setRequired(true),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    // Get the participants from the command options
    const participantsInput = interaction.options.getString('participants', true);
    const participants = participantsInput
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    if (participants.length === 0) {
      await interaction.reply({
        content: 'Please provide at least one participant name.',
        ephemeral: true,
      });
      return;
    }

    // Create an embed for the facilitator selection
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Facilitator Selection')
      .setDescription('Selecting a random facilitator...')
      .addFields({ name: 'Participants', value: participants.join('\n'), inline: false })
      .setTimestamp()
      .setFooter({ text: 'Click the button to start the selection' });

    // Create a button to start the selection
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('start_selection')
        .setLabel('Start Selection')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎲'),
      new ButtonBuilder()
        .setCustomId('cancel_selection')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger),
    );

    // Send the initial message with the embed and button
    const message = await interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true,
    });

    // Create a collector for button interactions
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 5 * 60 * 1000, // 5 minutes
    });

    collector.on('collect', async (i: ButtonInteraction) => {
      const customId = i.customId;

      if (customId === 'start_selection') {
        // Disable the buttons
        const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('start_selection')
            .setLabel('Selection in progress...')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎲')
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('cancel_selection')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true),
        );

        await i.update({
          embeds: [embed],
          components: [disabledRow],
        });

        // Simulate a "spinning wheel" effect
        const spinningEmojis = [...emojis];
        const spinningTimes = 10; // Number of "spins"
        const spinningInterval = 500; // Milliseconds between spins

        for (let spin = 0; spin < spinningTimes; spin++) {
          // Shuffle the participants for each spin
          const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);

          // Update the embed with the current "spin"
          const spinEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Facilitator Selection')
            .setDescription(`Selecting... ${spinningEmojis[spin % spinningEmojis.length]}`)
            .addFields({
              name: 'Participants',
              value: shuffledParticipants.join('\n'),
              inline: false,
            })
            .setTimestamp()
            .setFooter({ text: 'Selection in progress...' });

          await interaction.editReply({
            embeds: [spinEmbed],
            components: [disabledRow],
          });

          // Wait for the next spin
          await new Promise((resolve) => setTimeout(resolve, spinningInterval));
        }

        // Select a random facilitator
        const selectedIndex = Math.floor(Math.random() * participants.length);
        const selectedFacilitator = participants[selectedIndex];

        // Create the final result embed
        const resultEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('🎉 Facilitator Selected! 🎉')
          .setDescription(`**${selectedFacilitator}** has been selected as the facilitator!`)
          .addFields({ name: 'All Participants', value: participants.join('\n'), inline: false })
          .setTimestamp()
          .setFooter({ text: 'Thanks for using the Facilitator Selector!' });

        // Update the message with the result
        await interaction.editReply({
          embeds: [resultEmbed],
          components: [], // Remove all buttons
        });

        // End the collector
        collector.stop();
      } else if (customId === 'cancel_selection') {
        // Cancel the selection
        const cancelEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('Facilitator Selection')
          .setDescription('Selection cancelled.')
          .setTimestamp();

        await i.update({
          embeds: [cancelEmbed],
          components: [], // Remove all buttons
        });

        // End the collector
        collector.stop();
      }
    });

    collector.on('end', async (collected) => {
      if (!collector.ended) {
        // If the collector timed out
        const timeoutEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('Facilitator Selection')
          .setDescription('Selection timed out.')
          .setTimestamp();

        await interaction.editReply({
          embeds: [timeoutEmbed],
          components: [], // Remove all buttons
        });
      }
    });
  },
};

module.exports = command;
