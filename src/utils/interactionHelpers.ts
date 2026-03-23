import { ChatInputCommandInteraction, ModalSubmitInteraction, MessageFlags } from 'discord.js';

type RepliableInteraction = ChatInputCommandInteraction | ModalSubmitInteraction;

export async function safeReply(
  interaction: RepliableInteraction,
  content: string,
  ephemeral = true
): Promise<void> {
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(ephemeral ? { content, flags: MessageFlags.Ephemeral } : { content });
  } else {
    await interaction.reply(ephemeral ? { content, flags: MessageFlags.Ephemeral } : { content });
  }
}
