# Telegram ACP

Bridge Telegram direct messages to any ACP-compatible AI agent.

`telegram-acp` uses grammy Bot API to connect with a Telegram bot, listens for incoming direct messages, forwards them to an ACP agent over stdio, and sends the agent reply back to Telegram.

## Features

- Bot API connection via grammy
- One ACP agent session per Telegram user
- Built-in ACP agent presets
- Auto-allow permission requests
- Direct messages only (groups ignored)
- **Bidirectional Media Support** - Send/receive images and audio
- **Phase-Based Reactions** - Real-time emoji feedback for processing status
- Proxy support (SOCKS5/HTTP)
- User whitelist for access control
- **Clean Telegram UI** - No tool messages, only typing indicators
- **Detailed CLI logging** - Shows thoughts, tool names, and results

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
  botToken: 'bot_token_here'

agent:
  preset: claude

proxy: 'socks5://user:pass@host:port'

allowedUsers:
  - '123456'
  - '789012'

open: false

reaction:
  enabled: true
  emoji: '👍'

session:
  idleTimeoutMs: 86400000
  maxConcurrentUsers: 10

showThoughts: false

# Logging configuration
observability:
  logging:
    level: info # CLI log level: error, warn, info, debug
```

## Environment Variables

Control logging behavior with environment variables:

```bash
# Set CLI log level (default: info)
TELEGRAM_ACP_LOG_LEVEL=debug npm start
```

### Log Levels

- `error` - Only errors
- `warn` - Errors + warnings
- `info` (default) - Thoughts + tool names + truncated results (200 chars)
- `debug` - Full details including complete params and results

## Media Support

### Supported Media Types

- **Images**: JPEG, PNG, GIF (photos and animations)
- **Audio**: MP3, OGG (audio files and voice messages)

### User Experience

**Incoming Media Flow:**

1. User sends image/audio to bot
2. Bot shows 👀 reaction (acknowledgment)
3. Bot shows 📤 reaction (downloading media)
4. Bot shows 🤔 reaction (agent thinking)
5. Bot shows 🔧 reaction (if tools are used)
6. Bot sends response text
7. Bot shows ✅ reaction (complete, shown 500ms then cleared)

**Outgoing Media Flow:**

- If agent generates images/audio, bot automatically uploads to Telegram
- Bot shows 📥 reaction during upload
- Files appear in chat as native Telegram media

**Agent Output Formats:**

Agents can indicate media files using two formats:

1. **Markdown format** (recommended):

   ```
   ![screenshot](/tmp/output.png)
   ```

2. **Plain text path** (on separate line):
   ```
   Screenshot saved to:
   /tmp/output.png
   ```

Both formats will trigger automatic media upload. The markdown syntax will be converted to inline code format in the text message.

### Technical Details

**Temporary Files:**

- Downloaded media stored in `/tmp/telegram-acp/media/{userId}/`
- Images passed via `uri` field (agent accesses via `readTextFile`)
- Audio encoded as base64 (required by ACP spec)
- Auto cleanup 60 seconds after processing
- Cleanup runs even if errors occur

**Examples:**

```
User: [Photo of code error]
Bot: Looking at your screenshot...
Bot: I see the issue - the function is missing a return statement...

User: [Voice message describing problem]
Bot: Processing your voice message...
Bot: Based on your description, here's the solution...
```

## Reaction System

The bot displays emoji reactions to provide real-time feedback on processing status:

| Emoji | Phase          | Meaning                                           |
| ----- | -------------- | ------------------------------------------------- |
| 👀    | Acknowledgment | Message received, starting processing             |
| 📤    | media_in       | Downloading media from Telegram                   |
| 📥    | media_out      | Uploading media to Telegram                       |
| 🤔    | thought        | Agent is thinking/analyzing                       |
| 🔧    | tool           | Tool is being executed (ReadFile, Terminal, etc.) |
| ✅    | done           | Processing complete (shown 500ms then cleared)    |

**Behavior:**

- Reactions are debounced (500ms minimum delay between API calls)
- Prevents API spam during rapid state changes
- Best-effort - failures don't block main conversation flow
- State tracking prevents duplicate reactions for same phase

## Telegram User Experience

### What Users See

**Clean message flow:**

- User sends message
- Bot shows 👀 reaction (acknowledgment)
- Bot shows typing indicator while processing
- Bot sends final response

**No clutter:**

- No tool call messages
- No thinking messages
- No status updates

### What CLI Shows

**Detailed logging:**

```
[thought] Analyzing the code structure...
[tool] ReadFile (running)
[tool] ReadFile → completed
  result: import { Config } from './types...
[tool] WriteFile (running)
  params: {
    "path": "/src/utils.ts"
  }
```

This provides full visibility for debugging while keeping Telegram clean.

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

## Storage

Runtime files stored under:

```
~/.telegram-acp/
├── config.yaml              # Configuration file (auto-loaded)
└── sessions/                # Session persistence
    └── {userId}/
        └── {sessionId}.json

/tmp/telegram-acp/
└── media/                   # Temporary media files
    └── {userId}/            # User-specific directory
        └── {fileId}.jpg     # Downloaded images
        └── {fileId}.mp3     # Downloaded audio
```

**Auto Cleanup:** Media files deleted 60s after processing completes.

## Current Limitations

- Direct messages only; group chats ignored
- MCP servers not used
- Permission requests auto-approved

## Development

```bash
pnpm install
pnpm run build
pnpm run dev        # watch mode
pnpm run test       # run tests
pnpm run lint       # check code quality (biome)
pnpm run lint:fix   # auto-fix lint issues
pnpm run format     # format code
```

## License

MIT
