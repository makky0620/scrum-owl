import { Client, Collection, Events, GatewayIntentBits } from 'discord.js';
import { Command } from './command';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Create a collection to store commands
client.commands = new Collection<string, Command>();

// Load commands from the commands directory
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  
  // Set a new item in the Collection with the key as the command name and the value as the exported module
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    console.log(`[INFO] Loaded command: ${command.data.name}`);
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

// When the client is ready, run this code (only once)
client.once(Events.ClientReady, readyClient => {
  console.log(`[INFO] Ready! Logged in as ${readyClient.user.tag}`);
});

// Handle slash command interactions
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`[ERROR] No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`[ERROR] Error executing command ${interaction.commandName}:`, error);
    
    const errorMessage = { content: 'There was an error while executing this command!', ephemeral: true };
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

// Log in to Discord with your client's token
client.login(process.env.DISCORD_TOKEN);

// Extend the Client interface to include commands
declare module 'discord.js' {
  export interface Client {
    commands: Collection<string, Command>;
  }
}