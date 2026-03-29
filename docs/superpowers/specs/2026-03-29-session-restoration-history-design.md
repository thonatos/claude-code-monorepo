---
title: Session Restoration with History Context
created: 2026-03-29
status: approved
---

# Session Restoration with History Context

## Problem

When telegram-acp restarts, all sessions are marked `inactive`. On `/start`, users get a **new session** instead of restoring their previous conversation, losing all context.

## Goal

Restore the most recent non-terminated session with:
1. Chat history preserved in storage
2. Fresh ACP process (true restoration impossible with CLI agents)
3. History injected into agent context on first user message
4. Seamless user experience - continuation feels natural

## Design

### 1. Storage Layer: `loadRestorable()`

Rename `loadActive()` → `loadRestorable()` in `storage.ts`:

```typescript
async loadRestorable(userId: string): Promise<StoredSession | null> {
  const userDir = this.getUserDir(userId);
  try {
    const files = await fs.readdir(userDir);
    const candidates: StoredSession[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const sessionId = file.replace('.json', '');
      const session = await this.load(userId, sessionId);
      if (session && session.status !== 'terminated') {
        candidates.push(session);
      }
    }

    if (candidates.length === 0) return null;

    // Return most recent by lastActivity
    return candidates.sort((a, b) => b.lastActivity - a.lastActivity)[0];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    console.error(`[storage] Failed to list sessions for ${userId}: ${String(err)}`);
    return null;
  }
}
```

**Restoration criteria:** Any session where `status !== 'terminated'` (includes both `active` and `inactive`).

### 2. Session Restoration: Return History

Modify `restore()` in `session.ts` to return history data:

```typescript
interface RestoredSession {
  session: UserSession;
  hadHistory: boolean;
  messages: StoredMessage[];
}

async restore(userId: string, stored: StoredSession): Promise<RestoredSession> {
  this.opts.log(`[session] Restoring for ${userId} (sessionId: ${stored.sessionId})`);

  const client = new TelegramAcpClient({
    sendTyping: () => this.opts.sendTyping(userId),
    onThoughtFlush: async (text: string) => {
      this.bufferReply(userId, text);
      await this.opts.onReply(userId, text);
    },
    log: (msg: string) => this.opts.log(`[${userId}] ${msg}`),
    showThoughts: this.opts.showThoughts,
  });

  const { process, connection, sessionId } = await this.spawnAgent(userId, client);

  // Update stored session with new sessionId
  stored.sessionId = sessionId;
  stored.lastActivity = Date.now();
  stored.status = 'active';
  await this.storage.save(stored);

  const session: UserSession = {
    userId,
    client,
    connection,
    sessionId,
    process,
    lastActivity: Date.now(),
  };

  process.on('exit', (code, signal) => {
    this.opts.log(`[agent] ${userId} exited code=${code ?? '?'} signal=${signal ?? '?'}`);
    const s = this.sessions.get(userId);
    if (s && s.process === process) {
      this.sessions.delete(userId);
      this.timers.delete(userId);
    }
  });

  this.sessions.set(userId, session);
  this.resetIdleTimer(userId);

  return {
    session,
    hadHistory: stored.messages.length > 0,
    messages: stored.messages,
  };
}
```

### 3. History Injection: First Message Enhancement

Track pending history injection in `bot.ts`:

```typescript
// Map userId -> messages to inject on first user message
const pendingHistoryInjection = new Map<string, StoredMessage[]>();

function buildHistoryContext(messages: StoredMessage[]): string {
  const lines = ["[Previous conversation context]:"];
  for (const msg of messages) {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    // Truncate very long messages to prevent context explosion
    const content = msg.content.length > 2000
      ? msg.content.slice(0, 2000) + '...'
      : msg.content;
    lines.push(`${role}: ${content}`);
  }
  return lines.join('\n');
}
```

Modified message handler:

```typescript
async function messageHandler(ctx: Context) {
  const acpCtx = ctx as AcpContext;
  const userId = ctx.from?.id.toString();
  const chatId = ctx.chat?.id;

  if (!userId || !chatId) return;

  // ... reaction feedback ...

  let prompt = extractPrompt(ctx);

  // Inject history on first message after restoration
  const historyToInject = pendingHistoryInjection.get(userId);
  if (historyToInject && historyToInject.length > 0) {
    pendingHistoryInjection.delete(userId);
    const historyPrefix = buildHistoryContext(historyToInject);
    prompt = historyPrefix + "\n\n[Current message]:\n" + prompt;
  }

  // ... rest of handler unchanged ...
}
```

### 4. `/start` Command Update

```typescript
bot.command("start", async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId) return;

  const acpCtx = ctx as AcpContext;
  const stored = await acpCtx.sessionManager.getStorage().loadRestorable(userId);

  if (stored) {
    const restored = await acpCtx.sessionManager.restore(userId, stored);
    acpCtx.session = restored.session;

    if (restored.hadHistory) {
      pendingHistoryInjection.set(userId, restored.messages);
    }

    const msg = restored.hadHistory
      ? `Session restored with ${restored.messages.length} previous messages.\nSession ID: ${stored.sessionId}`
      : `Session restored (empty history).\nSession ID: ${stored.sessionId}`;

    await ctx.reply(msg);
  } else {
    const session = await acpCtx.sessionManager.getOrCreate(userId);
    await ctx.reply(`New session created.\nSession ID: ${session.sessionId}`);
  }
});
```

### 5. Session Middleware Update

When user sends message without `/start` first, session middleware silently restores:

```typescript
function sessionMiddleware(sessionManager: SessionManager) {
  return async (ctx: Context, next: () => Promise<void>) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    // Check if already in pendingHistoryInjection (already restored)
    if (!pendingHistoryInjection.has(userId)) {
      const stored = await sessionManager.getStorage().loadRestorable(userId);
      if (stored && stored.messages.length > 0) {
        // Will restore on getOrCreate, but we need to track history
        pendingHistoryInjection.set(userId, stored.messages);
      }
    }

    const session = await sessionManager.getOrCreate(userId);
    const acpCtx = ctx as AcpContext;
    acpCtx.session = session;
    acpCtx.sessionManager = sessionManager;

    await next();
  };
}
```

### 6. History Size Limits

Each message truncated to 2000 chars in `buildHistoryContext()` prevents context explosion. Combined with existing `historyConfig.maxMessages` and `maxDays` limits:

- Default: unlimited messages/days, but each capped at 2000 chars
- Configurable: user can set `maxMessages: 50` to keep only last 50 exchanges

## Implementation Notes

- `pendingHistoryInjection` map lives in bot.ts module scope, cleared after first use
- Two restoration paths:
  1. **`/start` command**: Explicit restoration with user feedback, tracks history injection
  2. **Session middleware (`getOrCreate`)**: Silent restoration on first message, also needs to track history injection
- Both paths must set `pendingHistoryInjection.set(userId, messages)` when restoring with history
- No changes needed to `stop()` - marking sessions `inactive` is correct behavior
- `getOrCreate()` in session.ts calls `loadActive()` which becomes `loadRestorable()`
- Backward compatible: existing sessions with `inactive` status will be restored on next `/start` or first message

## Testing Scenarios

1. **Service restart → /start**: Restores most recent inactive session with history
2. **User /restart → /start**: Creates new session (terminated not restored)
3. **First message after restoration**: History injected into agent context
4. **Second message**: No history injection (already consumed)
5. **Empty history restoration**: No injection, fresh session feel