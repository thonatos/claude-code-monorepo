# claude-code-monorepo

A pnpm monorepo containing `telegram-acp` - a bridge that connects Telegram direct messages to ACP-compatible AI agents via grammy Bot API.

## Architecture

```
claude-code-monorepo/
├── packages/
│   └── telegram-acp/           # Telegram → ACP bridge package
│       ├── src/
│       │   ├── bin/            # CLI entry point
│       │   ├── bridge.ts       # Orchestration layer
│       │   ├── telegram-api.ts # Bot API wrapper
│       │   ├── client.ts       # ACP client
│       │   ├── config.ts       # Config loading & presets
│       │   ├── health.ts       # Health monitoring
│       │   ├── history.ts      # History injection
│       │   ├── bot/
│       │   │   ├── index.ts    # grammy Bot setup
│       │   │   ├── middleware/ # Auth, session middleware
│       │   │   ├── handlers/   # Command, message handlers
│       │   │   └── formatters/ # Markdown, escape utilities
│       │   ├── session/
│       │   │   ├── index.ts    # SessionManager entry
│       │   │   ├── lifecycle.ts    # Session CRUD
│       │   │   ├── spawn.ts    # Agent process spawning
│       │   │   ├── idle-manager.ts # Timeout management
│       │   │   └── types.ts    # Type definitions
│       │   ├── storage/
│       │   │   ├── index.ts    # Storage exports
│       │   │   ├── file-storage.ts # File implementation
│       │   │   └── types.ts    # Storage types
│       │   └── streaming/
│       │       ├── index.ts    # Streaming exports
│       │       ├── state.ts    # Message coordination
│       │       ├── message-stream.ts
│       │       ├── rate-limiter.ts
│       │       ├── formatting.ts
│       │       └── types.ts
│       └── dist/               # Compiled output
├── biome.json              # Linter/formatter config
├── commitlint.config.js    # Commit message validation
├── .gitleaks.toml          # Secret detection config
└── .husky/                 # Git hooks
```

## Quick Start

### Development Mode

Run inside the project directory:

```bash
pnpm install
pnpm --filter telegram-acp run build
pnpm --filter telegram-acp run start -- --preset claude
```

### After Installation

Run from any directory after global link:

```bash
# Build and link
cd packages/telegram-acp
pnpm run build
pnpm link --global

# Run from anywhere
pnpx telegram-acp --preset claude
```

## CLI Commands

**Development mode:**

```bash
pnpm --filter telegram-acp run start -- --preset <name>    # Use preset
pnpm --filter telegram-acp run start -- --config <file>    # Use config file
pnpm --filter telegram-acp run start -- agents             # List available presets
```

**After installation:**

```bash
pnpx telegram-acp --preset <name>    # Use preset
pnpx telegram-acp --config <file>    # Use config file
pnpx telegram-acp agents             # List available presets
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