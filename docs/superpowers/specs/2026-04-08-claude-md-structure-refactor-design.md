# CLAUDE.md Structure Refactor Design

Date: 2026-04-08

## Problem Statement

Current CLAUDE.md has structural issues causing implementation errors:

1. **Missed steps** - Workflow requirements mixed with other content, easy to skip
2. **Hard to find** - Reference info (commands, config) scattered across sections
3. **Mixed concerns** - Mandatory rules vs reference vs context not clearly separated

## Solution

Reorganize CLAUDE.md into three distinct layers:

1. **Mandatory Rules** - Enforceable requirements, numbered checklist
2. **Quick Reference** - Daily development lookup
3. **Project Context** - Understanding the system

## Design

### Section 1: Mandatory Rules

Purpose: Enforceable requirements that MUST be followed.

Structure:
```markdown
## Mandatory Rules

The following rules MUST be followed. Violation will cause implementation failure.

### 1.1 Workflow Requirements

Before ANY implementation work, complete these steps in order:

1. Brainstorming - Use `superpowers:brainstorming` to clarify requirements
2. Spec - Write design spec to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
3. Plan - Use `superpowers:writing-plans` to create implementation plan
4. Execute - Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`

**NEVER skip steps or start implementation without approved spec and plan.**

### 1.2 Documentation Sync

After code changes, update documentation synchronously:

1. Package README: `packages/<package>/README.md`
2. Root README: `<root>/README.md`

**Trigger conditions**: Architecture changes, new features/APIs, config format changes, CLI command changes

### 1.3 Language Policy

All documentation and code comments MUST be in English.

### 1.4 Package Management

Use `pnpm` exclusively. NEVER use `npm` or `yarn`.
```

Key decisions:
- Top section with warning header
- Numbered rules (1.1, 1.2, etc.) for easy reference
- MUST/NEVER keywords for emphasis
- Workflow steps numbered to enforce order

### Section 2: Quick Reference

Purpose: Fast lookup during development.

Structure:
```markdown
## Quick Reference

Reference information for daily development.

### Package Management

```bash
pnpm install                              # Install dependencies
pnpm add <pkg>                            # Add to workspace root
pnpm --filter <package> add <dep>         # Add to specific package
```

### Build Commands

```bash
pnpm --filter telegram-acp run build      # Compile TypeScript
pnpm --filter telegram-acp run dev        # Watch mode
```

### Package-specific Usage

See individual package READMEs:
- [telegram-acp](packages/telegram-acp/README.md) - CLI commands, agent presets, configuration
```

Key decisions:
- Only project-level commands, no package-specific details
- Link to package READMEs instead of duplicating
- Minimal explanations, just commands

### Section 3: Project Context

Purpose: Understanding the system architecture and constraints.

Structure:
```markdown
## Project Context

Understanding the project structure and key concepts.

### Overview

A pnpm monorepo containing `telegram-acp` - a bridge that connects Telegram direct messages to ACP-compatible AI agents via grammy Bot API.

### Architecture

```
packages/telegram-acp/src/
├── bin/telegram-acp.ts      # CLI entry point
├── bridge.ts                # Orchestration layer
├── telegram-api.ts          # Bot API wrapper
├── client.ts                # ACP client
├── config.ts                # Config loading & presets
├── health.ts                # Health monitoring
├── history.ts               # History injection
├── bot/
│   ├── index.ts             # grammy Bot setup
│   ├── middleware/          # Auth, session
│   ├── handlers/            # Commands, messages
│   └── formatters/          # Markdown, escape
├── session/
│   ├── index.ts             # SessionManager
│   ├── lifecycle.ts         # Session CRUD
│   ├── spawn.ts             # Agent spawn
│   ├── idle-manager.ts      # Timeout management
│   └── types.ts             # Type definitions
├── storage/
│   ├── index.ts             # Storage exports
│   ├── file-storage.ts      # File implementation
│   └── types.ts             # Storage types
└── streaming/
    ├── index.ts             # Streaming exports
    ├── state.ts             # Message coordination
    ├── message-stream.ts    # Single message state
    ├── rate-limiter.ts      # API rate limiting
    ├── formatting.ts        # Markdown/HTML conversion
    └── types.ts             # Streaming types
```

**Key flows:**

1. **Startup**: CLI → loadConfig → TelegramAcpBridge.start() → Bot + SessionManager
2. **Message**: middleware chain → messageHandler → ACP prompt → agent subprocess → reply
3. **Session**: One ACP session per Telegram user, spawned via stdio, auto-cleanup

### Session Persistence

Location: `~/.telegram-acp/sessions/{userId}/{sessionId}.json`

Contents:
- Session metadata (agent config, timestamps, status)
- Conversation history (user prompts + agent replies)
- Automatic restoration on service restart

**Telegram commands:**
- `/start` - Create or restore session
- `/status` - Show session details
- `/restart` - Terminate and create new session
- `/clear` - Clear conversation history

### Limitations

- Direct messages only (group chats ignored)
- Permission requests auto-approved
- MCP servers not used
- Requires Node.js 20+
```

Key decisions:
- Overview: single sentence
- Architecture: directory tree with minimal inline comments
- Key flows: numbered steps for clarity
- Limitations: explicit constraints list

## File Structure (After Refactor)

```
CLAUDE.md
├── Mandatory Rules (Section 1)
│   ├── 1.1 Workflow Requirements
│   ├── 1.2 Documentation Sync
│   ├── 1.3 Language Policy
│   └── 1.4 Package Management
├── Quick Reference (Section 2)
│   ├── Package Management
│   ├── Build Commands
│   └── Package-specific Usage (link only)
└── Project Context (Section 3)
    ├── Overview
    ├── Architecture
    ├── Session Persistence
    └── Limitations
```

## Out of Scope

- README.md refactoring (already updated)
- packages/*/README.md refactoring (already updated)
- Adding new rules or requirements

## Success Criteria

1. Mandatory rules are first section, numbered, cannot be missed
2. Quick reference is fast to scan (no scrolling through context)
3. Package-specific usage links to READMEs (no duplication)
4. Overall length reduced by ~30% from current version