import { REST, Routes } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

const commands = [];

// Load commands from the commands directory
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith('.js') || file.endsWith('.ts'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const command = require(filePath);

  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
    logger.log(`[INFO] Loaded command for deployment: ${command.data.name}`);
  } else {
    logger.log(
      `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
    );
  }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

// Deploy commands
(async () => {
  try {
    logger.log(`[INFO] Started refreshing ${commands.length} application (/) commands.`);

    if (process.env.GUILD_ID) {
      // Deploy to specific guild (faster for development)
      const data = (await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID),
        { body: commands },
      )) as { length: number };
      logger.log(
        `[INFO] Successfully reloaded ${data.length} application (/) commands for guild ${process.env.GUILD_ID}.`,
      );
    } else {
      // Deploy globally (takes up to 1 hour to propagate)
      const data = (await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), {
        body: commands,
      })) as { length: number };
      logger.log(`[INFO] Successfully reloaded ${data.length} application (/) commands globally.`);
    }
  } catch (error) {
    logger.error('[ERROR] Error deploying commands:', error);
  }
})();
