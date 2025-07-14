"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const reminderStorage_1 = require("../services/reminderStorage");
const reminderScheduler_1 = require("../services/reminderScheduler");
// Initialize services
const storage = new reminderStorage_1.ReminderStorage();
let scheduler;
// Days of week mapping
const DAYS_OF_WEEK = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('reminder')
        .setDescription('Manage reminders')
        .addSubcommand(subcommand => subcommand
        .setName('create')
        .setDescription('Create a new reminder')
        .addStringOption(option => option
        .setName('title')
        .setDescription('Reminder title')
        .setRequired(true))
        .addStringOption(option => option
        .setName('day')
        .setDescription('Day of the week')
        .setRequired(true)
        .addChoices({ name: 'Monday', value: '1' }, { name: 'Tuesday', value: '2' }, { name: 'Wednesday', value: '3' }, { name: 'Thursday', value: '4' }, { name: 'Friday', value: '5' }, { name: 'Saturday', value: '6' }, { name: 'Sunday', value: '0' }))
        .addStringOption(option => option
        .setName('time')
        .setDescription('Time in HH:mm format (24-hour)')
        .setRequired(true))
        .addStringOption(option => option
        .setName('description')
        .setDescription('Optional description')
        .setRequired(false))
        .addStringOption(option => option
        .setName('timezone')
        .setDescription('Timezone (default: Asia/Tokyo)')
        .setRequired(false)))
        .addSubcommand(subcommand => subcommand
        .setName('list')
        .setDescription('List your reminders'))
        .addSubcommand(subcommand => subcommand
        .setName('edit')
        .setDescription('Edit an existing reminder')
        .addStringOption(option => option
        .setName('reminder_id')
        .setDescription('Reminder ID to edit')
        .setRequired(true)))
        .addSubcommand(subcommand => subcommand
        .setName('delete')
        .setDescription('Delete a reminder')
        .addStringOption(option => option
        .setName('reminder_id')
        .setDescription('Reminder ID to delete')
        .setRequired(true)))
        .addSubcommand(subcommand => subcommand
        .setName('comment')
        .setDescription('Add a comment to a reminder')
        .addStringOption(option => option
        .setName('reminder_id')
        .setDescription('Reminder ID to comment on')
        .setRequired(true))
        .addStringOption(option => option
        .setName('comment')
        .setDescription('Comment text')
        .setRequired(true)))
        .addSubcommand(subcommand => subcommand
        .setName('toggle')
        .setDescription('Enable/disable a reminder')
        .addStringOption(option => option
        .setName('reminder_id')
        .setDescription('Reminder ID to toggle')
        .setRequired(true))),
    async execute(interaction) {
        // Initialize scheduler if not already done
        if (!scheduler) {
            scheduler = new reminderScheduler_1.ReminderScheduler(interaction.client);
            // Load and schedule existing reminders
            const existingReminders = await storage.getAllReminders();
            scheduler.scheduleAllReminders(existingReminders);
        }
        const subcommand = interaction.options.getSubcommand();
        switch (subcommand) {
            case 'create':
                await handleCreateReminder(interaction);
                break;
            case 'list':
                await handleListReminders(interaction);
                break;
            case 'edit':
                await handleEditReminder(interaction);
                break;
            case 'delete':
                await handleDeleteReminder(interaction);
                break;
            case 'comment':
                await handleAddComment(interaction);
                break;
            case 'toggle':
                await handleToggleReminder(interaction);
                break;
            default:
                await interaction.reply({
                    content: 'Unknown subcommand.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
        }
    },
};
async function handleCreateReminder(interaction) {
    const title = interaction.options.getString('title', true);
    const dayStr = interaction.options.getString('day', true);
    const time = interaction.options.getString('time', true);
    const description = interaction.options.getString('description');
    const timezone = interaction.options.getString('timezone') || 'Asia/Tokyo';
    // Validate time format
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(time)) {
        await interaction.reply({
            content: 'Invalid time format. Please use HH:mm format (e.g., 09:00, 14:30).',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const dayOfWeek = parseInt(dayStr);
    try {
        const createData = {
            userId: interaction.user.id,
            channelId: interaction.channelId,
            title,
            description: description || undefined,
            dayOfWeek,
            time,
            timezone,
        };
        const reminder = await storage.saveReminder(createData);
        scheduler.scheduleReminder(reminder);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ Reminder Created!')
            .setDescription(`**${title}** has been scheduled.`)
            .addFields({ name: 'Day', value: DAYS_OF_WEEK[dayOfWeek], inline: true }, { name: 'Time', value: time, inline: true }, { name: 'Timezone', value: timezone, inline: true }, { name: 'Reminder ID', value: reminder.id, inline: false })
            .setTimestamp()
            .setFooter({ text: 'Use /reminder list to see all your reminders' });
        if (description) {
            embed.addFields({ name: 'Description', value: description, inline: false });
        }
        await interaction.reply({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error creating reminder:', error);
        await interaction.reply({
            content: 'An error occurred while creating the reminder. Please try again.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
}
async function handleListReminders(interaction) {
    try {
        const reminders = await storage.getUserReminders(interaction.user.id);
        if (reminders.length === 0) {
            await interaction.reply({
                content: 'You have no reminders. Use `/reminder create` to create one!',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📋 Your Reminders')
            .setTimestamp()
            .setFooter({ text: `Total: ${reminders.length} reminder(s)` });
        reminders.forEach((reminder, index) => {
            const status = reminder.isActive ? '🟢 Active' : '🔴 Inactive';
            const dayName = DAYS_OF_WEEK[reminder.dayOfWeek];
            embed.addFields({
                name: `${index + 1}. ${reminder.title} ${status}`,
                value: `**Day:** ${dayName}\n**Time:** ${reminder.time} (${reminder.timezone})\n**ID:** \`${reminder.id}\`${reminder.description ? `\n**Description:** ${reminder.description}` : ''}${reminder.comments.length > 0 ? `\n**Comments:** ${reminder.comments.length}` : ''}`,
                inline: false
            });
        });
        await interaction.reply({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error listing reminders:', error);
        await interaction.reply({
            content: 'An error occurred while fetching your reminders. Please try again.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
}
async function handleEditReminder(interaction) {
    const reminderId = interaction.options.getString('reminder_id', true);
    try {
        const reminder = await storage.getReminder(reminderId);
        if (!reminder) {
            await interaction.reply({
                content: 'Reminder not found.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        if (reminder.userId !== interaction.user.id) {
            await interaction.reply({
                content: 'You can only edit your own reminders.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        // Create modal for editing
        const modal = new discord_js_1.ModalBuilder()
            .setCustomId(`edit_reminder_${reminderId}`)
            .setTitle('Edit Reminder');
        const titleInput = new discord_js_1.TextInputBuilder()
            .setCustomId('title')
            .setLabel('Title')
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setValue(reminder.title)
            .setRequired(true);
        const descriptionInput = new discord_js_1.TextInputBuilder()
            .setCustomId('description')
            .setLabel('Description')
            .setStyle(discord_js_1.TextInputStyle.Paragraph)
            .setValue(reminder.description || '')
            .setRequired(false);
        const timeInput = new discord_js_1.TextInputBuilder()
            .setCustomId('time')
            .setLabel('Time (HH:mm format)')
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setValue(reminder.time)
            .setRequired(true);
        const dayInput = new discord_js_1.TextInputBuilder()
            .setCustomId('day')
            .setLabel('Day of Week (0=Sunday, 1=Monday, etc.)')
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setValue(reminder.dayOfWeek.toString())
            .setRequired(true);
        const timezoneInput = new discord_js_1.TextInputBuilder()
            .setCustomId('timezone')
            .setLabel('Timezone')
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setValue(reminder.timezone)
            .setRequired(true);
        const firstActionRow = new discord_js_1.ActionRowBuilder().addComponents(titleInput);
        const secondActionRow = new discord_js_1.ActionRowBuilder().addComponents(descriptionInput);
        const thirdActionRow = new discord_js_1.ActionRowBuilder().addComponents(timeInput);
        const fourthActionRow = new discord_js_1.ActionRowBuilder().addComponents(dayInput);
        const fifthActionRow = new discord_js_1.ActionRowBuilder().addComponents(timezoneInput);
        modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow, fifthActionRow);
        await interaction.showModal(modal);
        // Handle modal submission
        const modalSubmission = await interaction.awaitModalSubmit({
            time: 5 * 60 * 1000, // 5 minutes
            filter: (i) => i.customId === `edit_reminder_${reminderId}`,
        });
        const newTitle = modalSubmission.fields.getTextInputValue('title');
        const newDescription = modalSubmission.fields.getTextInputValue('description');
        const newTime = modalSubmission.fields.getTextInputValue('time');
        const newDayStr = modalSubmission.fields.getTextInputValue('day');
        const newTimezone = modalSubmission.fields.getTextInputValue('timezone');
        // Validate inputs
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(newTime)) {
            await modalSubmission.reply({
                content: 'Invalid time format. Please use HH:mm format.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const newDay = parseInt(newDayStr);
        if (isNaN(newDay) || newDay < 0 || newDay > 6) {
            await modalSubmission.reply({
                content: 'Invalid day. Please use 0-6 (0=Sunday, 1=Monday, etc.).',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const updateData = {
            title: newTitle,
            description: newDescription || undefined,
            time: newTime,
            dayOfWeek: newDay,
            timezone: newTimezone,
        };
        const updatedReminder = await storage.updateReminder(reminderId, updateData);
        if (updatedReminder) {
            scheduler.rescheduleReminder(updatedReminder);
            const embed = new discord_js_1.EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ Reminder Updated!')
                .setDescription(`**${updatedReminder.title}** has been updated.`)
                .addFields({ name: 'Day', value: DAYS_OF_WEEK[updatedReminder.dayOfWeek], inline: true }, { name: 'Time', value: updatedReminder.time, inline: true }, { name: 'Timezone', value: updatedReminder.timezone, inline: true })
                .setTimestamp();
            if (updatedReminder.description) {
                embed.addFields({ name: 'Description', value: updatedReminder.description, inline: false });
            }
            await modalSubmission.reply({ embeds: [embed] });
        }
    }
    catch (error) {
        console.error('Error editing reminder:', error);
        if (error instanceof Error && error.message?.includes('time')) {
            await interaction.followUp({
                content: 'Edit operation timed out. Please try again.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        else {
            await interaction.reply({
                content: 'An error occurred while editing the reminder. Please try again.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
    }
}
async function handleDeleteReminder(interaction) {
    const reminderId = interaction.options.getString('reminder_id', true);
    try {
        const reminder = await storage.getReminder(reminderId);
        if (!reminder) {
            await interaction.reply({
                content: 'Reminder not found.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        if (reminder.userId !== interaction.user.id) {
            await interaction.reply({
                content: 'You can only delete your own reminders.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        // Create confirmation buttons
        const confirmButton = new discord_js_1.ButtonBuilder()
            .setCustomId(`confirm_delete_${reminderId}`)
            .setLabel('Delete')
            .setStyle(discord_js_1.ButtonStyle.Danger);
        const cancelButton = new discord_js_1.ButtonBuilder()
            .setCustomId('cancel_delete')
            .setLabel('Cancel')
            .setStyle(discord_js_1.ButtonStyle.Secondary);
        const row = new discord_js_1.ActionRowBuilder().addComponents(confirmButton, cancelButton);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('⚠️ Confirm Deletion')
            .setDescription(`Are you sure you want to delete the reminder **${reminder.title}**?`)
            .addFields({ name: 'Day', value: DAYS_OF_WEEK[reminder.dayOfWeek], inline: true }, { name: 'Time', value: reminder.time, inline: true })
            .setFooter({ text: 'This action cannot be undone.' });
        const message = await interaction.reply({
            embeds: [embed],
            components: [row],
            fetchReply: true,
        });
        const collector = message.createMessageComponentCollector({
            componentType: discord_js_1.ComponentType.Button,
            time: 30 * 1000, // 30 seconds
        });
        collector.on('collect', async (buttonInteraction) => {
            if (buttonInteraction.user.id !== interaction.user.id) {
                await buttonInteraction.reply({
                    content: 'You cannot interact with this button.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            if (buttonInteraction.customId === `confirm_delete_${reminderId}`) {
                await storage.deleteReminder(reminderId);
                scheduler.unscheduleReminder(reminderId);
                const successEmbed = new discord_js_1.EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('✅ Reminder Deleted')
                    .setDescription(`**${reminder.title}** has been deleted.`)
                    .setTimestamp();
                await buttonInteraction.update({
                    embeds: [successEmbed],
                    components: [],
                });
            }
            else {
                const cancelEmbed = new discord_js_1.EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('Deletion Cancelled')
                    .setDescription('The reminder was not deleted.')
                    .setTimestamp();
                await buttonInteraction.update({
                    embeds: [cancelEmbed],
                    components: [],
                });
            }
            collector.stop();
        });
        collector.on('end', async (collected) => {
            if (collected.size === 0) {
                const timeoutEmbed = new discord_js_1.EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('Deletion Timed Out')
                    .setDescription('The deletion confirmation timed out.')
                    .setTimestamp();
                await interaction.editReply({
                    embeds: [timeoutEmbed],
                    components: [],
                });
            }
        });
    }
    catch (error) {
        console.error('Error deleting reminder:', error);
        await interaction.reply({
            content: 'An error occurred while deleting the reminder. Please try again.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
}
async function handleAddComment(interaction) {
    const reminderId = interaction.options.getString('reminder_id', true);
    const commentText = interaction.options.getString('comment', true);
    try {
        const reminder = await storage.getReminder(reminderId);
        if (!reminder) {
            await interaction.reply({
                content: 'Reminder not found.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const comment = await storage.addComment(reminderId, interaction.user.id, commentText);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ Comment Added')
            .setDescription(`Comment added to **${reminder.title}**`)
            .addFields({ name: 'Comment', value: commentText, inline: false }, { name: 'Total Comments', value: (reminder.comments.length + 1).toString(), inline: true })
            .setTimestamp();
        await interaction.reply({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error adding comment:', error);
        await interaction.reply({
            content: 'An error occurred while adding the comment. Please try again.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
}
async function handleToggleReminder(interaction) {
    const reminderId = interaction.options.getString('reminder_id', true);
    try {
        const reminder = await storage.getReminder(reminderId);
        if (!reminder) {
            await interaction.reply({
                content: 'Reminder not found.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        if (reminder.userId !== interaction.user.id) {
            await interaction.reply({
                content: 'You can only toggle your own reminders.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const newStatus = !reminder.isActive;
        const updatedReminder = await storage.updateReminder(reminderId, { isActive: newStatus });
        if (updatedReminder) {
            if (newStatus) {
                scheduler.scheduleReminder(updatedReminder);
            }
            else {
                scheduler.unscheduleReminder(reminderId);
            }
            const statusText = newStatus ? '🟢 Enabled' : '🔴 Disabled';
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(newStatus ? '#00FF00' : '#FF0000')
                .setTitle(`✅ Reminder ${newStatus ? 'Enabled' : 'Disabled'}`)
                .setDescription(`**${updatedReminder.title}** is now ${statusText}`)
                .addFields({ name: 'Day', value: DAYS_OF_WEEK[updatedReminder.dayOfWeek], inline: true }, { name: 'Time', value: updatedReminder.time, inline: true }, { name: 'Status', value: statusText, inline: true })
                .setTimestamp();
            await interaction.reply({ embeds: [embed] });
        }
    }
    catch (error) {
        console.error('Error toggling reminder:', error);
        await interaction.reply({
            content: 'An error occurred while toggling the reminder. Please try again.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
}
module.exports = command;
