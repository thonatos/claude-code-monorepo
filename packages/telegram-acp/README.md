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

```bash
# Create config file
mkdir -p ~/.telegram-acp
cat > ~/.telegram-acp/config.yaml << 'EOF'
telegram:
  botToken: "YOUR_TOKEN"
agent:
  preset: claude
EOF

# Run with preset
npx telegram-acp --preset claude
```

On first run, the bridge will:
1. Connect to Telegram with your bot token
2. Begin polling direct messages

## Built-in Agent Presets

```bash
npx telegram-acp agents
```

Current presets:
- `copilot` - GitHub Copilot
- `claude` - Claude Code ACP
- `codex` - Codex CLI

## CLI Usage

```text
telegram-acp --preset <name>    Start with preset (config from ~/.telegram-acp/config.yaml)
telegram-acp --config <file>    Start with config file
telegram-acp agents             List available presets
telegram-acp                    Start with default config
```

Examples:
```bash
npx telegram-acp --preset claude
npx telegram-acp --config /path/to/config.yaml
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

## Storage

Runtime files stored under:
```
~/.telegram-acp/
└── config.yaml    # Configuration file (auto-loaded)
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