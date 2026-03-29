# Session Restoration with History Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore most recent non-terminated session after service restart, injecting chat history into new ACP agent context on first user message.

**Architecture:** Rename `loadActive()` → `loadRestorable()` in storage, modify `restore()` to return history data, track pending injection in bot middleware, inject on first message.

**Tech Stack:** TypeScript, grammy Bot API, vitest for testing

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/storage.ts` | Rename `loadActive` → `loadRestorable`, query logic change |
| `src/session.ts` | Add `RestoredSession` interface, modify `restore()` return |
| `src/bot.ts` | Add `pendingHistoryInjection` map, `buildHistoryContext()` helper, modify session middleware + message handler + `/start` |
| `test/storage.test.ts` | Update existing test, add new tests for `loadRestorable` |

---

### Task 1: Rename loadActive to loadRestorable in Storage

**Files:**
- Modify: `packages/telegram-acp/src/storage.ts:77-97`
- Modify: `packages/telegram-acp/test/storage.test.ts:47-58`

- [ ] **Step 1: Write the failing test for loadRestorable**

Update the existing test file to test the new method name and behavior:

```typescript
// In test/storage.test.ts, replace the existing "should return active session from loadActive" test:

it('should return most recent non-terminated session from loadRestorable', async () => {
  const active = createTestSession('user123', 'active-session');
  const inactive = createTestSession('user123', 'inactive-session');
  inactive.status = 'inactive';
  inactive.lastActivity = Date.now() + 1000; // More recent

  const terminated = createTestSession('user123', 'terminated-session');
  terminated.status = 'terminated';
  terminated.lastActivity = Date.now() + 2000; // Most recent but terminated

  await storage.save(active);
  await storage.save(inactive);
  await storage.save(terminated);

  const loaded = await storage.loadRestorable('user123');
  expect(loaded).not.toBeNull();
  // Should return inactive (most recent non-terminated)
  expect(loaded?.sessionId).toBe('inactive-session');
});

