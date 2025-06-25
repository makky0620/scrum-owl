import { 
  SlashCommandBuilder, 
  EmbedBuilder,
  ChatInputCommandInteraction
} from 'discord.js';
import { Command } from '../command';
import axios from 'axios';
import 'dotenv/config';

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
    .setDescription('Calculate time between PR creation and merge for a repository')
    .addStringOption(option =>
      option.setName('repository')
        .setDescription('Name of the repository to analyze')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('days')
        .setDescription('Number of days to look back (default: 7)')
        .setRequired(false)) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const repository = interaction.options.getString('repository', true);
    const days = interaction.options.getInteger('days') || 7;

    await interaction.deferReply();

    try {
      // First, get the repository ID
      const reposResponse = await axios.get(
        `https://${BACKLOG_HOST}/api/v2/projects/${BACKLOG_PROJECT_KEY}/git/repositories?apiKey=${BACKLOG_API_KEY}`
      );

      const repos = reposResponse.data;
      const targetRepo = repos.find((repo: any) => repo.name === repository);

      if (!targetRepo) {
        await interaction.editReply(`Repository "${repository}" not found in project ${BACKLOG_PROJECT_KEY}.`);
        return;
      }

      // Calculate the date range (now - days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get pull requests for the repository
      const prResponse = await axios.get(
        `https://${BACKLOG_HOST}/api/v2/projects/${BACKLOG_PROJECT_KEY}/git/repositories/${targetRepo.id}/pullRequests?apiKey=${BACKLOG_API_KEY}&sort=created&order=desc`
      );

      const pullRequests: PullRequest[] = prResponse.data;

      // Filter PRs created within the date range and that have been merged
      const mergedPRs = pullRequests.filter(pr => {
        const createdDate = new Date(pr.created);
        return createdDate >= startDate && 
               createdDate <= endDate && 
               pr.mergedAt !== null;
      });

      if (mergedPRs.length === 0) {
        await interaction.editReply(`No merged pull requests found in repository "${repository}" in the last ${days} days.`);
        return;
      }

      // Calculate time between creation and merge for each PR
      const prTimes = mergedPRs.map(pr => {
        const createdDate = new Date(pr.created);
        const mergedDate = new Date(pr.mergedAt!);
        const timeToMergeMs = mergedDate.getTime() - createdDate.getTime();
        const timeToMergeHours = timeToMergeMs / (1000 * 60 * 60);

        return {
          number: pr.number,
          summary: pr.summary,
          timeToMergeHours
        };
      });

      // Calculate average time to merge
      const totalHours = prTimes.reduce((sum, pr) => sum + pr.timeToMergeHours, 0);
      const averageHours = totalHours / prTimes.length;

      // Find min and max times
      const minTime = Math.min(...prTimes.map(pr => pr.timeToMergeHours));
      const maxTime = Math.max(...prTimes.map(pr => pr.timeToMergeHours));

      // Create an embed with the results
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`PR Metrics for ${repository}`)
        .setDescription(`Analysis of ${mergedPRs.length} merged PRs in the last ${days} days`)
        .addFields(
          { name: 'Average Time to Merge', value: `${averageHours.toFixed(2)} hours`, inline: true },
          { name: 'Minimum Time', value: `${minTime.toFixed(2)} hours`, inline: true },
          { name: 'Maximum Time', value: `${maxTime.toFixed(2)} hours`, inline: true },
          { name: 'Total PRs Analyzed', value: `${mergedPRs.length}`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `Project: ${BACKLOG_PROJECT_KEY}` });

      // Add the 5 most recent PRs to the embed
      const recentPRs = prTimes.sort((a, b) => b.number - a.number).slice(0, 5);
      if (recentPRs.length > 0) {
        let recentPRsText = '';
        recentPRs.forEach(pr => {
          recentPRsText += `#${pr.number}: ${pr.summary.substring(0, 30)}${pr.summary.length > 30 ? '...' : ''} - ${pr.timeToMergeHours.toFixed(2)} hours\n`;
        });
        embed.addFields({ name: 'Recent PRs', value: recentPRsText });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching PR metrics:', error);
      await interaction.editReply('An error occurred while fetching PR metrics. Please check the logs for details.');
    }
  },
};

module.exports = command;
