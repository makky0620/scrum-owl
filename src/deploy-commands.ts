import { REST, Routes } from 'discord.js';
import { Command } from './command';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const commands = [];

// Load commands from the commands directory
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
    console.log(`[INFO] Loaded command for deployment: ${command.data.name}`);
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

// Deploy commands
(async () => {
  try {
    console.log(`[INFO] Started refreshing ${commands.length} application (/) commands.`);

    let data: any;
    
    if (process.env.GUILD_ID) {
      // Deploy to specific guild (faster for development)
      data = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID),
        { body: commands },
      );
      console.log(`[INFO] Successfully reloaded ${data.length} application (/) commands for guild ${process.env.GUILD_ID}.`);
    } else {
      // Deploy globally (takes up to 1 hour to propagate)
      data = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID!),
        { body: commands },
      );
      console.log(`[INFO] Successfully reloaded ${data.length} application (/) commands globally.`);
    }
  } catch (error) {
    console.error('[ERROR] Error deploying commands:', error);
  }
})();