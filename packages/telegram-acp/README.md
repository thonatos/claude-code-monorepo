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

### 开发模式

在项目目录内开发运行：

```bash
# 创建配置文件
mkdir -p ~/.telegram-acp
cat > ~/.telegram-acp/config.yaml << 'EOF'
telegram:
  botToken: "YOUR_TOKEN"
agent:
  preset: claude
EOF

# 构建 and 运行
pnpm run build
pnpm run start -- --preset claude
```

### 安装后使用

全局安装后可在任意目录运行：

```bash
# 构建并链接
pnpm run build
pnpm link --global

# 在任意目录运行
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

开发模式：

```text
pnpm run start -- --preset <name>    使用预设 (config from ~/.telegram-acp/config.yaml)
pnpm run start -- --config <file>    使用配置文件
pnpm run start -- agents             列出可用预设
```

安装后：

```text
pnpx telegram-acp --preset <name>    使用预设 (config from ~/.telegram-acp/config.yaml)
pnpx telegram-acp --config <file>    使用配置文件
pnpx telegram-acp agents             列出可用预设
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