"use strict";
const discord_js_1 = require("discord.js");
// Fibonacci sequence commonly used in planning poker
const pointValues = ['0', '1', '2', '3', '5', '8', '13', '21', '?'];
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('poker')
        .setDescription('Start a planning poker session')
        .addStringOption((option) => option
        .setName('description')
        .setDescription('Description of the item being estimated')
        .setRequired(true)),
    async execute(interaction) {
        const description = interaction.options.getString('description', true);
        // Create an embed for the planning poker session
        const embed = new discord_js_1.EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Planning Poker Session')
            .setDescription(`**Item:** ${description}`)
            .addFields({ name: 'Status', value: 'Voting in progress...', inline: false }, { name: 'Participants', value: 'No votes yet', inline: false })
            .setTimestamp()
            .setFooter({ text: 'Vote by clicking on a point value below' });
        // Create buttons for each point value
        const rows = [];
        let currentRow = new discord_js_1.ActionRowBuilder();
        for (let i = 0; i < pointValues.length; i++) {
            // Discord only allows 5 buttons per row
            if (i > 0 && i % 5 === 0) {
                rows.push(currentRow);
                currentRow = new discord_js_1.ActionRowBuilder();
            }
            currentRow.addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`vote_${pointValues[i]}`)
                .setLabel(pointValues[i])
                .setStyle(discord_js_1.ButtonStyle.Primary));
        }
        // Add the last row if it has any buttons
        if (currentRow.components.length > 0) {
            rows.push(currentRow);
        }
        // Add a "Show Results" button
        const controlRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId('show_results')
            .setLabel('Show Results')
            .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
            .setCustomId('end_session')
            .setLabel('End Session')
            .setStyle(discord_js_1.ButtonStyle.Danger));
        rows.push(controlRow);
        // Send the initial message with the embed and buttons
        const message = (await interaction.reply({
            embeds: [embed],
            components: rows,
            fetchReply: true,
        }));
        // Store votes
        const votes = new Map();
        // Create a collector for button interactions
        const collector = message.createMessageComponentCollector({
            componentType: discord_js_1.ComponentType.Button,
            time: 15 * 60 * 1000, // 15 minutes
        });
        collector.on('collect', async (i) => {
            const customId = i.customId;
            // Handle vote buttons
            if (customId.startsWith('vote_')) {
                const value = customId.replace('vote_', '');
                votes.set(i.user.id, { user: i.user.username, value });
                // Update the participants field
                const participants = Array.from(votes.values())
                    .map((vote) => `${vote.user}: ${vote.value === '?' ? '?' : '🎴'}`)
                    .join('\n');
                embed.spliceFields(1, 1, {
                    name: 'Participants',
                    value: participants || 'No votes yet',
                    inline: false,
                });
                await i.update({
                    embeds: [embed],
                    components: rows,
                });
                // Acknowledge the interaction
                if (!i.replied) {
                    await i.reply({ content: `You voted: ${value}`, flags: discord_js_1.MessageFlags.Ephemeral });
                }
            }
            // Handle show results button
            else if (customId === 'show_results') {
                if (votes.size === 0) {
                    await i.reply({ content: 'No votes have been cast yet!', flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                // Calculate results
                const results = {};
                let consensus = true;
                let firstValue = null;
                for (const vote of votes.values()) {
                    if (!results[vote.value]) {
                        results[vote.value] = [];
                    }
                    results[vote.value].push(vote.user);
                    if (firstValue === null) {
                        firstValue = vote.value;
                    }
                    else if (vote.value !== firstValue && vote.value !== '?') {
                        consensus = false;
                    }
                }
                // Create a results string
                let resultsText = '';
                for (const [value, users] of Object.entries(results)) {
                    resultsText += `**${value}**: ${users.join(', ')}\n`;
                }
                // Calculate average of all numeric points
                let totalPoints = 0;
                let numericVotes = 0;
                for (const vote of votes.values()) {
                    if (vote.value !== '?' && !isNaN(parseInt(vote.value))) {
                        totalPoints += parseInt(vote.value);
                        numericVotes++;
                    }
                }
                // Add average to results if there are numeric votes
                if (numericVotes > 0) {
                    const average = (totalPoints / numericVotes).toFixed(1);
                    resultsText += `\n**Average**: ${average} points`;
                }
                // Update the embed
                embed.spliceFields(0, 1, {
                    name: 'Results',
                    value: resultsText,
                    inline: false,
                });
                if (consensus && firstValue !== '?') {
                    embed.addFields({
                        name: 'Consensus',
                        value: `The team agrees on ${firstValue} points!`,
                        inline: false,
                    });
                }
                else {
                    embed.addFields({
                        name: 'Consensus',
                        value: 'The team does not agree. Consider discussing and voting again.',
                        inline: false,
                    });
                }
                await i.update({
                    embeds: [embed],
                    components: rows,
                });
            }
            // Handle end session button
            else if (customId === 'end_session') {
                collector.stop();
                embed.setColor('#FF0000');
                embed.spliceFields(0, 1, { name: 'Status', value: 'Session ended', inline: false });
                await i.update({
                    embeds: [embed],
                    components: [], // Remove all buttons
                });
            }
        });
        collector.on('end', async () => {
            if (!collector.ended) {
                embed.setColor('#FF0000');
                embed.spliceFields(0, 1, { name: 'Status', value: 'Session timed out', inline: false });
                await interaction.editReply({
                    embeds: [embed],
                    components: [], // Remove all buttons
                });
            }
        });
    },
};
module.exports = command;
