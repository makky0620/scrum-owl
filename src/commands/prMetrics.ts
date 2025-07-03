import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../command';
import axios from 'axios';
import 'dotenv/config';
import dayjs, { businessHoursDiff } from '../utils/dayjs';

// Backlog API configuration
const BACKLOG_HOST = process.env.BACKLOG_HOST;
const BACKLOG_API_KEY = process.env.BACKLOG_API_KEY;
const BACKLOG_PROJECT_KEY = process.env.BACKLOG_PROJECT_KEY;

// Interface for pull request data
interface PullRequest {
  id: number;
  number: number;
  summary: string;
  description: string;
  base: string;
  branch: string;
  status: {
    id: number;
    name: string;
  };
  assignee: {
    id: number;
    name: string;
  } | null;
  repository: {
    id: number;
    name: string;
  };
  created: string; // ISO date string
  updated: string; // ISO date string
  closedAt: string | null; // ISO date string or null if not closed
  mergedAt: string | null; // ISO date string or null if not merged
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('prmetrics')
    .setDescription('Calculate time between PR creation and merge for repositories')
    .addStringOption((option) =>
      option
        .setName('repositories')
        .setDescription('Names of repositories to analyze (comma-separated)')
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('days')
        .setDescription('Number of days to look back (default: 7)')
        .setRequired(false),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const repositoriesInput = interaction.options.getString('repositories', true);
    const repositoryNames = repositoriesInput
      .split(',')
      .map((repo) => repo.trim())
      .filter((repo) => repo.length > 0);
    const days = interaction.options.getInteger('days') || 7;

    if (repositoryNames.length === 0) {
      await interaction.reply('Please provide at least one repository name.');
      return;
    }

    await interaction.deferReply();

    try {
      // First, get all repositories
      const reposResponse = await axios.get(
        `https://${BACKLOG_HOST}/api/v2/projects/${BACKLOG_PROJECT_KEY}/git/repositories?apiKey=${BACKLOG_API_KEY}`,
      );
      const repos = reposResponse.data;

      // Calculate the date range (now - days)
      const endDate = dayjs();
      const startDate = dayjs().subtract(days, 'day');

      // Create an array to hold all embeds (one per repository)
      const embeds: EmbedBuilder[] = [];

      // Process each repository
      for (const repositoryName of repositoryNames) {
        const targetRepo = repos.find((repo: any) => repo.name === repositoryName);

        if (!targetRepo) {
          const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle(`Repository Not Found: ${repositoryName}`)
            .setDescription(
              `Repository "${repositoryName}" not found in project ${BACKLOG_PROJECT_KEY}.`,
            )
            .setTimestamp();

          embeds.push(errorEmbed);
          continue;
        }

        // Get pull requests for the repository
        const prResponse = await axios.get(
          `https://${BACKLOG_HOST}/api/v2/projects/${BACKLOG_PROJECT_KEY}/git/repositories/${targetRepo.id}/pullRequests?apiKey=${BACKLOG_API_KEY}&sort=created&order=desc`,
        );

        const pullRequests: PullRequest[] = prResponse.data;

        // Filter PRs created within the date range and that have been merged
        const mergedPRs = pullRequests.filter((pr) => {
          const createdDate = dayjs(pr.created);
          return (
            (createdDate.isAfter(startDate) || createdDate.isSame(startDate)) &&
            (createdDate.isBefore(endDate) || createdDate.isSame(endDate)) &&
            pr.mergedAt !== null
          );
        });

        if (mergedPRs.length === 0) {
          const noDataEmbed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle(`PR Metrics for ${repositoryName}`)
            .setDescription(`No merged pull requests found in the last ${days} days.`)
            .setTimestamp()
            .setFooter({ text: `Project: ${BACKLOG_PROJECT_KEY}` });

          embeds.push(noDataEmbed);
          continue;
        }

        // Calculate business hours between creation and merge for each PR
        const prTimes = mergedPRs.map((pr) => {
          const createdDate = dayjs(pr.created);
          const mergedDate = dayjs(pr.mergedAt!);
          const timeToMergeHours = businessHoursDiff(createdDate, mergedDate);

          return {
            number: pr.number,
            summary: pr.summary,
            timeToMergeHours,
          };
        });

        // Calculate average time to merge
        const totalHours = prTimes.reduce((sum, pr) => sum + pr.timeToMergeHours, 0);
        const averageHours = totalHours / prTimes.length;

        // Find min and max times
        const minTime = Math.min(...prTimes.map((pr) => pr.timeToMergeHours));
        const maxTime = Math.max(...prTimes.map((pr) => pr.timeToMergeHours));

        // Create an embed with the results
        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle(`PR Metrics for ${repositoryName}`)
          .setDescription(`Analysis of ${mergedPRs.length} merged PRs in the last ${days} days`)
          .addFields(
            {
              name: 'Average Business Hours to Merge',
              value: `${averageHours.toFixed(2)} hours`,
              inline: true,
            },
            { name: 'Minimum Business Hours', value: `${minTime.toFixed(2)} hours`, inline: true },
            { name: 'Maximum Business Hours', value: `${maxTime.toFixed(2)} hours`, inline: true },
            { name: 'Total PRs Analyzed', value: `${mergedPRs.length}`, inline: true },
          )
          .setTimestamp()
          .setFooter({ text: `Project: ${BACKLOG_PROJECT_KEY}` });

        // Add the 10 most recent PRs to the embed
        const recentPRs = prTimes.sort((a, b) => b.number - a.number).slice(0, 10);
        if (recentPRs.length > 0) {
          let recentPRsText = '';
          recentPRs.forEach((pr) => {
            recentPRsText += `#${pr.number}: ${pr.summary} - ${pr.timeToMergeHours.toFixed(2)} business hours\n`;
          });
          embed.addFields({ name: 'Recent PRs', value: recentPRsText });
        }

        embeds.push(embed);
      }

      // Send all embeds
      await interaction.editReply({ embeds });
    } catch (error) {
      console.error('Error fetching PR metrics:', error);
      await interaction.editReply(
        'An error occurred while fetching PR metrics. Please check the logs for details.',
      );
    }
  },
};

module.exports = command;
