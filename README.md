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

Create and manage recurring reminders with support for multiple days of the week:

```
/reminder create title: [reminder title] days: [days] time: [HH:mm] [description: optional] [timezone: optional]
/reminder list
/reminder edit reminder_id: [id]
/reminder delete reminder_id: [id]
/reminder toggle reminder_id: [id]
```

#### Examples

```
# Single day reminder
/reminder create title: "Daily Standup" days: "monday" time: "09:00"

# Multiple days reminder
/reminder create title: "Team Sync" days: "mon,wed,fri" time: "14:00"

# Using day numbers (0=Sunday, 1=Monday, etc.)
/reminder create title: "Weekend Planning" days: "0,6" time: "10:00"

# Mixed format with description and timezone
/reminder create title: "Sprint Review" days: "friday,1" time: "15:30" description: "Review completed work" timezone: "America/New_York"

# Edit an existing reminder (opens modal interface)
/reminder edit reminder_id: "abc123"
```

#### Day Format Options

- **Day names**: `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, `sunday`
- **Short names**: `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`
- **Numbers**: `0` (Sunday), `1` (Monday), `2` (Tuesday), `3` (Wednesday), `4` (Thursday), `5` (Friday), `6` (Saturday)
- **Multiple days**: Separate with commas: `"mon,wed,fri"` or `"1,3,5"`

## Development

Source code is in the `src` directory. To add a new command:

1. Create a file in `src/commands/`
2. Implement the `Command` interface
3. Run `npm run deploy`

## License

ISC
