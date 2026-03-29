# Session Persistence Design

## Goal

Implement session persistence for telegram-acp so that:
1. Sessions survive service restarts/crashes
2. Conversation history is preserved
3. Users can manage sessions via commands

## Current State

- Sessions stored in-memory `Map<string, UserSession>`
- Agent processes spawned via stdio, state lost on exit
- No conversation history storage
- `/start` - simple welcome message
- `/status` - returns "Running."
- No `/restart` or `/clear` commands

## Requirements

1. Persist session metadata to `~/.telegram-acp/sessions/`
2. Record conversation history (user prompts + agent replies)
3. `/start` restores persisted session if exists
4. `/status` shows detailed session info
5. `/restart` destroys and recreates session
6. `/clear` clears conversation history
7. Configurable history limits (maxMessages, maxDays)

---

## Data Structures

### StoredSession

Path: `~/.telegram-acp/sessions/{userId}/{sessionId}.json`

```typescript
interface StoredSession {
  userId: string;
  sessionId: string;
  agentConfig: {
    preset?: string;
    command: string;
    args: string[];
    cwd: string;
  };
  createdAt: number;      // Unix timestamp (ms)
  lastActivity: number;   // Unix timestamp (ms)
  status: 'active' | 'inactive' | 'terminated';
  messages: StoredMessage[];
}

interface StoredMessage {
  role: 'user' | 'agent';
  content: string;
  timestamp: number;  // Unix timestamp (ms)
}
```

### Config Extension

```yaml
history:
  maxMessages: null    # null = unlimited, or number like 100
  maxDays: null        # null = unlimited, or number like 7
```

---

## Module Changes

### 1. New: `storage.ts`

File I/O service for session persistence.

```typescript
class SessionStorage {
  private baseDir: string;  // ~/.telegram-acp/sessions

  // Core methods
  save(session: StoredSession): Promise<void>;
  load(userId: string, sessionId: string): Promise<StoredSession | null>;
  loadActive(userId: string): Promise<StoredSession | null>;
  list(userId: string): Promise<StoredSession[]>;
  delete(userId: string, sessionId: string): Promise<void>;
  clearHistory(userId: string, sessionId: string): Promise<void>;
  updateStatus(userId: string, sessionId: string, status: SessionStatus): Promise<void>;
  markTerminated(userId: string, sessionId: string): Promise<void>;

  // Internal
  private getFilePath(userId: string, sessionId: string): string;
  private ensureDir(userId: string): Promise<void>;
}
```

**Responsibilities**:
- Read/write JSON files
- Manage directory structure
- Handle file not found / parse errors gracefully

---

### 2. Modified: `session.ts`

#### New Dependencies

```typescript
class SessionManager {
  private storage: SessionStorage;
  private pendingReplies: Map<string, string[]>;  // Buffer for streaming replies

  constructor(opts: SessionManagerOpts) {
    this.storage = new SessionStorage(defaultStorageDir());
    this.pendingReplies = new Map();
  }
}
```

#### New Methods

```typescript
// Restore persisted session
async restore(userId: string, stored: StoredSession): Promise<UserSession>;

// Record message to history
async recordMessage(userId: string, role: 'user' | 'agent', content: string): Promise<void>;

// Destroy and recreate session
async restart(userId: string): Promise<UserSession>;

// Clear conversation history
async clearHistory(userId: string): Promise<void>;

// Buffer streaming replies
bufferReply(userId: string, text: string): void;

// Flush buffered replies and record
async flushAndRecord(userId: string): Promise<void>;
```

#### Modified Methods

```typescript
// getOrCreate: try restore first
async getOrCreate(userId: string): Promise<UserSession> {
  const existing = this.sessions.get(userId);
  if (existing) {
    existing.lastActivity = Date.now();
    this.resetIdleTimer(userId);
    return existing;
  }

  // NEW: Try load persisted session
  const stored = await this.storage.loadActive(userId);
  if (stored) {
    return this.restore(userId, stored);
  }

  return this.create(userId);
}

// create: save to storage
private async create(userId: string): Promise<UserSession> {
  // ...spawn agent...

  // NEW: Persist session
  const stored: StoredSession = {
    userId,
    sessionId,
    agentConfig: { preset, command, args, cwd },
    createdAt: Date.now(),
    lastActivity: Date.now(),
    status: 'active',
    messages: [],
  };
  await this.storage.save(stored);

  // ...rest of create logic...
}

// stop: mark sessions inactive
async stop(): Promise<void> {
  // NEW: Mark all active sessions as inactive
  for (const [userId, session] of this.sessions) {
    await this.storage.updateStatus(userId, session.sessionId, 'inactive');
  }

  // ...existing cleanup logic...
}
```

