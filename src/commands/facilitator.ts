import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../command';

export function parseParticipants(input: string): string[] {
  if (!input || input.trim() === '') {
    return [];
  }
  
  return input
    .split(',')
    .map(name => name.trim())
    .filter(name => name.length > 0)
    .filter((name, index, array) => array.indexOf(name) === index); // Remove duplicates
}

export function selectRandomFacilitator(participants: string[]): string | null {
  if (participants.length === 0) {
    return null;
  }
  
  if (participants.length === 1) {
    return participants[0];
  }
  
  const randomIndex = Math.floor(Math.random() * participants.length);
  return participants[randomIndex];
}

const data = new SlashCommandBuilder()
  .setName('facilitator')
  .setDescription('Randomly select a facilitator from participants')
  .addStringOption(option =>
    option
      .setName('participants')
      .setDescription('Comma-separated list of participant names')
      .setRequired(true)
  );

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const participantsInput = interaction.options.getString('participants', true);
  const participants = parseParticipants(participantsInput);
  
  if (participants.length === 0) {
    await interaction.reply({
      content: '❌ No valid participants provided. Please provide a comma-separated list of names.',
      ephemeral: true
    });
    return;
  }
  
  const selectedFacilitator = selectRandomFacilitator(participants);
  
  if (!selectedFacilitator) {
    await interaction.reply({
      content: '❌ Unable to select a facilitator.',
      ephemeral: true
    });
    return;
  }
  
  const embed = new EmbedBuilder()
    .setTitle('🎯 Facilitator Selected!')
    .setDescription(`**${selectedFacilitator}** has been randomly selected as the facilitator.`)
    .addFields(
      { name: 'Participants', value: participants.join(', '), inline: false }
    )
    .setColor(0x00AE86)
    .setTimestamp();
  
  await interaction.reply({ embeds: [embed] });
}

export { data, execute };