it('should return null from loadRestorable when all sessions are terminated', async () => {
  const terminated = createTestSession('user123', 'terminated-session');
  terminated.status = 'terminated';
  await storage.save(terminated);

  const loaded = await storage.loadRestorable('user123');
  expect(loaded).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/telegram-acp && pnpm run test`
Expected: FAIL with "storage.loadRestorable is not a function"

- [ ] **Step 3: Rename the method in storage.ts**

```typescript
// In src/storage.ts, rename loadActive to loadRestorable and adjust query logic:

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

- [ ] **Step 4: Remove the old loadActive method**

Delete the entire `loadActive` method (lines 77-97) from storage.ts.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/telegram-acp && pnpm run test`
Expected: PASS for all storage tests

- [ ] **Step 6: Commit**

```bash
cd packages/telegram-acp
git add src/storage.ts test/storage.test.ts
git commit -m "feat(storage): rename loadActive to loadRestorable, query non-terminated sessions"
```

---

### Task 2: Add RestoredSession Interface and Modify restore() in Session Manager

**Files:**
- Modify: `packages/telegram-acp/src/session.ts:226-269`

- [ ] **Step 1: Add RestoredSession interface**

Add after the `UserSession` interface (around line 20):

```typescript
// In src/session.ts, after UserSession interface:

export interface RestoredSession {
  session: UserSession;
  hadHistory: boolean;
  messages: StoredMessage[];
}
```

- [ ] **Step 2: Update restore() method signature and return**

Modify the existing `restore()` method to return `RestoredSession`:

```typescript
// In src/session.ts, replace the restore() method (lines 226-269):

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

- [ ] **Step 3: Update getOrCreate() to use loadRestorable**

In `getOrCreate()` method (lines 55-76), change `loadActive` to `loadRestorable`:

```typescript
// In src/session.ts, line 64:
// Change: const stored = await this.storage.loadActive(userId);
// To:
const stored = await this.storage.loadRestorable(userId);
```

- [ ] **Step 4: Build to verify TypeScript compiles**

Run: `cd packages/telegram-acp && pnpm run build`
Expected: No TypeScript errors

- [ ] **Step 5: Commit**

```bash
cd packages/telegram-acp
git add src/session.ts
git commit -m "feat(session): add RestoredSession interface, restore() returns history data"
```

---

### Task 3: Add History Injection Infrastructure in Bot

**Files:**
- Modify: `packages/telegram-acp/src/bot.ts`

- [ ] **Step 1: Add pendingHistoryInjection map and StoredMessage import**

Add at the top of bot.ts, after imports:

```typescript
// In src/bot.ts, after existing imports (around line 8):
import { SessionStorage, type StoredSession, type StoredMessage } from "./storage.ts";

// Add after imports section (around line 11):
// Map userId -> messages to inject on first user message after restoration
const pendingHistoryInjection = new Map<string, StoredMessage[]>();
```

- [ ] **Step 2: Add buildHistoryContext helper function**

Add the helper function after the imports and before `createBot`:

```typescript
// In src/bot.ts, after pendingHistoryInjection map:

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

- [ ] **Step 3: Build to verify TypeScript compiles**

Run: `cd packages/telegram-acp && pnpm run build`
Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
cd packages/telegram-acp
git add src/bot.ts
git commit -m "feat(bot): add pendingHistoryInjection map and buildHistoryContext helper"
```

---

### Task 4: Modify Session Middleware to Track History

**Files:**
- Modify: `packages/telegram-acp/src/bot.ts:149-163`

- [ ] **Step 1: Update sessionMiddleware to check and track history**

Replace the existing `sessionMiddleware` function:

```typescript
// In src/bot.ts, replace sessionMiddleware (lines 149-163):

function sessionMiddleware(sessionManager: SessionManager) {
  return async (ctx: Context, next: () => Promise<void>) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    // Check if history injection already pending (from /start)
    if (!pendingHistoryInjection.has(userId)) {
      const stored = await sessionManager.getStorage().loadRestorable(userId);
      if (stored && stored.messages.length > 0) {
        // Track history for injection on first message
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

- [ ] **Step 2: Build to verify TypeScript compiles**

Run: `cd packages/telegram-acp && pnpm run build`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
cd packages/telegram-acp
git add src/bot.ts
git commit -m "feat(bot): session middleware tracks history for injection"
```

---

### Task 5: Modify Message Handler for History Injection

**Files:**
- Modify: `packages/telegram-acp/src/bot.ts:166-235`

- [ ] **Step 1: Update messageHandler to inject history**

Modify the existing `messageHandler` function to inject history on first message:

```typescript
// In src/bot.ts, modify messageHandler (around line 180-185):

// After "const prompt = extractPrompt(ctx);" line, add:

// Inject history on first message after restoration
const historyToInject = pendingHistoryInjection.get(userId);
if (historyToInject && historyToInject.length > 0) {
  pendingHistoryInjection.delete(userId); // One-time injection
  const historyPrefix = buildHistoryContext(historyToInject);
  prompt = historyPrefix + "\n\n[Current message]:\n" + prompt;
}
```

The full modified section should look like:

```typescript
async function messageHandler(ctx: Context) {
  const acpCtx = ctx as AcpContext;
  const userId = ctx.from?.id.toString();
  const chatId = ctx.chat?.id;

  if (!userId || !chatId) return;

  // 1. Immediate feedback on receipt
  try {
    await ctx.react("👀");
  } catch {
    // Best-effort - don't block if fails
  }

  // 2. Extract message content
  let prompt = extractPrompt(ctx);
  const isMedia = isMediaMessage(ctx);

  // Inject history on first message after restoration
  const historyToInject = pendingHistoryInjection.get(userId);
  if (historyToInject && historyToInject.length > 0) {
    pendingHistoryInjection.delete(userId); // One-time injection
    const historyPrefix = buildHistoryContext(historyToInject);
    prompt = historyPrefix + "\n\n[Current message]:\n" + prompt;
  }

  // Record user message
  await acpCtx.sessionManager.recordMessage(userId, 'user', prompt);

  // ... rest of handler unchanged ...
}
```

- [ ] **Step 2: Build to verify TypeScript compiles**

Run: `cd packages/telegram-acp && pnpm run build`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
cd packages/telegram-acp
git add src/bot.ts
git commit -m "feat(bot): message handler injects history on first message after restore"
```

---

### Task 6: Update /start Command Handler

**Files:**
- Modify: `packages/telegram-acp/src/bot.ts:54-71`

- [ ] **Step 1: Update /start command to use loadRestorable and track history**

Replace the existing `/start` command handler:

```typescript
// In src/bot.ts, replace the /start handler (lines 54-71):

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

- [ ] **Step 2: Build to verify TypeScript compiles**

Run: `cd packages/telegram-acp && pnpm run build`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
cd packages/telegram-acp
git add src/bot.ts
git commit -m "feat(bot): /start command uses loadRestorable with history tracking"
```

---

### Task 7: Update /status Command to Use loadRestorable

**Files:**
- Modify: `packages/telegram-acp/src/bot.ts:73-95`

- [ ] **Step 1: Update /status command to use loadRestorable**

Change `loadActive` to `loadRestorable` in the /status handler:

```typescript
// In src/bot.ts, line 78:
// Change: const stored = await acpCtx.sessionManager.getStorage().loadActive(userId);
// To:
const stored = await acpCtx.sessionManager.getStorage().loadRestorable(userId);
```

- [ ] **Step 2: Build and run tests**

Run: `cd packages/telegram-acp && pnpm run build && pnpm run test`
Expected: Build succeeds, all tests pass

- [ ] **Step 3: Commit**

```bash
cd packages/telegram-acp
git add src/bot.ts
git commit -m "feat(bot): /status command uses loadRestorable"
```

---

### Task 8: Final Integration Verification

**Files:**
- All modified files

- [ ] **Step 1: Run all tests**

Run: `cd packages/telegram-acp && pnpm run test`
Expected: All tests pass

- [ ] **Step 2: Build final**

Run: `cd packages/telegram-acp && pnpm run build`
Expected: Clean build with no errors

- [ ] **Step 3: Manual smoke test (optional)**

If you have a Telegram bot token configured:
1. Start the bot: `pnpm run start -- --preset claude`
2. Send `/start` to create a session
3. Send a message to create some history
4. Stop the bot (Ctrl+C)
5. Restart the bot
6. Send `/start` - should restore session with history count
7. Send a message - agent should respond with context awareness

- [ ] **Step 4: Final commit (if needed)**

```bash
git status
# If any uncommitted changes remain:
git add -A
git commit -m "chore: finalize session restoration implementation"
```

---

## Summary

This plan implements session restoration with history context injection through:

1. **Storage layer**: `loadRestorable()` returns most recent non-terminated session
2. **Session layer**: `restore()` returns history data for injection
3. **Bot layer**: Middleware tracks pending injection, message handler injects on first use, `/start` provides user feedback

Total: 8 tasks, ~20 steps, TDD approach with frequent commits.