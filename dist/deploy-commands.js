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
const discord_js_1 = require("discord.js");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
require("dotenv/config");
const commands = [];
// Grab all the command files from the commands directory
const commandsPath = path.join(__dirname, 'commands');
// Create commands directory if it doesn't exist
if (!fs.existsSync(commandsPath)) {
    fs.mkdirSync(commandsPath);
}
const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith('.js') || file.endsWith('.ts'));
// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    }
    else {
        console.log(`[WARNING] The command at ${file} is missing a required "data" or "execute" property.`);
    }
}
// Construct and prepare an instance of the REST module
const rest = new discord_js_1.REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || '');
// and deploy your commands!
(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);
        // Check if environment variables are set
        if (!process.env.CLIENT_ID || !process.env.GUILD_ID) {
            throw new Error('CLIENT_ID or GUILD_ID environment variables are not set');
        }
        // The put method is used to fully refresh all commands in the guild with the current set
        const data = await rest.put(discord_js_1.Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
        console.log(`Successfully reloaded ${Array.isArray(data) ? data.length : 0} application (/) commands.`);
    }
    catch (error) {
        // And of course, make sure you catch and log any errors!
        console.error(error);
    }
})();
