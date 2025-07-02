import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

/**
 * Interface for Discord slash commands
 */
export interface Command {
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}
