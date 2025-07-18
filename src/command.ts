import { SlashCommandBuilder, ChatInputCommandInteraction, ModalSubmitInteraction } from 'discord.js';

export interface Command {
  data: SlashCommandBuilder;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
  handleModalSubmit?(interaction: ModalSubmitInteraction): Promise<void>;
}
