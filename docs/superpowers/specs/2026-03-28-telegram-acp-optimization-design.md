# telegram-acp Optimization Spec

## Overview

Optimize telegram-acp package for simplicity and clarity: simplify CLI, reduce presets, clean up logs, and flatten project structure with clearer logic.

## 1. CLI Simplification

### New CLI Interface

```
telegram-acp --preset <name>         # start with preset, config from ~/.telegram-acp/config.json
telegram-acp --config <file>         # start with config file (preset inside)
telegram-acp agents                  # list available presets
telegram-acp                         # start with default config
```

### Removed

- Utility commands: `stop`, `status`, `test`, `whoami`
- All CLI options except `--preset` and `--config`
- Daemon mode entirely

### Config File Format (nested structure preserved)

```json
{
  "telegram": {
    "botToken": "..."
  },
  "agent": {
    "preset": "claude"
  },
  "proxy": "socks5://user:pass@host:port",
  "allowedUsers": ["12345", "67890"],
  "open": false,
  "reaction": {
    "enabled": true,
    "emoji": "👍"
  },
  "session": {
    "idleTimeoutMs": 86400000,
    "maxConcurrentUsers": 10
  },
  "showThoughts": false
}
```

Config path: `~/.telegram-acp/config.json` (default)

## 2. Preset Reduction

### Presets to Keep

- `copilot` — GitHub Copilot (`npx @github/copilot --acp --yolo`)
- `claude` — Claude Code (`pnpx @agentclientprotocol/claude-agent-acp`)
- `codex` — Codex CLI (`npx @zed-industries/codex-acp`)

### Presets to Remove

- `gemini`, `qwen`, `opencode`

## 3. Project Structure

### New Structure (6 files, no subdirectories)

```
src/
├── session.ts        # Session lifecycle management
├── client.ts         # ACP client implementation
├── bot.ts            # Telegram bot setup and message handling
├── bridge.ts         # Bridge orchestration
├── config.ts         # Configuration types and loading
├── index.ts          # Package exports
└── bin/
    └── telegram-acp.ts  # CLI entry (simplified)
```

### File Responsibilities

#### `session.ts`

Single responsibility: session lifecycle management.

```typescript
export class SessionManager {
  constructor(config: SessionConfig, log: Logger)

  // Public interface
  getOrCreate(userId: string): Promise<UserSession>
  stop(): Promise<void>

  // Private internals
  - create(userId: string): Promise<UserSession>
  - setupIdleTimer(userId: string): void
  - evictOldest(): void
  - spawnAgent(): AgentProcessInfo
}

export interface UserSession {
  userId: string
  client: TelegramAcpClient
  connection: acp.ClientSideConnection
  sessionId: string
  lastActivity: number
}
```

Merges: `acp/session.ts` + `acp/agent-manager.ts`

Logic flow when `getOrCreate(userId)` is called:
1. Check if session exists → return if found
2. Check max concurrent limit → evict oldest if needed
3. Create new session (spawn agent, initialize ACP connection)
4. Setup idle timer
5. Return session

#### `bot.ts`

Single responsibility: Telegram bot configuration and message handling.

```typescript
export function createBot(
  token: string,
  sessionManager: SessionManager,
  config: Config
): Bot

// Internal layers (inline, but clearly separated):
// 1. Bot instantiation with proxy config
// 2. Error handler setup
// 3. Auth middleware (check allowedUsers or open mode)
// 4. Session middleware (inject session into context)
// 5. Message handler (extract content, send to ACP, reply)
// 6. Command handlers (/start, /help, /status)
```

Merges: `bot.ts` + `middleware/auth.ts` + `middleware/acp-session.ts` + `handlers/message.ts`

Message handling flow:
1. Extract text/media content from message
2. Build ACP prompt
3. Get/create session for user
4. Call `connection.prompt()`
5. Flush client buffer for reply
6. Send reply to user

#### `config.ts`

Single responsibility: configuration definition and loading.

```typescript
export interface Config {
  telegram: { botToken: string }
  agent: { preset?: string; command: string; args: string[]; cwd: string; env?: Record<string, string> }
  proxy?: string
  allowedUsers?: string[]
  open?: boolean
  reaction: { enabled: boolean; emoji?: string; randomEmojis?: string[] }
  session: { idleTimeoutMs: number; maxConcurrentUsers: number }
  showThoughts: boolean
}

export function loadConfig(configPath?: string, presetArg?: string): Config

export const PRESETS: Record<string, AgentPreset>
```

Logic flow in `loadConfig()`:
1. Start with defaults
2. Load config file if exists
3. Resolve preset (CLI arg > config file)
4. Return complete config

#### `client.ts`

Unchanged. ACP client implementation handling:
- Permission auto-approval
- Session updates (message chunks, thoughts, tool calls)
- Text buffer for collecting reply

#### `bridge.ts`

Unchanged. Orchestration layer connecting bot and session manager.

#### `index.ts`

Unchanged. Package exports.

### Files to Delete

- `src/middleware/auth.ts` → inline into `bot.ts`
- `src/middleware/acp-session.ts` → inline into `bot.ts`
- `src/handlers/message.ts` → inline into `bot.ts`
- `src/adapter/outbound.ts` → remove (duplicate function)
- `src/acp/agent-manager.ts` → merge into `session.ts`

## 4. Logging

### Log Categories to Keep

| Category | Format | Notes |
|----------|--------|-------|
| Bridge lifecycle | `[telegram-acp] Starting...` / `Stopping...` | |
| Session lifecycle | `[session] Creating for ${userId}` / `Stopping for ${userId}` / `Idle, removing` | |
| Agent process | `[agent] Spawning...` / `exited code=${code}` | |
| ACP connection | `[acp] Initialized v${version}` / `Session created: ${id}` | |
| Permission | `[permission] auto-allowed: ${title}` | |
| Tool call | `[tool] ${title} (${status})` | |
| Tool update | `[tool] ${id} → ${status}` | |
| Thought | `[thought] ${text.slice(0,80)}...` | truncated |
| Plan | `[plan] ${entries}` | |
| Auth blocked | `[auth] Blocked user ${userId}` | |

### Log Categories to Remove

| Category | Reason |
|----------|--------|
| Message received dump | Redundant (session creation covers it) |
| Prompt enqueued | Redundant (follows from message) |
| Bot creation debug | Debug info, not useful in production |
| Full message object dump | Too verbose, no value |

### Logger Pattern

```typescript
type Logger = (msg: string) => void

// In bridge.ts constructor:
const log = (msg: string) => {
  const ts = new Date().toISOString().substring(11, 19)
  console.log(`[${ts}] ${msg}`)
}
```

## 5. Implementation Order

1. **config.ts** — simplify presets, update `loadConfig()` logic
2. **bin/telegram-acp.ts** — simplify CLI, remove unused commands/options
3. **session.ts** — merge session + agent-manager, clean logic
4. **bot.ts** — merge middleware + handlers, clear layering
5. **bridge.ts** — adapt to new session/bot interfaces
6. **client.ts** — update logging calls
7. Delete removed files
8. Update `index.ts` exports if needed
9. Build and test

## 6. Success Criteria

- CLI has only 2 options: `--preset` and `--config`
- 3 presets: copilot, claude, codex
- 6 source files in flat `src/` structure
- Each file has single clear responsibility
- Log output concise but informative
- All functionality preserved (message handling, session management, ACP integration)