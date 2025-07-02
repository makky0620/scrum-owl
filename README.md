# Scrum Master Discord Bot

A Discord bot that facilitates Planning Poker sessions for agile teams. This bot allows team members to vote on story points for tasks and helps reach consensus on estimates. Built with TypeScript and discord.js.

## Features

- Start planning poker sessions with a description of the item being estimated
- Vote using standard Fibonacci sequence values (0, 1, 2, 3, 5, 8, 13, 21, ?)
- Hide votes until everyone has voted
- Show results and check for consensus
- End sessions manually or automatically after timeout
- Randomly select a facilitator from a list of participants with a game-like animation
- Timer for pair programming sessions with start, pause, reset, and end controls
- Calculate and analyze time between pull request creation and merge for Backlog repositories
- Set reminders for specific times and channels to notify team members

## Prerequisites

- [Node.js](https://nodejs.org/) (v16.9.0 or higher)
- [TypeScript](https://www.typescriptlang.org/) (v4.0.0 or higher)
- A [Discord account](https://discord.com/) and a server where you have permission to add bots
- A [Discord application and bot](https://discord.com/developers/applications) set up in the Discord Developer Portal

## Setup

1. Clone this repository:

   ```
   git clone <repository-url>
   cd scrum-master
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Create a Discord application and bot:
   - Go to the [Discord Developer Portal](https://discord.com/developers/applications)
   - Click "New Application" and give it a name
   - Go to the "Bot" tab and click "Add Bot"
   - Under the "Privileged Gateway Intents" section, enable:
     - SERVER MEMBERS INTENT
     - MESSAGE CONTENT INTENT
   - Copy the bot token

4. Configure the bot:
   - Edit the `.env` file and replace the placeholder values:
     ```
     DISCORD_TOKEN=your_discord_bot_token
     CLIENT_ID=your_client_id
     GUILD_ID=your_guild_id
     ```
   - The `CLIENT_ID` is your application ID from the Discord Developer Portal
   - The `GUILD_ID` is the ID of your Discord server (right-click on your server and select "Copy ID")

5. Invite the bot to your server:
   - Go to the "OAuth2" > "URL Generator" tab in the Discord Developer Portal
   - Select the "bot" and "applications.commands" scopes
   - Select the following bot permissions:
     - Send Messages
     - Embed Links
     - Read Message History
     - Use External Emojis
     - Add Reactions
   - Copy the generated URL and open it in your browser to invite the bot to your server

6. Build the TypeScript code:

   ```
   npm run build
   ```

7. Register the slash commands:

   ```
   npm run deploy
   ```

8. Start the bot:

   ```
   npm start
   ```

   Alternatively, you can run the bot in development mode:

   ```
   npm run dev
   ```

## Docker Deployment

You can also run the bot using Docker and Docker Compose:

1. Make sure you have [Docker](https://www.docker.com/get-started) and [Docker Compose](https://docs.docker.com/compose/install/) installed.

2. Configure the bot by creating a `.env` file based on the provided `.env.example` file:

   ```
   cp .env.example .env
   ```

   Then edit the `.env` file with your actual values as described in the Setup section.

3. Build and start the Docker container:

   ```
   docker-compose up -d
   ```

4. To register slash commands when using Docker:

   ```
   docker-compose exec discord-bot node dist/deploy-commands.js
   ```

5. View logs:

   ```
   docker-compose logs -f
   ```

6. Stop the bot:
   ```
   docker-compose down
   ```

## Usage

### Planning Poker

1. Start a planning poker session:

   ```
   /poker description: [description of the item to estimate]
   ```

2. Vote by clicking on one of the point value buttons.

3. When everyone has voted, click "Show Results" to reveal all votes.

4. The bot will indicate whether there is consensus among the team.

5. Click "End Session" when you're done, or let it time out after 15 minutes.

### Facilitator Selection

1. Start a facilitator selection:

   ```
   /facilitator participants: [comma-separated list of participant names]
   ```

2. Click the "Start Selection" button to begin the random selection process.

3. Watch the game-like animation as it randomly selects a facilitator.

4. The selected facilitator will be highlighted in the final result.

5. You can cancel the selection at any time, or let it time out after 5 minutes.

### PR Metrics

1. Get metrics for pull requests in one or more repositories:

   ```
   /prmetrics repositories: [comma-separated repository names] days: [number of days to look back]
   ```

   The `days` parameter is optional and defaults to 7 days.

2. The bot will display for each repository:
   - Average time between PR creation and merge
   - Minimum and maximum time to merge
   - Total number of PRs analyzed
   - Details of all PRs with their merge times

3. This command requires Backlog API configuration in the `.env` file:
   ```
   BACKLOG_HOST=your_backlog_host
   BACKLOG_API_KEY=your_backlog_api_key
   BACKLOG_PROJECT_KEY=your_backlog_project_key
   ```

### Reminder

The reminder feature allows you to set both one-time and daily recurring reminders. All reminders are saved to a file and will persist even if the bot restarts.

#### One-time Reminder

1. Set a one-time reminder for a specific date and time:

   ```
   /reminder once channel: [text channel] message: [reminder message] date: [YYYY-MM-DD] time: [HH:MM]
   ```

   - `channel`: The text channel where the reminder will be sent
   - `message`: The message to be sent when the reminder triggers
   - `date`: The date for the reminder in YYYY-MM-DD format (e.g., 2023-12-31)
   - `time`: The time for the reminder in 24-hour HH:MM format (e.g., 14:30)

2. The bot will confirm that your one-time reminder has been set and will display:
   - The channel where the reminder will be sent
   - The date and time when the reminder will trigger
   - The message that will be sent

#### Daily Reminder

1. Set a daily reminder that repeats at the same time every day:

   ```
   /reminder daily channel: [text channel] message: [reminder message] time: [HH:MM]
   ```

   - `channel`: The text channel where the reminder will be sent
   - `message`: The message to be sent when the reminder triggers
   - `time`: The time for the daily reminder in 24-hour HH:MM format (e.g., 14:30)

2. The bot will confirm that your daily reminder has been set and will display:
   - The channel where the reminder will be sent
   - The time when the reminder will trigger each day
   - The first occurrence date and time
   - The message that will be sent

#### List Reminders

1. List all active reminders:

   ```
   /reminder list
   ```

2. The bot will display all active reminders with:
   - The reminder type (one-time or daily)
   - The channel where the reminder will be sent
   - The date and time when the reminder will trigger
   - The message that will be sent

#### Delete Reminder

1. Delete a specific reminder:

   ```
   /reminder delete index: [reminder index]
   ```

   - `index`: The index of the reminder to delete (as shown in the list)

2. The bot will confirm that the reminder has been deleted and will display the details of the deleted reminder.

#### Add Content to Reminder

1. Add content items to an existing reminder:

   ```
   /reminder add-content index: [reminder index] content: [content item]
   ```

   - `index`: The index of the reminder to add content to (as shown in the list)
   - `content`: The content item to add to the reminder

2. The bot will confirm that the content has been added and will display:
   - The channel where the reminder will be sent
   - The date and time when the reminder will trigger
   - The message (title) of the reminder
   - All content items, including the newly added one

3. You can add multiple content items by using this command multiple times with the same reminder index.

When a reminder's time arrives, the bot will automatically send the reminder message to the designated channel, including all content items. Daily reminders will continue to trigger every day at the specified time.

## Development

### TypeScript

This project is written in TypeScript. The source code is in the `src` directory and is compiled to JavaScript in the `dist` directory.

- `src/index.ts`: The main entry point for the bot
- `src/deploy-commands.ts`: Script to register slash commands with Discord
- `src/command.ts`: Interface definition for commands
- `src/commands/`: Directory containing all slash commands

To add a new command:

1. Create a new TypeScript file in the `src/commands` directory
2. Implement the `Command` interface
3. Export the command object
4. Run `npm run deploy` to register the new command with Discord

## License

ISC
