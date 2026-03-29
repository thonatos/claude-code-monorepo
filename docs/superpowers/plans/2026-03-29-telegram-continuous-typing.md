# telegram-acp Continuous Typing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add event-driven typing indicator that persists during ACP processing.

**Architecture:** Add `sendTyping` callback to client, trigger on each sessionUpdate with 5s throttle. Matches wechat-acp pattern.

**Tech Stack:** grammy Telegram Bot API, TypeScript, ACP SDK

---

## File Structure

**Modify:**
- `packages/telegram-acp/src/client.ts` - Add sendTyping callback + maybeSendTyping throttle
- `packages/telegram-acp/src/session.ts` - Add sendTyping to opts, pass to client
- `packages/telegram-acp/src/bridge.ts` - Add sendTyping callback to SessionManager
- `packages/telegram-acp/src/bot.ts` - Pass sendTyping through middleware, track chatId per user

---

### Task 1: Add sendTyping to TelegramAcpClient

**Files:**
- Modify: `packages/telegram-acp/src/client.ts`

- [ ] **Step 1: Add sendTyping to interface and class**

Update `TelegramAcpClientOpts` interface (line 8-12):

```typescript
export interface TelegramAcpClientOpts {
  sendTyping: () => Promise<void>;
  onThoughtFlush: (text: string) => Promise<void>;
  log: (msg: string) => void;
  showThoughts: boolean;
}
```

Add throttle fields and maybeSendTyping method to class (after line 22):

```typescript
export class TelegramAcpClient implements acp.Client {
  private chunks: string[] = [];
  private thoughtChunks: string[] = [];
  private opts: TelegramAcpClientOpts;
  private lastTypingAt = 0;
  private static readonly TYPING_INTERVAL_MS = 5_000;

  constructor(opts: TelegramAcpClientOpts) {
    this.opts = opts;
  }

  updateCallbacks(callbacks: { sendTyping: () => Promise<void>; onThoughtFlush: (text: string) => Promise<void> }): void {
    this.opts = {
      ...this.opts,
      sendTyping: callbacks.sendTyping,
      onThoughtFlush: callbacks.onThoughtFlush,
    };
  }
```

- [ ] **Step 2: Add maybeSendTyping calls in sessionUpdate**

In `sessionUpdate` method, add `await this.maybeSendTyping();` after each case that indicates activity:

```typescript
case "agent_message_chunk":
  await this.maybeFlushThoughts();
  if (update.content.type === "text") {
    this.chunks.push(update.content.text);
  }
  await this.maybeSendTyping();
  break;

case "tool_call":
  await this.maybeFlushThoughts();
  this.opts.log(`[tool] ${update.title} (${update.status})`);
  await this.maybeSendTyping();
  break;

case "agent_thought_chunk":
  if (update.content.type === "text") {
    const text = update.content.text;
    this.opts.log(`[thought] ${text.length > 80 ? text.substring(0, 80) + "..." : text}`);
    if (this.opts.showThoughts) {
      this.thoughtChunks.push(text);
    }
  }
  await this.maybeSendTyping();
  break;
```

- [ ] **Step 3: Add maybeSendTyping method**

Add method at the end of class (before closing brace):

```typescript
private async maybeSendTyping(): Promise<void> {
  const now = Date.now();
  if (now - this.lastTypingAt < TelegramAcpClient.TYPING_INTERVAL_MS) return;
  this.lastTypingAt = now;
  try {
    await this.opts.sendTyping();
  } catch {
    // typing is best-effort
  }
}
```

- [ ] **Step 4: Build to verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add packages/telegram-acp/src/client.ts
git commit -m "feat(telegram-acp): add sendTyping callback with throttle to client"
```

---

### Task 2: Add sendTyping to SessionManager

**Files:**
- Modify: `packages/telegram-acp/src/session.ts`

- [ ] **Step 1: Add sendTyping to SessionManagerOpts**

Update interface (line 22-29):

```typescript
export interface SessionManagerOpts {
  agentCommand: string;
  agentArgs: string[];
  agentCwd: string;
  agentEnv?: Record<string, string>;
  sessionConfig: SessionConfig;
  showThoughts: boolean;
  log: (msg: string) => void;
  onReply: (userId: string, text: string) => Promise<void>;
  sendTyping: (userId: string) => Promise<void>;
}
```

- [ ] **Step 2: Pass sendTyping to client in create method**

Update the client creation in `create` method (around line 78):

```typescript
const client = new TelegramAcpClient({
  sendTyping: () => this.opts.sendTyping(userId),
  onThoughtFlush: (text) => this.opts.onReply(userId, text),
  log: (msg) => this.opts.log(`[${userId}] ${msg}`),
  showThoughts: this.opts.showThoughts,
});
```

- [ ] **Step 3: Build to verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add packages/telegram-acp/src/session.ts
git commit -m "feat(telegram-acp): add sendTyping callback to SessionManager"
```

