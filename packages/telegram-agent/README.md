# Telegram Agent

A modular Telegram agent application with webhook support and skills integration, built on ArtusX framework.

## Features

- **Webhook API** - Control bot via HTTP endpoints
- **Skills Integration** - Agent can proactively send media/messages
- **Plugin Architecture** - Telegram and ACP as injectable plugins
- **Session Management** - Per-user ACP agent sessions
- **Streaming Messages** - Real-time message streaming
- **Media Support** - Send/receive images and audio

## Quick Start

```bash
# Install dependencies
pnpm install

# Configure environment
export TELEGRAM_BOT_TOKEN="your-bot-token"
export TELEGRAM_WEBHOOK_TOKEN="your-webhook-secret"

# Development
pnpm run dev

# Build
pnpm run build

# Production
pnpm run start
```

## Architecture

```
packages/telegram-agent/
├── src/
│   ├── config/              # Configuration files
│   │   ├── config.default.ts
│   │   ├── config.development.ts
│   │   ├── config.production.ts
│   │   └── plugin.ts
│   ├── plugins/             # Inline plugins
│   │   ├── telegram/        # Telegram Bot plugin
│   │   └── acp/             # ACP Agent plugin
│   ├── module-bot/          # Telegram business logic
│   │   ├── bot.service.ts
│   │   ├── message.handler.ts
│   │   ├── media.handler.ts
│   │   └── command.handler.ts
│   ├── module-webhook/      # Webhook API
│   │   ├── webhook.controller.ts
│   │   ├── webhook.service.ts
│   │   └── auth.middleware.ts
│   └── module-bridge/       # Orchestration
│       └── bridge.service.ts
└── skills/telegram-agent/   # Skills documentation
```

### Plugins

**Telegram Plugin**
- Provides `TelegramClient` (grammy wrapper)
- Manages bot lifecycle
- Injected into business modules

**ACP Plugin**
- `SessionManager` - Per-user sessions
- `ProcessManager` - Agent process lifecycle
- `HistoryManager` - Conversation history
- `ACPClient` - ACP protocol implementation

### Modules

**Bot Module**
- Message handling
- Media upload/download
- Reactions
- Commands (/start, /status, /restart)

**Webhook Module**
- HTTP API endpoints
- Bearer token authentication
- Request validation

**Bridge Module**
- Message flow orchestration
- User → Agent → Telegram routing
- Webhook → Bot routing

## Configuration

### Environment Variables

- `TELEGRAM_BOT_TOKEN` - Bot token from @BotFather (required)
- `TELEGRAM_WEBHOOK_TOKEN` - Webhook auth token (required)
- `TELEGRAM_ACP_LOG_LEVEL` - Log level: error, warn, info, debug (optional)

### Config Files

Located in `src/config/`:

- `config.default.ts` - Default configuration
- `config.development.ts` - Dev overrides (auth disabled)
- `config.production.ts` - Production overrides

### Agent Configuration

```typescript
agent: {
  preset: 'claude',
  command: 'pnpx',
  args: ['@agentclientprotocol/claude-agent-acp'],
  cwd: process.cwd(),
  showThoughts: false,
}
```

## Webhook API

### Endpoints

Base URL: `http://localhost:7001/api/telegram`

**Send Message**
```bash
POST /send-message
{
  "userId": "123456",
  "text": "Hello!",
  "parseMode": "HTML"
}
```

**Send Media**
```bash
POST /send-media
{
  "userId": "123456",
  "filePath": "/tmp/image.png",
  "type": "image"
}
```

**Edit Message**
```bash
POST /edit-message
{
  "userId": "123456",
  "messageId": 42,
  "text": "Updated text"
}
```

**Send Reaction**
```bash
POST /send-reaction
{
  "userId": "123456",
  "messageId": 42,
  "emoji": "👍"
}
```

### Authentication

Include Bearer token:

```bash
curl -H "Authorization: Bearer your-token" ...
```

## Skills

See `skills/telegram-agent/SKILL.md` for complete skills documentation.

Skills allow agents to:
- Send messages proactively
- Send media files
- Edit messages
- Add reactions

## Development

### Project Structure

This project follows ArtusX Module-based organization:

- Each module is self-contained
- Services are injectable via `@Inject()`
- Controllers handle HTTP routes
- Plugins provide cross-cutting concerns

### Adding New Features

1. Create new module directory
2. Define service/controller
3. Register in plugin config if needed
4. Update documentation

## Migration from telegram-acp

Key differences from `packages/telegram-acp`:

- **Architecture**: Plugin-based vs monolithic
- **Media Control**: Webhook API vs regex parsing
- **Configuration**: Environment variables vs YAML file
- **Session**: ACP Plugin vs SessionManager class

Migrated features:
- ✅ ACP agent communication
- ✅ Session management
- ✅ Streaming messages
- ✅ Media support
- ✅ Reactions
- ✅ Commands

New features:
- ✅ Webhook API
- ✅ Skills integration
- ✅ Plugin architecture

## License

MIT
