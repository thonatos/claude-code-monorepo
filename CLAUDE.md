# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A pnpm monorepo containing `telegram-acp` - a bridge that connects Telegram direct messages to ACP-compatible AI agents via grammy Bot API.

## Workflow Requirements

**REQUIRED: Use Superpowers for all implementation work**

Before ANY implementation, you MUST:

1. **Brainstorming** - Use `superpowers:brainstorming` to clarify requirements and design
2. **Spec** - Write design spec to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
3. **Plan** - Use `superpowers:writing-plans` to create implementation plan
4. **Execute** - Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to execute plan

**Never skip these steps or start implementation without approved spec and plan.**

## Documentation Requirements

**Documentation must be updated synchronously after code changes:**

1. **Package README.md** - `packages/<package>/README.md`
2. **Root README.md** - `<root>/README.md`

**Trigger conditions**: Architecture changes, new features/APIs, config format changes, CLI command changes

## Language Policy

**All documentation and code comments must be in English.**

## Package Management

**Use `pnpm` for all package operations:**

```bash
pnpm install          # Install dependencies
pnpm add <pkg>        # Add dependency to workspace root
pnpm --filter <pkg> add <dep>  # Add dependency to specific package
```

**Do NOT use `npm` or `yarn` commands.**

## Commands

### Build & Develop

```bash
cd packages/telegram-acp
pnpm run build     # Compile TypeScript to dist/
pnpm run dev       # Watch mode
pnpm run start     # Run compiled CLI
```

### CLI Commands

**Development mode:**

```bash
pnpm --filter telegram-acp run start -- --preset <name>
pnpm --filter telegram-acp run start -- --config <file>
pnpm --filter telegram-acp run start -- agents
```

**After installation:**

```bash
pnpx telegram-acp --preset <name>
pnpx telegram-acp --config <file>
pnpx telegram-acp agents
```

### Built-in Agent Presets

`copilot`, `claude`, `codex`

## Architecture

```
packages/telegram-acp/
├── src/
│   ├── bin/telegram-acp.ts   # CLI entry point, arg parsing
│   ├── index.ts              # Package exports
│   ├── bridge.ts             # Orchestration: creates bot + session manager
│   ├── telegram-api.ts       # Bot API wrapper for dependency injection
│   ├── client.ts             # ACP Client implementation
│   ├── config.ts             # Config loading, presets, defaults
│   ├── health.ts             # Health monitoring, process management
│   ├── history.ts            # History injection, token estimation
│   ├── bot/
│   │   ├── index.ts          # grammy Bot setup, exports BotApi type
│   │   ├── middleware/
│   │   │   ├── auth.ts       # Whitelist check or open mode
│   │   │   └── session.ts    # Inject UserSession into context
│   │   ├── handlers/
│   │   │   ├── commands.ts   # /start, /help, /status, /restart, /clear
│   │   │   └── message.ts    # Forward to ACP agent
│   │   └── formatters/
│   │       ├── markdown.ts   # Markdown to HTML conversion
│   │       └── escape.ts     # HTML escape utilities
│   ├── session/
│   │   ├── index.ts          # SessionManager orchestrator
│   │   ├── lifecycle.ts      # Session CRUD, restore, message recording
│   │   ├── spawn.ts          # Agent process spawn + ACP connection
│   │   ├── idle-manager.ts   # Idle timeout + session eviction
│   │   └── types.ts          # UserSession, SessionManagerOpts types
│   ├── storage/
│   │   ├── index.ts          # Storage exports
│   │   ├── file-storage.ts   # File-based storage with batch flush
│   │   └── types.ts          # StoredSession, StoredMessage types
│   └── streaming/
│       ├── index.ts          # Streaming exports
│       ├── state.ts          # StreamingMessageState coordinator
│       ├── message-stream.ts # Single message stream state
│       ├── rate-limiter.ts   # TelegramRateLimiter
│       ├── formatting.ts     # markdownToHtml, escapeHtml, formatThought
│       └── types.ts          # StreamingConfig, MessageCallbacks
```

**Key flows:**

1. **Startup**: CLI parses args → loadConfig → TelegramAcpBridge.start() → create TelegramApiWrapper + SessionManager + Bot
2. **Message**: grammy middleware chain (auth → session) → messageHandler → ACP prompt → agent subprocess → reply
3. **Session**: One ACP session per Telegram user, spawned via stdio, auto-cleanup after idle timeout

**Dependency injection:**
- `TelegramApiWrapper` encapsulates Bot API for cleaner dependency injection
- `SessionManager` uses injected callbacks for Telegram operations
- Modules are decoupled via clear interfaces (types.ts in each module)

## Session Persistence

Sessions are persisted to `~/.telegram-acp/sessions/{userId}/{sessionId}.json`:
- Session metadata (agent config, timestamps, status)
- Conversation history (user prompts + agent replies)
- Automatic restoration on service restart

**Commands:**
- `/start` - Create new session or restore existing one
- `/status` - Show session details (ID, messages, timestamps)
- `/restart` - Terminate current session and create new one
- `/clear` - Clear conversation history

## Configuration

Runtime files stored in `~/.telegram-acp/` (config.yaml)

Config file format (YAML):
```yaml
telegram:
  botToken: "..."

agent:
  preset: claude

proxy: "socks5://user:pass@host:port"

allowedUsers:
  - "123456"

open: false

reaction:
  enabled: true
  emoji: "👍"

session:
  idleTimeoutMs: 86400000
  maxConcurrentUsers: 10

history:
  maxMessages: null  # null = unlimited
  maxDays: null      # null = unlimited

showThoughts: false
```

## Notes

- Requires Node.js 20+
- Only processes direct messages (group chats ignored)
- Permission requests auto-approved
- MCP servers not used
- Proxy support via SOCKS5