"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dayjs_1 = __importDefault(require("../utils/dayjs"));
// File path for storing reminders
const remindersFilePath = path.join(__dirname, '../../data/reminders.json');
// Ensure the data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
// Function to save reminders to file
function saveReminders(reminders) {
    // Convert Date objects to strings for JSON serialization
    const remindersToSave = reminders.map((reminder) => ({
        ...reminder,
        time: reminder.time.toISOString(),
    }));
    try {
        fs.writeFileSync(remindersFilePath, JSON.stringify(remindersToSave, null, 2));
        console.log('Reminders saved to file');
    }
    catch (error) {
        console.error('Error saving reminders to file:', error);
    }
}
// Function to load reminders from file
function loadReminders() {
    try {
        if (fs.existsSync(remindersFilePath)) {
            const data = fs.readFileSync(remindersFilePath, 'utf8');
            const parsedReminders = JSON.parse(data);
            // Convert string dates back to Date objects
            return parsedReminders.map((reminder) => ({
                ...reminder,
                time: new Date(reminder.time),
            }));
        }
    }
    catch (error) {
        console.error('Error loading reminders from file:', error);
    }
    return [];
}
// Load reminders from file or initialize empty array
const reminders = loadReminders();
// Check for reminders every minute
setInterval(() => {
    checkReminders();
}, 60 * 1000);
// Function to check and trigger reminders
async function checkReminders() {
    const now = new Date();
    const triggeredReminders = [];
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
            }
            else {
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
            const client = (await Promise.resolve().then(() => __importStar(require('../index')))).client;
            const channel = (await client.channels.fetch(reminder.channelId));
            if (channel && channel.isTextBased()) {
                const embed = new discord_js_1.EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle(reminder.recurring ? 'Daily Reminder' : 'Reminder')
                    .setDescription(reminder.message);
                // Add content items if they exist
                if (reminder.content && reminder.content.length > 0) {
                    const contentText = reminder.content.map((item) => `• ${item}`).join('\n');
                    embed.addFields({ name: 'Content', value: contentText });
                }
                embed.setTimestamp().setFooter({ text: `Reminder set by <@${reminder.userId}>` });
                await channel.send({ embeds: [embed] });
            }
        }
        catch (error) {
            console.error('Error sending reminder:', error);
        }
    }
}
// Create a class that implements the Command interface
class ReminderCommand {
    constructor() {
        this.data = new discord_js_1.SlashCommandBuilder()
            .setName('reminder')
            .setDescription('Set a reminder')
            .addSubcommand((subcommand) => subcommand
            .setName('once')
            .setDescription('Set a one-time reminder for a specific date and time')
            .addChannelOption((option) => option
            .setName('channel')
            .setDescription('The channel to send the reminder to')
            .setRequired(true)
            .addChannelTypes(discord_js_1.ChannelType.GuildText))
            .addStringOption((option) => option.setName('message').setDescription('The message to send').setRequired(true))
            .addStringOption((option) => option
            .setName('date')
            .setDescription('The date for the reminder (YYYY-MM-DD)')
            .setRequired(true))
            .addStringOption((option) => option
            .setName('time')
            .setDescription('The time for the reminder (HH:MM)')
            .setRequired(true)))
            .addSubcommand((subcommand) => subcommand
            .setName('daily')
            .setDescription('Set a daily reminder at a specific time')
            .addChannelOption((option) => option
            .setName('channel')
            .setDescription('The channel to send the reminder to')
            .setRequired(true)
            .addChannelTypes(discord_js_1.ChannelType.GuildText))
            .addStringOption((option) => option.setName('message').setDescription('The message to send').setRequired(true))
            .addStringOption((option) => option
            .setName('time')
            .setDescription('The time for the daily reminder (HH:MM)')
            .setRequired(true)))
            .addSubcommand((subcommand) => subcommand.setName('list').setDescription('List all active reminders'))
            .addSubcommand((subcommand) => subcommand
            .setName('delete')
            .setDescription('Delete a reminder')
            .addIntegerOption((option) => option
            .setName('index')
            .setDescription('The index of the reminder to delete')
            .setRequired(true)))
            .addSubcommand((subcommand) => subcommand
            .setName('add-content')
            .setDescription('Add content to an existing reminder')
            .addIntegerOption((option) => option
            .setName('index')
            .setDescription('The index of the reminder to add content to')
            .setRequired(true))
            .addStringOption((option) => option
            .setName('content')
            .setDescription('The content to add to the reminder')
            .setRequired(true)));
    }
    async execute(interaction) {
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
                await interaction.reply({ content: 'Unknown subcommand.', flags: discord_js_1.MessageFlags.Ephemeral });
        }
    }
    // Handle one-time reminder
    async handleOnceReminder(interaction) {
        const channel = interaction.options.getChannel('channel', true);
        const message = interaction.options.getString('message', true);
        const dateStr = interaction.options.getString('date', true);
        const timeStr = interaction.options.getString('time', true);
        // Validate date format (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            await interaction.reply({
                content: 'Invalid date format. Please use YYYY-MM-DD (e.g., 2023-12-31).',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        // Validate time format (HH:MM)
        if (!/^\d{2}:\d{2}$/.test(timeStr)) {
            await interaction.reply({
                content: 'Invalid time format. Please use HH:MM (e.g., 14:30).',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        // Parse date and time
        const dateTimeStr = `${dateStr} ${timeStr}`;
        const reminderTime = (0, dayjs_1.default)(dateTimeStr).toDate();
        // Check if the time is in the past
        if (reminderTime <= new Date()) {
            await interaction.reply({
                content: 'Cannot set a reminder for a time in the past.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        // Create the reminder
        const reminder = {
            channelId: channel.id,
            message,
            time: reminderTime,
            userId: interaction.user.id,
            guildId: interaction.guildId || '',
            recurring: false,
        };
        // Add to reminders array
        reminders.push(reminder);
        saveReminders(reminders);
        // Format the confirmation message
        const formattedTime = (0, dayjs_1.default)(reminderTime).format('YYYY-MM-DD HH:mm');
        // Create an embed for the confirmation
        const embed = new discord_js_1.EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('One-time Reminder Set')
            .setDescription(`I'll remind <#${channel.id}> at ${formattedTime}`)
            .addFields({ name: 'Message', value: message })
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.tag}` });
        await interaction.reply({ embeds: [embed] });
    }
    // Handle daily reminder
    async handleDailyReminder(interaction) {
        const channel = interaction.options.getChannel('channel', true);
        const message = interaction.options.getString('message', true);
        const timeStr = interaction.options.getString('time', true);
        // Validate time format (HH:MM)
        if (!/^\d{2}:\d{2}$/.test(timeStr)) {
            await interaction.reply({
                content: 'Invalid time format. Please use HH:MM (e.g., 14:30).',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
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
        const reminder = {
            channelId: channel.id,
            message,
            time: reminderTime,
            userId: interaction.user.id,
            guildId: interaction.guildId || '',
            recurring: true,
            frequency: 'daily',
            timeOfDay: timeStr,
        };
        // Add to reminders array
        reminders.push(reminder);
        saveReminders(reminders);
        // Create an embed for the confirmation
        const embed = new discord_js_1.EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Daily Reminder Set')
            .setDescription(`I'll remind <#${channel.id}> daily at ${timeStr}`)
            .addFields({ name: 'Message', value: message }, { name: 'First Occurrence', value: (0, dayjs_1.default)(reminderTime).format('YYYY-MM-DD HH:mm') })
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.tag}` });
        await interaction.reply({ embeds: [embed] });
    }
    // Handle listing reminders
    async handleListReminders(interaction) {
        // Filter reminders by guild ID
        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.reply({ content: 'This command can only be used in a server.', flags: discord_js_1.MessageFlags.Ephemeral });
            return;
        }
        const guildReminders = reminders.filter(reminder => reminder.guildId === guildId);
        if (guildReminders.length === 0) {
            await interaction.reply({ content: 'No active reminders for this server.', flags: discord_js_1.MessageFlags.Ephemeral });
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Active Reminders')
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.tag}` });
        // Add fields for each reminder
        guildReminders.forEach((reminder, index) => {
            const channelMention = `<#${reminder.channelId}>`;
            const timeStr = (0, dayjs_1.default)(reminder.time).format('YYYY-MM-DD HH:mm');
            const typeStr = reminder.recurring ? `Daily at ${reminder.timeOfDay}` : 'One-time';
            let value = `Channel: ${channelMention}\nTime: ${timeStr}\nMessage: ${reminder.message}`;
            // Add content items if they exist
            if (reminder.content && reminder.content.length > 0) {
                const contentText = reminder.content.map((item) => `• ${item}`).join('\n');
                value += `\n\nContent:\n${contentText}`;
            }
            embed.addFields({
                name: `${index + 1}. ${typeStr}`,
                value: value,
            });
        });
        await interaction.reply({ embeds: [embed] });
    }
    // Handle deleting a reminder
    async handleDeleteReminder(interaction) {
        const index = interaction.options.getInteger('index', true) - 1;
        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.reply({ content: 'This command can only be used in a server.', flags: discord_js_1.MessageFlags.Ephemeral });
            return;
        }
        // Filter reminders by guild ID
        const guildReminders = reminders.filter(reminder => reminder.guildId === guildId);
        if (index < 0 || index >= guildReminders.length) {
            await interaction.reply({
                content: 'Invalid reminder index.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        // Find the reminder to delete in the global array
        const reminderToDelete = guildReminders[index];
        const globalIndex = reminders.findIndex(reminder => reminder.guildId === reminderToDelete.guildId &&
            reminder.channelId === reminderToDelete.channelId &&
            reminder.message === reminderToDelete.message &&
            reminder.time.getTime() === reminderToDelete.time.getTime());
        if (globalIndex === -1) {
            await interaction.reply({
                content: 'Reminder not found.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const deletedReminder = reminders.splice(globalIndex, 1)[0];
        saveReminders(reminders);
        const typeStr = deletedReminder.recurring ? 'Daily' : 'One-time';
        const timeStr = (0, dayjs_1.default)(deletedReminder.time).format('YYYY-MM-DD HH:mm');
        const embed = new discord_js_1.EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Reminder Deleted')
            .setDescription(`Deleted a ${typeStr.toLowerCase()} reminder`)
            .addFields({ name: 'Channel', value: `<#${deletedReminder.channelId}>` }, { name: 'Time', value: timeStr }, { name: 'Message', value: deletedReminder.message })
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.tag}` });
        await interaction.reply({ embeds: [embed] });
    }
    // Handle adding content to a reminder
    async handleAddContent(interaction) {
        const index = interaction.options.getInteger('index', true) - 1;
        const content = interaction.options.getString('content', true);
        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.reply({ content: 'This command can only be used in a server.', flags: discord_js_1.MessageFlags.Ephemeral });
            return;
        }
        // Filter reminders by guild ID
        const guildReminders = reminders.filter(reminder => reminder.guildId === guildId);
        if (index < 0 || index >= guildReminders.length) {
            await interaction.reply({
                content: 'Invalid reminder index.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        // Find the reminder to modify in the global array
        const reminderToModify = guildReminders[index];
        const globalIndex = reminders.findIndex(reminder => reminder.guildId === reminderToModify.guildId &&
            reminder.channelId === reminderToModify.channelId &&
            reminder.message === reminderToModify.message &&
            reminder.time.getTime() === reminderToModify.time.getTime());
        if (globalIndex === -1) {
            await interaction.reply({
                content: 'Reminder not found.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const reminder = reminders[globalIndex];
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
        const timeStr = (0, dayjs_1.default)(reminder.time).format('YYYY-MM-DD HH:mm');
        // Create a list of all content items
        const contentList = reminder.content.map((item) => `• ${item}`).join('\n');
        const embed = new discord_js_1.EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Content Added to Reminder')
            .setDescription(`Added content to a ${typeStr.toLowerCase()} reminder`)
            .addFields({ name: 'Channel', value: `<#${reminder.channelId}>` }, { name: 'Time', value: timeStr }, { name: 'Message', value: reminder.message }, { name: 'Content', value: contentList })
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.tag}` });
        await interaction.reply({ embeds: [embed] });
    }
}
const command = new ReminderCommand();
module.exports = command;
