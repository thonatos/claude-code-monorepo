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

```bash
npx telegram-acp --preset <name>    # Start with preset
npx telegram-acp --config <file>    # Start with config file
npx telegram-acp agents             # List available presets
npx telegram-acp                    # Start with default config
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
│   ├── bot.ts                # grammy Bot setup, middleware, handlers
│   ├── client.ts             # ACP Client implementation
│   ├── session.ts            # Per-user session lifecycle, agent spawning
│   └── config.ts             # Config loading, presets, defaults
```

**Key flows:**

1. **Startup**: CLI parses args → loadConfig → TelegramAcpBridge.start() → create SessionManager + Bot
2. **Message**: grammy middleware chain (auth → session) → messageHandler → ACP prompt → agent subprocess → reply
3. **Session**: One ACP session per Telegram user, spawned via stdio, auto-cleanup after idle timeout

**Middleware chain (in bot.ts):**
- Auth: whitelist check or open mode
- Session: inject UserSession into context
- Commands: /start, /help, /status
- Messages: forward to ACP agent

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

showThoughts: false
```

## Workflow State

任务状态记录在 `.claude/workflow-state.json`：

```json
{
  "version": "1.0",
  "tasks": [
    {
      "id": "task-YYYYMMDD-NNN",
      "name": "任务名称",
      "spec": "docs/superpowers/specs/xxx-design.md",
      "plan": "docs/superpowers/plans/xxx.md",
      "status": "plan_approved",
      "files": ["path/to/file.ts"],
      "createdAt": "ISO timestamp",
      "approvedAt": "ISO timestamp or null"
    }
  ]
}
```

**状态值：** `pending` → `spec_written` → `spec_approved` → `plan_written` → `plan_approved` → `completed`

**修改规则：**
- `docs/superpowers/**` - 可直接修改
- 其他项目文件 - 需要 `plan_approved` 状态且文件在 `files` 列表中

## Notes

- Requires Node.js 20+
- Only processes direct messages (group chats ignored)
- Permission requests auto-approved
- MCP servers not used
- Proxy support via SOCKS5