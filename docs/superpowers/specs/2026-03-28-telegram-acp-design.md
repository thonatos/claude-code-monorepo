# Telegram ACP Design Specification

**Date:** 2026-03-28
**Status:** Approved
**Based on:** wechat-acp architecture

## Overview

Build `telegram-acp` - a bridge connecting Telegram direct messages to any ACP-compatible AI agent, using MTProto protocol via the `telegram` library.

## Architecture

```
packages/telegram-acp/
├── bin/telegram-acp.ts          # CLI entry point
├── src/
│   ├── index.ts                 # Package exports
│   ├── bridge.ts                # Core message bridge logic
│   ├── config.ts                # Configuration and CLI parsing
│   │
│   ├── telegram/                # Telegram MTProto layer
│   │   ├── client.ts            # TelegramClient wrapper + Proxy support
│   │   ├── auth.ts              # Bot authentication + Session persistence
│   │   ├── monitor.ts           # Updates polling loop
│   │   ├── send.ts              # Send messages + Reactions
│   │   ├── download.ts          # Download media/files
│   │   └── types.ts             # Type definitions
│   │
│   ├── acp/                     # ACP integration (reuse wechat-acp)
│   │   ├── session.ts           # Per-user session management
│   │   ├── client.ts            # ACP Client implementation
│   │   └── agent-manager.ts     # Agent subprocess management
│   │
│   └── adapter/
│       ├── inbound.ts           # Telegram Message → ACP ContentBlock[]
│       └── outbound.ts          # ACP Output → Telegram MarkdownV2
```

## Configuration

### Config Structure

```typescript
interface TelegramAcpConfig {
  telegram: {
    apiId: number;
    apiHash: string;
    botToken: string;
    sessionString?: string;  // Persisted after auth
  };
  proxy?: {
    ip: string;
    port: number;
    type: "socks4" | "socks5" | "http" | "https";
    username?: string;
    password?: string;
  };
  allowedUsers?: string[];   // User ID whitelist
  open?: boolean;            // Open mode (ignore whitelist)
  reaction: {
    enabled: boolean;
    emoji?: string;          // Fixed emoji
    randomEmojis?: string[]; // Random emoji pool
  };
  agent: {
    preset?: string;
    command: string;
    args: string[];
    cwd: string;
    showThoughts: boolean;
  };
  agents: Record<string, AgentPreset>;
  session: {
    idleTimeoutMs: number;
    maxConcurrentUsers: number;
  };
  daemon: {
    enabled: boolean;
    logFile: string;
    pidFile: string;
  };
  storage: {
    dir: string;  // Default ~/.telegram-acp
  };
}
```

### Configuration Priority

CLI arguments > Environment variables > JSON config file

### Environment Variables

```bash
TELEGRAM_API_ID=<number>
TELEGRAM_API_HASH=<string>
TELEGRAM_BOT_TOKEN=<string>
TELEGRAM_PROXY=<url>  # sock5://user:pass@host:port or http://host:port
```

## CLI Design

### Main Command

```bash
telegram-acp --agent <preset|command> [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--agent <value>` | Built-in preset or raw command |
| `--cwd <dir>` | Working directory for agent |
| `--login` | Force re-authentication |
| `--daemon` | Run in background |
| `--config <file>` | JSON config file path |
| `--proxy <url>` | Proxy URL (socks5://user:pass@host:port) |
| `--allowed-users <ids>` | Whitelist user IDs (comma-separated) |
| `--open` | Open mode (any DM allowed) |
| `--reaction <emoji>` | Fixed reaction emoji |
| `--reaction-random` | Enable random reactions |
| `--no-reaction` | Disable reactions |
| `--idle-timeout <m>` | Session idle timeout (minutes) |
| `--max-sessions <n>` | Max concurrent sessions |
| `--show-thoughts` | Forward agent thoughts to Telegram |
| `--verbose` | Verbose logging |

### Subcommands

```bash
telegram-acp agents              # List built-in presets
telegram-acp stop                # Stop daemon
telegram-acp status              # Check daemon status
telegram-acp test                # Test connection
telegram-acp whoami              # Show bot info
telegram-acp session clear       # Clear persisted session
```

### Built-in Agent Presets

Same as wechat-acp:
- `copilot` → `npx @github/copilot --acp --yolo`
- `claude` → `npx @zed-industries/claude-code-acp`
- `gemini` → `npx @google/gemini-cli --experimental-acp`
- `qwen` → `npx @qwen-code/qwen-code --acp --experimental-skills`
- `codex` → `npx @zed-industries/codex-acp`
- `opencode` → `npx opencode-ai acp`

## Features

### Message Scope
- **Direct messages only** (1:1)
- Group messages ignored
- Whitelist-based access control

### Message Types

| Telegram Type | ACP Mapping |
|---------------|-------------|
| Text | `ContentBlock.text` |
| Photo | `ContentBlock.image` (base64) |
| Document | `ContentBlock.resource` (text files) or text description |
| Voice | Text description |
| Video | Text description |
| Sticker | Text description |
| Other | Text description |

### Message Formatting
- ACP output → Telegram MarkdownV2
- Preserves code blocks, lists, emphasis
- `--plain-text` flag for raw text mode

### Reaction (Message Acknowledgment)
- Send emoji reaction immediately on message receive
- Default: enabled with random emoji pool
- Default emoji pool: `["👍", "👌", "🫡", "⏳", "🔄"]`
- Configurable: fixed emoji or disabled

### Proxy Support
- Uses `telegram` library's built-in proxy support
- Proxy URL format: `socks5://user:pass@host:port`
- Supports: socks4, socks5, http, https

### Session Persistence
- Storage: `~/.telegram-acp/session.json`
- Contains: `sessionString`, `apiId`, `apiHash`
- Auto-reuse on subsequent runs

### Daemon Mode
- `--daemon` for background execution
- PID file: `~/.telegram-acp/daemon.pid`
- Log file: `~/.telegram-acp/telegram-acp.log`
- `stop` and `status` subcommands for management

## Key Flows

### Authentication Flow
1. Load `~/.telegram-acp/session.json`
2. If session invalid/missing → authenticate with `apiId/apiHash/botToken`
3. Save new session string

### Message Processing Flow
1. `monitor.ts` listens for Telegram updates
2. Whitelist check → filter DMs only
3. Send reaction emoji (acknowledgment)
4. `inbound.ts` converts to ACP ContentBlock[]
5. `session.ts` queues message for user's agent
6. Agent processes and responds
7. `outbound.ts` formats as MarkdownV2
8. Send reply via Telegram

### Session Management
- One ACP session per Telegram user
- Idle timeout cleanup (configurable)
- Max concurrent sessions limit

## Storage

```
~/.telegram-acp/
├── session.json      # Auth session data
├── daemon.pid        # Daemon PID (if running)
└── telegram-acp.log  # Log file (daemon mode)
```

## Dependencies

```json
{
  "telegram": "^latest",
  "@agentclientprotocol/sdk": "^0.16.1"
}
```

## Current Limitations

- Direct messages only; group chats ignored
- MCP servers not used
- Permission requests auto-approved
- Agent communication via stdio subprocess

## Future Enhancements

- Group chat support
- Webhook mode (instead of long polling)
- Custom reaction emoji selection
- Rate limiting per user