---

### 3. Modified: `bot.ts`

#### `/start` Command

```typescript
bot.command("start", async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId) return;

  const session = await sessionManager.getOrCreate(userId);
  const stored = await sessionManager.storage.loadActive(userId);

  if (stored) {
    await ctx.reply(
      `Session restored.\nSession ID: ${stored.sessionId}\nMessages: ${stored.messages.length}`
    );
  } else {
    await ctx.reply(
      `New session created.\nSession ID: ${session.sessionId}`
    );
  }
});
```

#### `/status` Command

```typescript
bot.command("status", async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId) return;

  const stored = await sessionManager.storage.loadActive(userId);

  if (!stored) {
    await ctx.reply("No active session.");
    return;
  }

  await ctx.reply(
    `Session ID: ${stored.sessionId}\n` +
    `Created: ${formatDate(stored.createdAt)}\n` +
    `Last Activity: ${formatDate(stored.lastActivity)}\n` +
    `Messages: ${stored.messages.length}\n` +
    `Agent: ${stored.agentConfig.preset ?? stored.agentConfig.command}\n` +
    `Status: ${stored.status}`
  );
});
```

#### `/restart` Command (New)

```typescript
bot.command("restart", async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId) return;

  await ctx.reply("Restarting session...");
  const session = await sessionManager.restart(userId);
  await ctx.reply(`New session created.\nSession ID: ${session.sessionId}`);
});
```

#### `/clear` Command (New)

```typescript
bot.command("clear", async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId) return;

  await sessionManager.clearHistory(userId);
  await ctx.reply("History cleared.");
});
```

---

### 4. Modified: `bridge.ts`

#### Startup Restoration

```typescript
async start(): Promise<void> {
  this.log("[telegram-acp] Starting...");

  this.sessionManager = new SessionManager({...});

  // NEW: Restore persisted sessions
  await this.restorePersistedSessions();

  this.bot = createBot(...);
  await startBot(this.bot);

  this.log("[telegram-acp] Started");
}

private async restorePersistedSessions(): Promise<void> {
  const sessionsDir = path.join(defaultStorageDir(), 'sessions');
  if (!fs.existsSync(sessionsDir)) return;

  const userDirs = fs.readdirSync(sessionsDir);
  for (const userId of userDirs) {
    const stored = await this.sessionManager.storage.loadActive(userId);
    if (stored && stored.status === 'active') {
      this.log(`[restore] Restoring session for ${userId}`);
      await this.sessionManager.restore(userId, stored);
    }
  }
}
```

#### Shutdown Marking

```typescript
async stop(): Promise<void> {
  this.log("[telegram-acp] Stopping...");

  // Mark sessions before stopping (already in sessionManager.stop)
  if (this.sessionManager) {
    await this.sessionManager.stop();
  }

  if (this.bot) {
    await stopBot(this.bot);
  }

  this.log("[telegram-acp] Stopped");
}
```

---

### 5. Modified: Message Recording

In `messageHandler`:

```typescript
async function messageHandler(ctx: Context) {
  // ...extract prompt...

  // NEW: Record user message before sending
  await sessionManager.recordMessage(userId, 'user', prompt);

  // ...send prompt to agent...

  const replyText = await session.client.flush();

  // NEW: Record agent reply
  await sessionManager.recordMessage(userId, 'agent', replyText);

  // ...send reply to user...
}
```

For streaming replies (in `bridge.ts` onReply callback):

```typescript
onReply: async (userId: string, text: string) => {
  // Buffer streaming text
  sessionManager.bufferReply(userId, text);

  // Send to user immediately
  if (bot) {
    await bot.api.sendMessage(userId, text);
  }
}
```

---

## File Structure

```
~/.telegram-acp/
  config.yaml           # Existing
  sessions/             # New
    {userId}/
      {sessionId}.json  # StoredSession
```

---

## Edge Cases

### History Limits

When `maxMessages` or `maxDays` configured:
- On `recordMessage`: trim messages exceeding limit before save
- oldest messages removed first

### Concurrent Access

- File writes use atomic write (write to temp, then rename)
- No locking needed: single process, single thread per user

### Corrupted Files

- On parse error: log warning, return null, create new session
- Don't block service startup

### Agent Exit During Restore

- If agent spawn fails during restore: mark session as 'terminated', create new session

---

## Implementation Order

1. Create `storage.ts` with core file I/O
2. Modify `config.ts` to add history config
3. Modify `session.ts` to integrate storage
4. Modify `bot.ts` to update commands
5. Modify `bridge.ts` for startup/shutdown
6. Modify `messageHandler` for recording
7. Add tests for storage operations