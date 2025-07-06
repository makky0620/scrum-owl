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
Object.defineProperty(exports, "__esModule", { value: true });
exports.client = void 0;
// Import required modules
const discord_js_1 = require("discord.js");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
require("dotenv/config");
// Create a new client instance
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
        discord_js_1.GatewayIntentBits.GuildMembers,
    ],
});
exports.client = client;
// Collection for commands
client.commands = new discord_js_1.Collection();
// Load commands
const commandsPath = path.join(__dirname, 'commands');
// Create commands directory if it doesn't exist
if (!fs.existsSync(commandsPath)) {
    fs.mkdirSync(commandsPath);
}
const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith('.js') || file.endsWith('.ts'));
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
    else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}
// When the client is ready, run this code (only once)
client.once(discord_js_1.Events.ClientReady, () => {
    console.log(`Logged in as ${client.user?.tag}!`);
});
// Handle interactions (commands)
client.on(discord_js_1.Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand())
        return;
    const command = client.commands.get(interaction.commandName);
    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }
    try {
        await command.execute(interaction);
    }
    catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: 'There was an error while executing this command!',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        else {
            await interaction.reply({
                content: 'There was an error while executing this command!',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
    }
});
// Login to Discord with your client's token
client.login(process.env.DISCORD_TOKEN);
