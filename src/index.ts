// Import required modules
import { Client, GatewayIntentBits, Collection, Events, REST, Routes } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import { Command } from './command';

// Extend the Client interface to include commands
declare module 'discord.js' {
  interface Client {
    commands: Collection<string, Command>;
  }
}

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Collection for commands
client.commands = new Collection();

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
  } else {
    console.log(
      `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
    );
  }
}

// When the client is ready, run this code (only once)
client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user?.tag}!`);
});

// Handle interactions (commands)
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: 'There was an error while executing this command!',
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: 'There was an error while executing this command!',
        ephemeral: true,
      });
    }
  }
});

// Login to Discord with your client's token
client.login(process.env.DISCORD_TOKEN);

// Export the client for use in other modules
export { client };
