import { REST, Routes } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import { Command } from './command';

const commands: any[] = [];
// Grab all the command files from the commands directory
const commandsPath = path.join(__dirname, 'commands');
// Create commands directory if it doesn't exist
if (!fs.existsSync(commandsPath)) {
  fs.mkdirSync(commandsPath);
}

const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath) as Command;
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
  } else {
    console.log(`[WARNING] The command at ${file} is missing a required "data" or "execute" property.`);
  }
}

// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || '');

// and deploy your commands!
(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    // Check if environment variables are set
    if (!process.env.CLIENT_ID || !process.env.GUILD_ID) {
      throw new Error('CLIENT_ID or GUILD_ID environment variables are not set');
    }

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands },
    );

    console.log(`Successfully reloaded ${Array.isArray(data) ? data.length : 0} application (/) commands.`);
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
  }
})();
