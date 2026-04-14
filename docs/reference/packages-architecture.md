# Packages Architecture Reference

Detailed architecture and usage information for each package in the monorepo.

## Packages Overview

| Package | Description | Status |
|---------|-------------|--------|
| telegram-acp | CLI tool: Bridge Telegram to ACP agents | Active |
| telegram-agent | Service: ArtusX-based Telegram agent with webhook API | Active |
| web-app | React Router v7 web application | Active |

## telegram-acp

Bridge Telegram direct messages to any ACP-compatible AI agent.

### Architecture

```
packages/telegram-acp/src/
├── bin/telegram-acp.ts      # CLI entry point
├── index.ts                 # Package exports
├── bridge.ts                # Orchestration layer
├── telegram-api.ts          # Bot API wrapper
├── client.ts                # ACP Client implementation
├── config.ts                # Config loading, presets
├── health.ts                # Health monitoring
├── history.ts               # History management
├── utils/
│   └── logger.ts            # Logging utilities
├── media/                   # Media handling module
│   ├── types.ts             # Media type definitions
│   ├── downloader.ts        # Telegram → local file
│   ├── uploader.ts          # Local file → Telegram
│   ├── temp-manager.ts      # Auto cleanup scheduler
│   └── index.ts             # Media exports
├── reaction/                # Reaction management module
│   ├── types.ts             # Reaction phase types
│   ├── emoji-mapping.ts     # Phase → emoji constants
│   ├── manager.ts           # State + debouncing
│   └── index.ts             # Reaction exports
├── bot/
│   ├── index.ts             # grammy Bot setup
│   ├── middleware/          # Auth, session middleware
│   ├── handlers/            # Command, message handlers
│   │   └── message.ts       # Handles text + media messages
│   └── formatters/          # Markdown, escape utilities
├── session/
│   ├── index.ts             # SessionManager entry
│   ├── lifecycle.ts         # Session CRUD operations
│   ├── spawn.ts             # Agent process spawning
│   ├── idle-manager.ts      # Timeout management
│   └── types.ts             # Type definitions
├── storage/
│   ├── index.ts             # Storage exports
│   ├── file-storage.ts      # File-based implementation
│   └── types.ts             # Storage types
└── streaming/
    ├── index.ts             # Streaming exports
    ├── state.ts             # Multi-message coordination
    ├── message-stream.ts    # Single message state
    ├── rate-limiter.ts      # API rate limiting
    ├── formatting.ts        # Markdown/HTML conversion
    └── types.ts             # Streaming types
```

### Key Flows

1. **Startup**: CLI → loadConfig → TelegramAcpBridge.start() → Bot + SessionManager
2. **Message**: middleware chain → messageHandler → ACP prompt → agent subprocess → reply
3. **Session**: One ACP session per Telegram user, spawned via stdio, auto-cleanup

### Storage

```
~/.telegram-acp/
├── config.yaml              # Configuration file (auto-loaded)
└── sessions/                # Session persistence
    └── {userId}/
        └── {sessionId}.json

/tmp/telegram-acp/
└── media/                   # Temporary media files
    └── {userId}/            # User-specific directory
```

### CLI Commands

```bash
npx telegram-acp --preset <name>    # Use preset
npx telegram-acp --config <file>    # Use config file
npx telegram-acp agents             # List available presets
```

### Telegram Commands

- `/start` - Create or restore session
- `/status` - Show session details
- `/restart` - Terminate and create new session
- `/clear` - Clear conversation history

## telegram-agent

Modular Telegram agent with webhook support, built on ArtusX framework.

### Architecture

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

### Key Differences from telegram-acp

| Feature | telegram-acp | telegram-agent |
|---------|--------------|----------------|
| Architecture | Monolithic CLI | Plugin-based Service |
| Media Control | Regex parsing | Webhook API |
| Configuration | YAML file | Environment variables |
| Session | SessionManager class | ACP Plugin |

### Webhook API Endpoints

Base URL: `http://localhost:7001/api/telegram`

- `POST /send-message` - Send text message
- `POST /send-media` - Send media file
- `POST /edit-message` - Edit existing message
- `POST /send-reaction` - Add emoji reaction

## web-app

React Router v7 web application for stock analysis reports.

### Architecture

```
packages/web-app/
├── app/
│   ├── root.tsx             # Root layout
│   ├── routes.ts            # Route configuration
│   ├── app.css              # Global styles (Tailwind)
│   ├── routes/
│   │   ├── _index.tsx       # Home page
│   │   ├── about.tsx        # About page
│   │   └── report.tsx       # Stock report page
│   ├── components/
│   │   └── trading/         # Trading UI components
│   └── hooks/
│       └── useTheme.ts      # Theme management
├── public/                  # Static assets
├── vite.config.ts           # Vite configuration
├── react-router.config.ts   # React Router config
└── tsconfig.json            # TypeScript config
```

### Key Features

- Server-side rendering (SSR)
- Tailwind CSS v4 styling
- Dark/light theme toggle
- Stock K-line analysis integration

### Build Commands

```bash
pnpm --filter web-app run build    # Production build
pnpm --filter web-app run dev      # Development server
pnpm --filter web-app run start    # Production server
```