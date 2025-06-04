# Scrum Master Discord Bot

A Discord bot that facilitates Planning Poker sessions for agile teams. This bot allows team members to vote on story points for tasks and helps reach consensus on estimates.

## Features

- Start planning poker sessions with a description of the item being estimated
- Vote using standard Fibonacci sequence values (0, 1, 2, 3, 5, 8, 13, 21, ?)
- Hide votes until everyone has voted
- Show results and check for consensus
- End sessions manually or automatically after timeout

## Prerequisites

- [Node.js](https://nodejs.org/) (v16.9.0 or higher)
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

6. Register the slash commands:
   ```
   npm run deploy
   ```

7. Start the bot:
   ```
   npm start
   ```

## Usage

1. Start a planning poker session:
   ```
   /poker description: [description of the item to estimate]
   ```

2. Vote by clicking on one of the point value buttons.

3. When everyone has voted, click "Show Results" to reveal all votes.

4. The bot will indicate whether there is consensus among the team.

5. Click "End Session" when you're done, or let it time out after 15 minutes.

## License

ISC
