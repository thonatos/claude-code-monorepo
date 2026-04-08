# Telegram ACP

Bridge Telegram direct messages to any ACP-compatible AI agent.

`telegram-acp` uses grammy Bot API to connect with a Telegram bot, listens for incoming direct messages, forwards them to an ACP agent over stdio, and sends the agent reply back to Telegram.

## Features

- Bot API connection via grammy
- One ACP agent session per Telegram user
- Built-in ACP agent presets
- Auto-allow permission requests
- Direct messages only (groups ignored)
- Message reactions (emoji acknowledgment)
- Proxy support (SOCKS5/HTTP)
- User whitelist for access control

## Requirements

- Node.js 20+
- Telegram Bot Token (from @BotFather)

## Quick Start

### Development Mode

Run inside the project directory:

```bash
# Create config file
mkdir -p ~/.telegram-acp
cat > ~/.telegram-acp/config.yaml << 'EOF'
telegram:
  botToken: "YOUR_TOKEN"
agent:
  preset: claude
EOF

# Build and run
pnpm run build
pnpm run start -- --preset claude
```

### After Installation

Run from any directory after global link:

```bash
# Build and link
pnpm run build
pnpm link --global

# Run from anywhere
pnpx telegram-acp --preset claude
```

## Built-in Agent Presets

```bash
npx telegram-acp agents
```

Current presets:
- `copilot` - GitHub Copilot
- `claude` - Claude Code ACP
- `codex` - Codex CLI

## CLI Usage

**Development mode:**

```text
pnpm run start -- --preset <name>    Use preset (config from ~/.telegram-acp/config.yaml)
pnpm run start -- --config <file>    Use config file
pnpm run start -- agents             List available presets
```

**After installation:**

```text
pnpx telegram-acp --preset <name>    Use preset (config from ~/.telegram-acp/config.yaml)
pnpx telegram-acp --config <file>    Use config file
pnpx telegram-acp agents             List available presets
```

## Configuration File

Config file is automatically loaded from `~/.telegram-acp/config.yaml` if it exists. You can also specify a custom path with `--config`.

```yaml
telegram:
  botToken: "bot_token_here"

agent:
  preset: claude

proxy: "socks5://user:pass@host:port"

allowedUsers:
  - "123456"
  - "789012"

open: false

reaction:
  enabled: true
  emoji: "👍"

session:
  idleTimeoutMs: 86400000
  maxConcurrentUsers: 10

showThoughts: false
```

## Architecture

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
├── bot/
│   ├── index.ts             # grammy Bot setup
│   ├── middleware/          # Auth, session middleware
│   ├── handlers/            # Command, message handlers
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

## Storage

Runtime files stored under:
```
~/.telegram-acp/
├── config.yaml              # Configuration file (auto-loaded)
└── sessions/                # Session persistence
    └── {userId}/
        └── {sessionId}.json
```

## Current Limitations

- Direct messages only; group chats ignored
- MCP servers not used
- Permission requests auto-approved

## Development

```bash
pnpm install
pnpm run build
pnpm run dev  # watch mode
```

## License

MIT