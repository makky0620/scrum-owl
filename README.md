![Scrum Owl Logo](assets/icons/logo.png)

# Scrum Owl Discord Bot

A Discord bot that facilitates Planning Poker sessions for agile teams. Built with TypeScript and discord.js.

## Features

- Planning Poker: Estimate tasks with team voting
- Facilitator Selection: Randomly select a facilitator
- Reminders: Set one-time or recurring reminders

## Setup

### Prerequisites

- Node.js (v16.9.0+)
- Discord account and server

### Quick Start

1. Clone and install:

   ```
   git clone <repository-url>
   cd scrum-owl
   npm install
   ```

2. Create a Discord bot in the [Developer Portal](https://discord.com/developers/applications)
    - Enable SERVER MEMBERS INTENT and MESSAGE CONTENT INTENT
    - Copy the bot token

3. Configure environment:

   ```
   # .env file
   DISCORD_TOKEN=your_discord_bot_token
   CLIENT_ID=your_client_id
   GUILD_ID=your_guild_id
   ```

4. Deploy and start:
   ```
   npm run build
   npm run deploy
   npm start
   ```

### Docker Deployment

```
cp .env.example .env
# Edit .env with your values
docker-compose up -d
```

## Commands

### Planning Poker

```
/poker description: [item to estimate]
```

### Facilitator Selection

```
/facilitator participants: [comma-separated names]
```

### Reminders

Create, manage, and delete reminders.

#### Creating Reminders

```
/reminder create title: [title] message: [message] time: [time] type: [once|daily] [channel: #channel]
```

**Required Parameters:**
- `title`: Title of the reminder
- `message`: Message content of the reminder
- `time`: Execution time (e.g., "14:30", "2h", "2024-07-15 14:30")
- `type`: Type of reminder (`once`: one-time, `daily`: daily repeating)

**Optional Parameters:**
- `channel`: Destination channel for the reminder (defaults to current channel)
- `skip_weekends`: Skip weekends for daily reminders (true/false)
- `end_date`: End date (YYYY-MM-DD format)

**Usage Examples:**
```
# One-time reminder in current channel
/reminder create title: "Meeting" message: "Team meeting is starting" time: "14:30" type: once

# Daily reminder in specific channel
/reminder create title: "Daily Report" message: "Time to write daily report" time: "17:00" type: daily channel: #general

# Skip weekends reminder in specific channel
/reminder create title: "Stand-up" message: "Stand-up meeting time" time: "09:00" type: daily skip_weekends: true channel: #dev-team

# One-time reminder in different channel
/reminder create title: "Deployment" message: "Production deployment starting" time: "2h" type: once channel: #alerts
```

#### Listing Reminders

```
/reminder list
```

Displays a list of reminders you have created.

#### Deleting Reminders

```
/reminder delete id: [reminder_id]
```

Deletes the reminder with the specified ID.

#### Editing Reminders

```
/reminder edit id: [reminder_id] [title: new_title] [message: new_message] [time: new_time] [active: true/false]
```

Edits an existing reminder. All parameters are optional.

## Development

Source code is in the `src` directory. To add a new command:

1. Create a file in `src/commands/`
2. Implement the `Command` interface
3. Run `npm run deploy`

## License

ISC
