"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.parseParticipants = parseParticipants;
exports.selectRandomFacilitator = selectRandomFacilitator;
exports.execute = execute;
const discord_js_1 = require("discord.js");
function parseParticipants(input) {
    if (!input || input.trim() === '') {
        return [];
    }
    return input
        .split(',')
        .map(name => name.trim())
        .filter(name => name.length > 0)
        .filter((name, index, array) => array.indexOf(name) === index); // Remove duplicates
}
function selectRandomFacilitator(participants) {
    if (participants.length === 0) {
        return null;
    }
    if (participants.length === 1) {
        return participants[0];
    }
    const randomIndex = Math.floor(Math.random() * participants.length);
    return participants[randomIndex];
}
const data = new discord_js_1.SlashCommandBuilder()
    .setName('facilitator')
    .setDescription('Randomly select a facilitator from participants')
    .addStringOption(option => option
    .setName('participants')
    .setDescription('Comma-separated list of participant names')
    .setRequired(true));
exports.data = data;
async function execute(interaction) {
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
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('🎯 Facilitator Selected!')
        .setDescription(`**${selectedFacilitator}** has been randomly selected as the facilitator.`)
        .addFields({ name: 'Participants', value: participants.join(', '), inline: false })
        .setColor(0x00AE86)
        .setTimestamp();
    await interaction.reply({ embeds: [embed] });
}
