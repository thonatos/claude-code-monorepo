# claude-code-monorepo

A pnpm monorepo containing `telegram-acp` - a bridge that connects Telegram direct messages to ACP-compatible AI agents via grammy Bot API.

## Architecture

```
claude-code-monorepo/
├── packages/
│   └── telegram-acp/       # Telegram → ACP bridge package
│       ├── src/
│       │   ├── bin/        # CLI entry point
│       │   ├── bridge.ts   # Orchestration layer
│       │   ├── bot.ts      # grammy Bot setup
│       │   ├── client.ts   # ACP client
│       │   ├── session.ts  # Per-user session management
│       │   └── config.ts   # Config loading & presets
│       └── dist/           # Compiled output
├── biome.json              # Linter/formatter config
├── commitlint.config.js    # Commit message validation
├── .gitleaks.toml          # Secret detection config
└── .husky/                 # Git hooks
```

## Quick Start

1. Get a Telegram bot token from @BotFather
2. Create config file:

```bash
mkdir -p ~/.telegram-acp
cat > ~/.telegram-acp/config.yaml << 'EOF'
telegram:
  botToken: "YOUR_BOT_TOKEN"
agent:
  preset: claude
EOF
```

3. Install and run:

```bash
pnpm install
pnpm --filter telegram-acp run build
npx telegram-acp --preset claude
```

## CLI Commands

```bash
npx telegram-acp --preset <name>    # Start with preset
npx telegram-acp --config <file>    # Start with config file
npx telegram-acp agents             # List available presets
npx telegram-acp                    # Start with default config
```

### Built-in Presets

| Preset | Agent |
|--------|-------|
| `copilot` | GitHub Copilot |
| `claude` | Claude Code ACP |
| `codex` | Codex CLI |

## Configuration

Config file: `~/.telegram-acp/config.yaml`

```yaml
telegram:
  botToken: "your_bot_token"

agent:
  preset: claude          # or: command + args for custom agent

proxy: "socks5://user:pass@host:port"

allowedUsers:
  - "123456"              # Telegram user IDs

open: false               # true = allow all users

reaction:
  enabled: true
  emoji: "👍"             # or use randomEmojis for variety

session:
  idleTimeoutMs: 86400000 # 24 hours
  maxConcurrentUsers: 10

showThoughts: false       # show agent thinking in replies
```

## Development

```bash
pnpm install              # Install dependencies
pnpm run lint             # Check code with biome
pnpm run lint:fix         # Auto-fix lint issues
pnpm run format           # Format all files
pnpm --filter telegram-acp run build  # Build package
pnpm --filter telegram-acp run dev    # Watch mode
```

## Security

- **No secrets in repo**: Bot tokens loaded from `~/.telegram-acp/config.yaml` (excluded via .gitignore)
- **Pre-commit hooks**: Gitleaks scans staged files for accidental secret uploads
- **Commit format**: Commitlint enforces conventional commit messages

## License

MIT