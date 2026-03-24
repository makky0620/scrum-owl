import type { ChatInputCommandInteraction, ButtonInteraction } from 'discord.js';
import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
  MessageFlags,
} from 'discord.js';
import { randomUUID } from 'crypto';
import type { Command } from '../command';
import { FacilitatorTemplateStorage } from '../utils/facilitatorTemplateStorage';

const emojis = ['🎲', '🎯', '🎮', '🎪', '🎭', '🎨', '🎬', '🎤', '🎧', '🎺', '🎸', '🎹', '🎻', '🎼'];

const templateStorage = new FacilitatorTemplateStorage();

function parseParticipants(input: string): string[] {
  return input
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .filter((name, index, array) => array.indexOf(name) === index);
}

async function runRoulette(
  interaction: ChatInputCommandInteraction,
  participants: string[],
): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('Rotation Selection')
    .setDescription('Selecting random participants...')
    .addFields({ name: 'Participants', value: participants.join('\n'), inline: false })
    .setTimestamp()
    .setFooter({ text: 'Click the button to start the selection' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('start_selection')
      .setLabel('Start Selection')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎲'),
    new ButtonBuilder()
      .setCustomId('cancel_selection')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger),
  );

  const message = await interaction.reply({
    embeds: [embed],
    components: [row],
    fetchReply: true,
  });

  let selectionMade = false;

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 5 * 60 * 1000,
  });

  collector.on('collect', async (i: ButtonInteraction) => {
    if (i.customId === 'start_selection') {
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('start_selection')
          .setLabel('Selection in progress...')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎲')
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('cancel_selection')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(true),
      );

      await i.update({ embeds: [embed], components: [disabledRow] });

      const spinningTimes = 10;
      const spinningInterval = 500;

      for (let spin = 0; spin < spinningTimes; spin++) {
        const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
        const spinEmbed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle('Rotation Selection')
          .setDescription(`Selecting... ${emojis[spin % emojis.length]}`)
          .addFields({ name: 'Participants', value: shuffledParticipants.join('\n'), inline: false })
          .setTimestamp()
          .setFooter({ text: 'Selection in progress...' });

        await interaction.editReply({ embeds: [spinEmbed], components: [disabledRow] });
        await new Promise((resolve) => setTimeout(resolve, spinningInterval));
      }

      const selectedIndex = Math.floor(Math.random() * participants.length);
      const selectedFacilitator = participants[selectedIndex];

      const resultEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🎉 Selected! 🎉')
        .setDescription(`**${selectedFacilitator}** has been selected!`)
        .addFields({ name: 'All Participants', value: participants.join('\n'), inline: false })
        .setTimestamp()
        .setFooter({ text: 'Thanks for using the Rotation Selector!' });

      await interaction.editReply({ embeds: [resultEmbed], components: [] });
      selectionMade = true;
      collector.stop();
    } else if (i.customId === 'cancel_selection') {
      const cancelEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('Rotation Selection')
        .setDescription('Selection cancelled.')
        .setTimestamp();

      await i.update({ embeds: [cancelEmbed], components: [] });
      selectionMade = true;
      collector.stop();
    }
  });

  collector.on('end', async () => {
    if (!selectionMade) {
      const timeoutEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('Rotation Selection')
        .setDescription('Selection timed out.')
        .setTimestamp();

      await interaction.editReply({ embeds: [timeoutEmbed], components: [] });
    }
  });
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('rotate')
    .setDescription('Rotation selection tools')
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('run')
        .setDescription('Randomly select participants from a list')
        .addStringOption((option) =>
          option
            .setName('participants')
            .setDescription('Comma-separated list of participant names')
            .setRequired(true),
        ),
    )
    .addSubcommandGroup((group) =>
      group
        .setName('template')
        .setDescription('Manage participant templates')
        .addSubcommand((subcommand) =>
          subcommand
            .setName('save')
            .setDescription('Save a participant list as a named template')
            .addStringOption((option) =>
              option.setName('name').setDescription('Template name (max 50 characters)').setRequired(true),
            )
            .addStringOption((option) =>
              option
                .setName('participants')
                .setDescription('Comma-separated list of participant names')
                .setRequired(true),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('use')
            .setDescription('Run the roulette using a saved template')
            .addStringOption((option) =>
              option.setName('name').setDescription('Template name').setRequired(true),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('delete')
            .setDescription('Delete a saved template')
            .addStringOption((option) =>
              option.setName('name').setDescription('Template name').setRequired(true),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand.setName('list').setDescription('List all templates for this server'),
        ),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const subcommandGroup = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();

    if (subcommandGroup === 'template') {
      if (subcommand === 'save') {
        await handleTemplateSave(interaction);
      } else if (subcommand === 'use') {
        await handleTemplateUse(interaction);
      } else if (subcommand === 'delete') {
        await handleTemplateDelete(interaction);
      } else if (subcommand === 'list') {
        await handleTemplateList(interaction);
      }
      // No else needed: Discord enforces valid subcommand values via the builder
    } else {
      // subcommand === 'run'
      await handleRun(interaction);
    }
  },
};

async function handleRun(interaction: ChatInputCommandInteraction): Promise<void> {
  const participantsInput = interaction.options.getString('participants', true);
  const participants = parseParticipants(participantsInput);

  if (participants.length === 0) {
    await interaction.reply({
      content: 'Please provide at least one participant name.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await runRoulette(interaction, participants);
}

async function handleTemplateSave(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('name', true).trim();
  const participantsInput = interaction.options.getString('participants', true);
  const participants = parseParticipants(participantsInput);

  if (name.length === 0 || name.length > 50) {
    await interaction.reply({
      content: 'Template name must be between 1 and 50 characters.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (participants.length === 0) {
    await interaction.reply({
      content: 'Please provide at least one participant name.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (participants.length > 50) {
    await interaction.reply({
      content: 'A template can have at most 50 participants.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const now = new Date();
  await templateStorage.upsertTemplate({
    id: randomUUID(),
    guildId: interaction.guildId!,
    name,
    participants,
    createdAt: now,
    updatedAt: now,
  });

  await interaction.reply({
    content: `Template **${name}** saved with ${participants.length} participant(s).`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleTemplateUse(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('name', true).trim();
  const template = await templateStorage.getTemplateByName(interaction.guildId!, name);

  if (!template) {
    await interaction.reply({
      content: `Template **${name}** not found. Use \`/rotate template list\` to see available templates.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (template.participants.length === 0) {
    await interaction.reply({
      content: 'Please provide at least one participant name.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await runRoulette(interaction, template.participants);
}

async function handleTemplateDelete(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('name', true).trim();

  try {
    await templateStorage.deleteTemplate(interaction.guildId!, name);
    await interaction.reply({
      content: `Template **${name}** has been deleted.`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    // Note: matches the exact error message thrown by FacilitatorTemplateStorage.deleteTemplate.
    // If that message changes, update this string too.
    if (error instanceof Error && error.message === `Template "${name}" not found in this server`) {
      await interaction.reply({
        content: `Template **${name}** not found. Use \`/rotate template list\` to see available templates.`,
        flags: MessageFlags.Ephemeral,
      });
    } else {
      throw error;
    }
  }
}

async function handleTemplateList(interaction: ChatInputCommandInteraction): Promise<void> {
  const templates = await templateStorage.getTemplatesByGuild(interaction.guildId!);

  if (templates.length === 0) {
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Rotation Templates')
      .setDescription('No templates saved yet.')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    return;
  }

  const displayTemplates = templates.slice(0, 25);
  const embed = new EmbedBuilder().setColor('#0099ff').setTitle('Rotation Templates').setTimestamp();

  for (const t of displayTemplates) {
    const preview = t.participants.slice(0, 3).join(', ');
    const suffix = t.participants.length > 3 ? '...' : '';
    embed.addFields({
      name: t.name,
      value: `${t.participants.length} ${t.participants.length === 1 ? 'participant' : 'participants'}: ${preview}${suffix}`,
      inline: false,
    });
  }

  if (templates.length > 25) {
    embed.setFooter({ text: `Showing 25 of ${templates.length} templates` });
  }

  await interaction.reply({ embeds: [embed] });
}

module.exports = command;
