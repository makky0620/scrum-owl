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
const dayjs_1 = __importDefault(require("../utils/dayjs"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// File path for storing sprints
const sprintsFilePath = path.join(__dirname, '../../data/sprints.json');
// Ensure the data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
// Function to save sprints to file
function saveSprints(sprints) {
    try {
        fs.writeFileSync(sprintsFilePath, JSON.stringify(sprints, null, 2));
        console.log('Sprints saved to file');
    }
    catch (error) {
        console.error('Error saving sprints to file:', error);
    }
}
// Function to load sprints from file
function loadSprints() {
    try {
        if (fs.existsSync(sprintsFilePath)) {
            const data = fs.readFileSync(sprintsFilePath, 'utf8');
            return JSON.parse(data);
        }
    }
    catch (error) {
        console.error('Error loading sprints from file:', error);
    }
    return [];
}
// Load sprints from file or initialize empty array
const sprints = loadSprints();
// Create a class that implements the Command interface
class BurndownCommand {
    constructor() {
        this.data = new discord_js_1.SlashCommandBuilder()
            .setName('burndown')
            .setDescription('Manage sprint burndown charts')
            .addSubcommand((subcommand) => subcommand
            .setName('register')
            .setDescription('Register a new sprint')
            .addStringOption((option) => option.setName('name').setDescription('Name of the sprint').setRequired(true))
            .addStringOption((option) => option
            .setName('start_date')
            .setDescription('Start date of the sprint (YYYY-MM-DD)')
            .setRequired(true))
            .addStringOption((option) => option
            .setName('end_date')
            .setDescription('End date of the sprint (YYYY-MM-DD)')
            .setRequired(true))
            .addIntegerOption((option) => option
            .setName('total_points')
            .setDescription('Total story points for the sprint')
            .setRequired(true)))
            .addSubcommand((subcommand) => subcommand
            .setName('view')
            .setDescription('View a burndown chart for a registered sprint')
            .addIntegerOption((option) => option
            .setName('index')
            .setDescription('Index of the sprint to view (from list command)')
            .setRequired(true))
            .addIntegerOption((option) => option
            .setName('completed_points')
            .setDescription('Number of story points completed so far')
            .setRequired(true)))
            .addSubcommand((subcommand) => subcommand.setName('list').setDescription('List all registered sprints'))
            .addSubcommand((subcommand) => subcommand
            .setName('delete')
            .setDescription('Delete a registered sprint')
            .addIntegerOption((option) => option
            .setName('index')
            .setDescription('Index of the sprint to delete (from list command)')
            .setRequired(true)));
    }
    async execute(interaction) {
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
            default:
                await interaction.reply({ content: 'Unknown subcommand.', flags: discord_js_1.MessageFlags.Ephemeral });
        }
    }
    // Handle registering a new sprint
    async handleRegisterSprint(interaction) {
        const name = interaction.options.getString('name', true);
        const startDateStr = interaction.options.getString('start_date', true);
        const endDateStr = interaction.options.getString('end_date', true);
        const totalPoints = interaction.options.getInteger('total_points', true);
        // Validate date formats (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr) || !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
            await interaction.reply({
                content: 'Invalid date format. Please use YYYY-MM-DD (e.g., 2023-12-31).',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        // Validate total points
        if (totalPoints <= 0) {
            await interaction.reply({
                content: 'Total points must be a positive number.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        // Parse dates
        const startDate = (0, dayjs_1.default)(startDateStr);
        const endDate = (0, dayjs_1.default)(endDateStr);
        // Validate date range
        if (!startDate.isValid() || !endDate.isValid()) {
            await interaction.reply({
                content: 'Invalid date. Please check your date format.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        if (endDate.isBefore(startDate)) {
            await interaction.reply({
                content: 'End date cannot be before start date.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        // Create the sprint
        const sprint = {
            name,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            totalPoints,
            userId: interaction.user.id,
            guildId: interaction.guildId || '',
            createdAt: new Date().toISOString(),
        };
        // Add to sprints array
        sprints.push(sprint);
        saveSprints(sprints);
        // Create an embed for the confirmation
        const embed = new discord_js_1.EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Sprint Registered')
            .setDescription(`Sprint "${name}" has been registered`)
            .addFields({ name: 'Start Date', value: startDateStr, inline: true }, { name: 'End Date', value: endDateStr, inline: true }, { name: 'Total Points', value: totalPoints.toString(), inline: true }, {
            name: 'Duration',
            value: `${endDate.diff(startDate, 'day')} days`,
            inline: true
        })
            .setTimestamp()
            .setFooter({ text: `Registered by ${interaction.user.tag}` });
        await interaction.reply({ embeds: [embed] });
    }
    // Handle viewing a burndown chart
    async handleViewBurndown(interaction) {
        const sprintIndex = interaction.options.getInteger('index', true) - 1; // Convert to 0-based index
        const completedPoints = interaction.options.getInteger('completed_points', true);
        // Check if index is valid
        if (sprintIndex < 0 || sprintIndex >= sprints.length) {
            await interaction.reply({
                content: `Invalid sprint index. Use /burndown list to see available sprints.`,
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        // Get the sprint at the specified index
        const sprint = sprints[sprintIndex];
        // Validate completed points
        if (completedPoints < 0) {
            await interaction.reply({
                content: 'Completed points cannot be negative.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        if (completedPoints > sprint.totalPoints) {
            await interaction.reply({
                content: `Completed points (${completedPoints}) cannot be greater than total points (${sprint.totalPoints}).`,
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        await interaction.deferReply();
        try {
            const startDate = (0, dayjs_1.default)(sprint.startDate);
            const endDate = (0, dayjs_1.default)(sprint.endDate);
            const today = (0, dayjs_1.default)();
            // Calculate sprint duration in days
            const sprintDays = endDate.diff(startDate, 'day');
            // Calculate days completed
            let daysCompleted = today.diff(startDate, 'day');
            // Ensure daysCompleted is within bounds
            if (daysCompleted < 0)
                daysCompleted = 0;
            if (daysCompleted > sprintDays)
                daysCompleted = sprintDays;
            // Calculate remaining points
            const remainingPoints = sprint.totalPoints - completedPoints;
            // Calculate ideal burndown line
            const idealBurndown = [];
            for (let day = 0; day <= sprintDays; day++) {
                const idealRemaining = sprint.totalPoints - (sprint.totalPoints * day) / sprintDays;
                idealBurndown.push(Math.round(idealRemaining * 100) / 100); // Round to 2 decimal places
            }
            // Calculate actual burndown line
            const actualBurndown = [];
            // Fill in actual data for days completed
            for (let day = 0; day <= daysCompleted; day++) {
                if (day === daysCompleted) {
                    actualBurndown.push(remainingPoints);
                }
                else {
                    // For simplicity, we'll use a linear interpolation for past days
                    // In a real implementation, you would use actual historical data
                    const pastRemaining = sprint.totalPoints - (completedPoints * day) / daysCompleted;
                    actualBurndown.push(Math.round(pastRemaining * 100) / 100);
                }
            }
            // Generate labels for the x-axis (days)
            const labels = [];
            for (let day = 0; day <= sprintDays; day++) {
                const date = startDate.add(day, 'day');
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
                            pointRadius: Array(sprintDays + 1).fill(0).map((_, i) => (i <= daysCompleted ? 5 : 0)),
                        },
                    ],
                },
                options: {
                    title: {
                        display: true,
                        text: `Burndown Chart - ${sprint.name}`,
                        fontSize: 16,
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'Sprint Days',
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
            const embed = new discord_js_1.EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`Burndown Chart - ${sprint.name}`)
                .setDescription(`Sprint progress: Day ${daysCompleted} of ${sprintDays}`)
                .addFields({ name: 'Total Story Points', value: sprint.totalPoints.toString(), inline: true }, { name: 'Remaining Points', value: remainingPoints.toString(), inline: true }, { name: 'Completed Points', value: completedPoints.toString(), inline: true }, {
                name: 'Completion Rate',
                value: `${Math.round((completedPoints / sprint.totalPoints) * 100)}%`,
                inline: true
            }, {
                name: 'Sprint Progress',
                value: `${Math.round((daysCompleted / sprintDays) * 100)}%`,
                inline: true
            })
                .setImage(chartUrl)
                .setTimestamp()
                .setFooter({ text: 'Generated with QuickChart.io' });
            await interaction.editReply({ embeds: [embed] });
        }
        catch (error) {
            console.error('Error generating burndown chart:', error);
            await interaction.editReply('An error occurred while generating the burndown chart. Please check the logs for details.');
        }
    }
    // Handle listing sprints
    async handleListSprints(interaction) {
        if (sprints.length === 0) {
            await interaction.reply({ content: 'No sprints registered.', flags: discord_js_1.MessageFlags.Ephemeral });
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Registered Sprints')
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.tag}` });
        // Add fields for each sprint
        sprints.forEach((sprint, index) => {
            const startDate = (0, dayjs_1.default)(sprint.startDate).format('YYYY-MM-DD');
            const endDate = (0, dayjs_1.default)(sprint.endDate).format('YYYY-MM-DD');
            const duration = (0, dayjs_1.default)(sprint.endDate).diff((0, dayjs_1.default)(sprint.startDate), 'day');
            embed.addFields({
                name: `${index + 1}. ${sprint.name}`,
                value: `Start: ${startDate}\nEnd: ${endDate}\nDuration: ${duration} days\nTotal Points: ${sprint.totalPoints}`,
            });
        });
        await interaction.reply({ embeds: [embed] });
    }
    // Handle deleting a sprint
    async handleDeleteSprint(interaction) {
        const sprintIndex = interaction.options.getInteger('index', true) - 1; // Convert to 0-based index
        // Check if index is valid
        if (sprintIndex < 0 || sprintIndex >= sprints.length) {
            await interaction.reply({
                content: `Invalid sprint index. Use /burndown list to see available sprints.`,
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        // Remove the sprint
        const deletedSprint = sprints.splice(sprintIndex, 1)[0];
        saveSprints(sprints);
        // Create an embed for the confirmation
        const embed = new discord_js_1.EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Sprint Deleted')
            .setDescription(`Sprint "${deletedSprint.name}" has been deleted`)
            .addFields({ name: 'Start Date', value: (0, dayjs_1.default)(deletedSprint.startDate).format('YYYY-MM-DD'), inline: true }, { name: 'End Date', value: (0, dayjs_1.default)(deletedSprint.endDate).format('YYYY-MM-DD'), inline: true }, { name: 'Total Points', value: deletedSprint.totalPoints.toString(), inline: true })
            .setTimestamp()
            .setFooter({ text: `Deleted by ${interaction.user.tag}` });
        await interaction.reply({ embeds: [embed] });
    }
}
const command = new BurndownCommand();
module.exports = command;
