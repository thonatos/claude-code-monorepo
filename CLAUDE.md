# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a pnpm monorepo containing the `wechat-acp` and `telegram-acp` packages - bridges that connect messaging platforms to ACP-compatible AI agents.

## Workflow Requirements

**REQUIRED: Use Superpowers for all implementation work**

Before ANY implementation, you MUST:

1. **Brainstorming** - Use `superpowers:brainstorming` to clarify requirements and design
2. **Spec** - Write design spec to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
3. **Plan** - Use `superpowers:writing-plans` to create implementation plan
4. **Execute** - Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to execute plan

**Never skip these steps or start implementation without approved spec and plan.**

## Package Management

**Use `pnpm` for all package operations:**

```bash
pnpm install          # Install dependencies
pnpm add <pkg>        # Add dependency
pnpm run build        # Build package
pnpm run test         # Run tests
```

**Do NOT use `npm` or `yarn` commands.**

## Commands

### Build & Develop (in `packages/*/`)

```bash
pnpm run build     # Compile TypeScript to dist/
pnpm run dev       # Watch mode
pnpm run start     # Run compiled CLI
```

### CLI Commands

```bash
npx wechat-acp --agent <preset|command> [options]  # Start bridge with agent
npx wechat-acp agents                               # List built-in presets
npx wechat-acp stop                                 # Stop daemon
npx wechat-acp status                               # Check status
```

### Built-in Agent Presets

`copilot`, `claude`, `gemini`, `qwen`, `codex`, `opencode`

## Architecture

### telegram-acp

```
packages/telegram-acp/
├── bin/telegram-acp.ts        # CLI entry point
├── src/
│   ├── index.ts               # Package exports
│   ├── bot.ts                 # grammy Bot wrapper
│   ├── bridge.ts              # Core message bridge logic
│   ├── config.ts              # Configuration and CLI parsing
│   ├── middleware/            # grammy middleware
│   │   ├── auth.ts            # User authentication
│   │   └── acp-session.ts     # ACP session injection
│   ├── handlers/              # Message handlers
│   │   └── message.ts         # Main message handler
│   └── acp/                   # ACP integration
│       └── session.ts         # Per-user session management
```

### wechat-acp

```
packages/wechat-acp/
├── bin/wechat-acp.ts          # CLI entry point
├── src/
│   ├── index.ts               # Package exports
│   ├── bridge.ts              # Core message bridge logic
│   ├── config.ts              # Configuration and CLI parsing
│   ├── acp/                   # ACP agent integration
│   │   ├── agent-manager.ts   # Manages agent subprocesses
│   │   ├── client.ts          # ACP client protocol
│   │   └── session.ts         # Per-user session management
│   ├── adapter/               # Message adaptation
│   │   ├── inbound.ts         # WeChat → ACP
│   │   └── outbound.ts        # ACP → WeChat
│   └── weixin/                # WeChat API integration
│       ├── api.ts             # WeChat iLink bot API
│       ├── auth.ts            # QR login and token management
│       ├── monitor.ts         # Message polling
│       ├── send.ts            # Message sending
│       ├── media.ts           # Media handling
│       └── types.ts           # Type definitions
```

## Key Flows

1. **Login**: QR code rendered in terminal → token saved to `~/.wechat-acp`
2. **Message Flow**: WeChat DM → inbound adapter → ACP session → agent subprocess → outbound adapter → WeChat reply
3. **Session Model**: One ACP session per WeChat user, auto-cleanup after idle timeout

## Configuration

Runtime files stored in `~/.wechat-acp/` (token, pid, logs, sync state)

Config file format (via `--config`):
```json
{
  "agent": { "preset": "copilot" },
  "session": { "idleTimeoutMs": 86400000, "maxConcurrentUsers": 10 }
}
```

## Notes

- Requires Node.js 20+
- Only processes direct messages (group chats ignored)
- Permission requests are auto-approved
- MCP servers not used