---

### Task 3: Add sendTyping to bridge and bot

**Files:**
- Modify: `packages/telegram-acp/src/bridge.ts`
- Modify: `packages/telegram-acp/src/bot.ts`

- [ ] **Step 1: Add typing tracking in bot.ts**

Add a Map to track chatId per user in bot.ts (after imports, before createBot):

```typescript
// Track chat IDs for typing indicators
const userChatIds = new Map<string, number>();

export function getUserChatId(userId: string): number | undefined {
  return userChatIds.get(userId);
}

export function setUserChatId(userId: string, chatId: number): void {
  userChatIds.set(userId, chatId);
}
```

- [ ] **Step 2: Store chatId in session middleware**

Update sessionMiddleware in bot.ts:

```typescript
function sessionMiddleware(sessionManager: SessionManager) {
  return async (ctx: Context, next: () => Promise<void>) => {
    const userId = ctx.from?.id.toString();
    const chatId = ctx.chat?.id;
    if (!userId || !chatId) return;

    setUserChatId(userId, chatId);

    const session = await sessionManager.getOrCreate(userId);

    const acpCtx = ctx as AcpContext;
    acpCtx.session = session;
    acpCtx.sessionManager = sessionManager;

    await next();
  };
}
```

- [ ] **Step 3: Add sendTyping to bridge.ts**

Update SessionManager creation in bridge.ts:

```typescript
this.sessionManager = new SessionManager({
  agentCommand: this.config.agent.command,
  agentArgs: this.config.agent.args,
  agentCwd: this.config.agent.cwd,
  agentEnv: this.config.agent.env,
  sessionConfig: this.config.session,
  showThoughts: this.config.agent.showThoughts,
  log: this.log,
  onReply: async (userId: string, text: string) => {
    if (this.bot) {
      await this.bot.api.sendMessage(userId, text);
    }
  },
  sendTyping: async (userId: string) => {
    if (this.bot) {
      const chatId = getUserChatId(userId);
      if (chatId) {
        await this.bot.api.sendChatAction(chatId, 'typing');
      }
    }
  },
});
```

Add import for getUserChatId:

```typescript
import { createBot, startBot, stopBot, type Bot, getUserChatId } from "./bot.js";
```

- [ ] **Step 4: Build to verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add packages/telegram-acp/src/bot.ts packages/telegram-acp/src/bridge.ts
git commit -m "feat(telegram-acp): connect typing callback through bridge and bot

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Remove one-time typing from messageHandler

**Files:**
- Modify: `packages/telegram-acp/src/bot.ts`

- [ ] **Step 1: Remove ctx.api.sendChatAction from messageHandler**

The initial typing in messageHandler (line 109) is now redundant since client will trigger typing. Remove it:

```typescript
// 1. Immediate feedback on receipt
try {
  await ctx.react('👀');
  // typing is now handled by client's sendTyping callback
} catch {
  // Best-effort - don't block if fails
}
```

Or just remove the whole sendChatAction line:

```typescript
// 1. Immediate feedback on receipt
try {
  await ctx.react('👀');
} catch {
  // Best-effort - don't block if fails
}
```

- [ ] **Step 2: Build to verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add packages/telegram-acp/src/bot.ts
git commit -m "refactor(telegram-acp): remove redundant typing from messageHandler

Typing is now handled by client callback triggered on session updates."
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] sendTyping callback added to client (Task 1)
- [x] Throttle logic (5s interval) (Task 1)
- [x] maybeSendTyping called on sessionUpdate events (Task 1)
- [x] sendTyping passed through session (Task 2)
- [x] sendTyping connected in bridge (Task 3)
- [x] chatId tracking for typing API (Task 3)

**Placeholder scan:**
- [x] No TBD/TODO
- [x] All code shown inline
- [x] All commands specified

**Type consistency:**
- [x] `sendTyping: () => Promise<void>` in client opts
- [x] `sendTyping: (userId: string) => Promise<void>` in session opts
- [x] `getUserChatId(userId: string): number | undefined`
- [x] `setUserChatId(userId: string, chatId: number): void`