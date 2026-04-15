# Telegram Agent Session Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add session persistence with message history to telegram-agent for state recovery after restart.

**Architecture:** File-based JSON storage in ~/.telegram-agent/sessions/, integrated via SessionService in module-bridge.

**Tech Stack:** TypeScript, Node.js fs/promises, ArtusX Injectable services

---

### Task 1: Add Storage Types to types.ts

**Files:**
- Modify: `packages/telegram-agent/src/types.ts`

- [ ] **Step 1: Add storage types at end of file**

```typescript
// Storage types
export type SessionStatus = 'active' | 'inactive' | 'terminated';

export interface StoredMessage {
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
}

export interface StoredSession {
  userId: string;
  sessionId: string;
  createdAt: number;
  lastActivity: number;
  status: SessionStatus;
  messages: StoredMessage[];
}
```

- [ ] **Step 2: Verify file updated**

Run: `tail -20 packages/telegram-agent/src/types.ts`
Expected: Shows new SessionStatus, StoredMessage, StoredSession types

- [ ] **Step 3: Commit**

```bash
git add packages/telegram-agent/src/types.ts
git commit -m "feat(telegram-agent): add storage types for session persistence"
```

---

### Task 2: Add History Config to Constants

**Files:**
- Modify: `packages/telegram-agent/src/constants/index.ts`

- [ ] **Step 1: Add defaultSessionsDir function after defaultMediaDir**

```typescript
/**
 * Default sessions directory
 */
export function defaultSessionsDir(): string {
  return path.join(defaultStorageDir(), "sessions");
}
```

- [ ] **Step 2: Add DEFAULT_HISTORY_CONFIG constant after DEFAULT_SESSION_CONFIG**

```typescript
/**
 * Default history config
 */
export const DEFAULT_HISTORY_CONFIG = {
  maxMessages: 100,
  maxDays: 7,
};
```

- [ ] **Step 3: Verify file updated**

Run: `grep -A5 "defaultSessionsDir" packages/telegram-agent/src/constants/index.ts`
Expected: Shows new function

- [ ] **Step 4: Commit**

```bash
git add packages/telegram-agent/src/constants/index.ts
git commit -m "feat(telegram-agent): add defaultSessionsDir and DEFAULT_HISTORY_CONFIG"
```

---

### Task 3: Create SessionService

**Files:**
- Create: `packages/telegram-agent/src/module-bridge/session.service.ts`

- [ ] **Step 1: Create the SessionService file**

```typescript
import fs from "node:fs/promises";
import path from "node:path";
import { Injectable, Inject, ArtusInjectEnum } from "@artusx/core";
import type { ArtusApplication } from "@artusx/core";
import { defaultSessionsDir, DEFAULT_HISTORY_CONFIG } from "../constants";
import type { StoredSession, StoredMessage, SessionStatus } from "../types";

@Injectable()
export class SessionService {
  @Inject(ArtusInjectEnum.Application)
  private app!: ArtusApplication;

  private sessionsDir: string;
  private historyConfig: typeof DEFAULT_HISTORY_CONFIG;

  constructor() {
    this.sessionsDir = defaultSessionsDir();
    this.historyConfig = DEFAULT_HISTORY_CONFIG;
  }

  private get logger() {
    return this.app.logger;
  }

  private getUserDir(userId: string): string {
    return path.join(this.sessionsDir, userId);
  }

  private getFilePath(userId: string, sessionId: string): string {
    return path.join(this.getUserDir(userId), `${sessionId}.json`);
  }

  private async ensureUserDir(userId: string): Promise<void> {
    const userDir = this.getUserDir(userId);
    await fs.mkdir(userDir, { recursive: true });
  }

  /**
   * Save session to file (atomic write)
   */
  async save(session: StoredSession): Promise<void> {
    await this.ensureUserDir(session.userId);
    const filePath = this.getFilePath(session.userId, session.sessionId);
    const tempPath = filePath + ".tmp";
    await fs.writeFile(tempPath, JSON.stringify(session, null, 2), "utf-8");
    await fs.rename(tempPath, filePath);
    this.logger.info(`[session] Saved session ${session.sessionId} for user ${session.userId}`);
  }

  /**
   * Load specific session
   */
  async load(userId: string, sessionId: string): Promise<StoredSession | null> {
    const filePath = this.getFilePath(userId, sessionId);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content) as StoredSession;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      this.logger.error(`[session] Failed to load ${filePath}: ${String(err)}`);
      return null;
    }
  }

  /**
   * Find most recent restorable session
   */
  async loadRestorable(userId: string): Promise<StoredSession | null> {
    const userDir = this.getUserDir(userId);
    try {
      const files = await fs.readdir(userDir);
      const candidates: StoredSession[] = [];

      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const sessionId = file.replace(".json", "");
        const session = await this.load(userId, sessionId);
        if (session && session.status !== "terminated") {
          candidates.push(session);
        }
      }

      if (candidates.length === 0) return null;
      return candidates.sort((a, b) => b.lastActivity - a.lastActivity)[0];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      this.logger.error(`[session] Failed to list sessions for ${userId}: ${String(err)}`);
      return null;
    }
  }

  /**
   * List all sessions for user
   */
  async list(userId: string): Promise<StoredSession[]> {
    const userDir = this.getUserDir(userId);
    try {
      const files = await fs.readdir(userDir);
      const sessions: StoredSession[] = [];
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const sessionId = file.replace(".json", "");
        const session = await this.load(userId, sessionId);
        if (session) {
          sessions.push(session);
        }
      }
      return sessions.sort((a, b) => b.lastActivity - a.lastActivity);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      this.logger.error(`[session] Failed to list sessions for ${userId}: ${String(err)}`);
      return [];
    }
  }

  /**
   * Record message to session
   */
  async recordMessage(
    userId: string,
    sessionId: string,
    role: "user" | "agent",
    content: string
  ): Promise<void> {
    const session = await this.load(userId, sessionId);
    if (!session) return;

    const message: StoredMessage = {
      role,
      content,
      timestamp: Date.now(),
    };

    session.messages.push(message);
    this.applyHistoryLimits(session);
    session.lastActivity = Date.now();
    await this.save(session);
  }

  /**
   * Update session status
   */
  async updateStatus(userId: string, sessionId: string, status: SessionStatus): Promise<void> {
    const session = await this.load(userId, sessionId);
    if (session) {
      session.status = status;
      session.lastActivity = Date.now();
      await this.save(session);
    }
  }

  /**
   * Clear message history
   */
  async clearHistory(userId: string, sessionId: string): Promise<void> {
    const session = await this.load(userId, sessionId);
    if (session) {
      session.messages = [];
      session.lastActivity = Date.now();
      await this.save(session);
      this.logger.info(`[session] Cleared history for ${userId}/${sessionId}`);
    }
  }

  /**
   * Apply history limits
   */
  private applyHistoryLimits(session: StoredSession): void {
    const { maxMessages, maxDays } = this.historyConfig;

    if (session.messages.length > maxMessages) {
      session.messages = session.messages.slice(-maxMessages);
    }

    if (maxDays !== null) {
      const cutoff = Date.now() - maxDays * 24 * 60 * 60 * 1000;
      session.messages = session.messages.filter((m) => m.timestamp >= cutoff);
    }
  }

  /**
   * Cleanup on shutdown
   */
  stop(): void {
    this.logger.info("[session] SessionService stopped");
  }
}
```

- [ ] **Step 2: Verify file created**

Run: `ls packages/telegram-agent/src/module-bridge/session.service.ts`
Expected: File exists

- [ ] **Step 3: Commit**

```bash
git add packages/telegram-agent/src/module-bridge/session.service.ts
git commit -m "feat(telegram-agent): add SessionService for session persistence"
```

---

### Task 4: Update Config for History

**Files:**
- Modify: `packages/telegram-agent/src/types.ts` (TelegramAgentConfig interface)
- Modify: `packages/telegram-agent/src/config/config.default.ts`

- [ ] **Step 1: Add history field to TelegramAgentConfig in types.ts**

Add after the `session` field in TelegramAgentConfig:

```typescript
  history: {
    maxMessages: number;
    maxDays: number;
  };
```

- [ ] **Step 2: Add history field to AppConfig in types.ts**

Add after the `session` field in AppConfig:

```typescript
  history: TelegramAgentConfig['history'];
```

- [ ] **Step 3: Import DEFAULT_HISTORY_CONFIG in config.default.ts**

Add to imports:

```typescript
import {
  DEFAULT_AGENT_CONFIG,
  DEFAULT_SESSION_CONFIG,
  DEFAULT_WEBHOOK_CONFIG,
  DEFAULT_HISTORY_CONFIG,
  defaultMediaDir,
  defaultStorageDir,
  resolvePreset,
} from "../constants";
```

- [ ] **Step 4: Add history config in config.default.ts**

Add after the `session` config block (around line 50):

```typescript
    history: {
      maxMessages: fileConfig.history?.maxMessages ?? DEFAULT_HISTORY_CONFIG.maxMessages,
      maxDays: fileConfig.history?.maxDays ?? DEFAULT_HISTORY_CONFIG.maxDays,
    },
```

- [ ] **Step 5: Verify changes**

Run: `pnpm --filter telegram-agent run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add packages/telegram-agent/src/types.ts packages/telegram-agent/src/config/config.default.ts
git commit -m "feat(telegram-agent): add history config to TelegramAgentConfig"
```

---

### Task 5: Integrate SessionService into BridgeService

**Files:**
- Modify: `packages/telegram-agent/src/module-bridge/bridge.service.ts`

- [ ] **Step 1: Import SessionService and types**

Add at top of imports section:

```typescript
import { SessionService } from "./session.service";
import type { StoredSession } from "../types";
```

- [ ] **Step 2: Inject SessionService**

Add after the AgentProcessService injection:

```typescript
  @Inject(SessionService)
  sessionService!: SessionService;
```

- [ ] **Step 3: Add currentSessionId tracking**

Add after the connections map declaration:

```typescript
  private currentSessionIds: Map<string, string> = new Map();
```

- [ ] **Step 4: Modify ensureUserSession to create StoredSession**

Replace the `ensureUserSession` method's session creation block (from `const session: UserSession` to `return session`):

```typescript
  private async ensureUserSession(userId: string): Promise<UserSession> {
    const existing = this.sessions.get(userId);
    if (existing) {
      existing.lastActivity = new Date();
      return existing;
    }

    // Check concurrent limit
    const maxUsers = this.config.session?.maxConcurrentUsers ?? this.MAX_CONCURRENT_USERS;
    if (this.sessions.size >= maxUsers) {
      throw new Error(`Maximum concurrent users (${maxUsers}) reached`);
    }

    // Try to restore from storage
    const stored = await this.sessionService.loadRestorable(userId);
    let sessionId: string;
    let createdAt: number;

    if (stored) {
      this.logger.info(`[bridge] Restoring session ${stored.sessionId} for user ${userId}`);
      sessionId = stored.sessionId;
      createdAt = stored.createdAt;
      await this.sessionService.updateStatus(userId, sessionId, "active");
    } else {
      sessionId = `${userId}-${Date.now()}`;
      createdAt = Date.now();
      await this.sessionService.save({
        userId,
        sessionId,
        createdAt,
        lastActivity: createdAt,
        status: "active",
        messages: [],
      });
      this.logger.info(`[bridge] Created new session ${sessionId} for user ${userId}`);
    }

    // Create new session
    const session: UserSession = {
      sessionId,
      lastActivity: new Date(),
    };
    this.sessions.set(userId, session);
    this.currentSessionIds.set(userId, sessionId);
    return session;
  }
```

- [ ] **Step 5: Add getUserSessionId helper method**

Add after getUserSession method:

```typescript
  /**
   * Get current session ID for user
   */
  getUserSessionId(userId: string): string | undefined {
    return this.currentSessionIds.get(userId);
  }
```

- [ ] **Step 6: Modify handleUserMessage to record message**

In handleUserMessage, after the `await this.sendPrompt(...)` calls, add:

```typescript
    // Record user message
    const sessionId = this.currentSessionIds.get(userId);
    if (sessionId) {
      const content = message.photo ? `User sent image: ${filePath}` : message.text;
      await this.sessionService.recordMessage(userId, sessionId, "user", content || "");
    }
```

Note: Need to capture filePath from downloadPhoto for recording.

Full replacement for handleUserMessage:

```typescript
  async handleUserMessage(userId: string, message: any): Promise<void> {
    await this.ensureConnection(userId);

    if (!this.connection || !this.currentSessionId) {
      throw new Error("Connection not initialized");
    }

    // Set user message ID for reaction tracking
    if (message.message_id) {
      this.acpClient.setUserMessageId(message.message_id);
    }

    // Reset message state
    this.acpClient.reset();

    let promptContent: string;

    if (message.photo) {
      const filePath = await this.mediaHandler.downloadPhoto(userId, message.photo);
      promptContent = `User sent image: ${filePath}`;
      await this.sendPrompt(promptContent);
    } else if (message.text) {
      await this.botService.sendReaction(userId, message.message_id);
      promptContent = message.text;
      await this.sendPrompt(promptContent);
    } else {
      return;
    }

    // Record user message
    const sessionId = this.currentSessionIds.get(userId);
    if (sessionId) {
      await this.sessionService.recordMessage(userId, sessionId, "user", promptContent);
    }
  }
```

- [ ] **Step 7: Modify closeUserSession to update status**

Replace closeUserSession method:

```typescript
  async closeUserSession(userId: string): Promise<void> {
    const sessionId = this.currentSessionIds.get(userId);
    if (sessionId) {
      await this.sessionService.updateStatus(userId, sessionId, "inactive");
    }
    
    const connection = this.connections.get(userId);
    if (connection) {
      this.connections.delete(userId);
    }
    this.sessions.delete(userId);
    this.currentSessionIds.delete(userId);
    this.logger.info(`[bridge] Closed session for user ${userId}`);
  }
```

- [ ] **Step 8: Modify close to call sessionService.stop**

In close method, add at beginning:

```typescript
    // Close all sessions with inactive status
    for (const [userId, sessionId] of this.currentSessionIds) {
      await this.sessionService.updateStatus(userId, sessionId, "inactive");
    }
```

Add at end (before final log):

```typescript
    this.sessionService.stop();
```

- [ ] **Step 9: Verify build succeeds**

Run: `pnpm --filter telegram-agent run build`
Expected: Build succeeds without errors

- [ ] **Step 10: Commit**

```bash
git add packages/telegram-agent/src/module-bridge/bridge.service.ts
git commit -m "feat(telegram-agent): integrate SessionService into BridgeService"
```

---

### Task 6: Add onMessageFlush to ACPClient and Record Agent Messages

**Files:**
- Modify: `packages/telegram-agent/src/plugins/acp/types.ts`
- Modify: `packages/telegram-agent/src/plugins/acp/client.ts`
- Modify: `packages/telegram-agent/src/module-bridge/bridge.service.ts`

- [ ] **Step 1: Add onMessageFlush to ACPClientOpts in types.ts**

Add after onThoughtFlush:

```typescript
  onMessageFlush?: (text: string) => Promise<void>;
```

Full types.ts ACPClientOpts should become:

```typescript
export interface ACPClientOpts {
  sendMessage: (text: string) => Promise<number>;
  editMessage: (msgId: number, text: string) => Promise<void>;
  removeReaction?: (msgId: number) => Promise<void>;
  sendTyping?: () => Promise<void>;
  onThoughtFlush?: (text: string) => Promise<void>;
  onMessageFlush?: (text: string) => Promise<void>;
  onMediaUpload?: (path: string, type: 'image' | 'audio') => Promise<void>;
  showThoughts?: boolean;
}
```

- [ ] **Step 2: Modify ACPClient.flush() to call onMessageFlush**

In `packages/telegram-agent/src/plugins/acp/client.ts`, modify the `flush()` method:

```typescript
  async flush(): Promise<string> {
    const text = this.pendingText;
    this.chunks = [];
    this.pendingText = '';

    // Call onMessageFlush callback if provided
    if (this.opts.onMessageFlush && text) {
      await this.opts.onMessageFlush(text);
    }

    return text;
  }
```

- [ ] **Step 3: Add onMessageFlush callback in BridgeService.ensureConnection**

In BridgeService.ensureConnection, when calling `this.acpClient.init(...)`, add onMessageFlush callback:

```typescript
    this.acpClient.init({
      sendMessage: async (text: string) => {
        return await this.botService.sendMessage(userId, text);
      },
      editMessage: async (msgId: number, text: string) => {
        await this.botService.editMessage(userId, msgId, text);
      },
      removeReaction: async (msgId: number) => {
        await this.botService.removeReaction(userId, msgId);
      },
      sendTyping: async () => {
        await this.botService.sendTyping(userId);
      },
      onMediaUpload: async (path: string, type: "image" | "audio") => {
        if (type === "image") {
          await this.mediaHandler.uploadPhoto(userId, path);
        } else {
          await this.mediaHandler.uploadAudio(userId, path);
        }
      },
      showThoughts: agentConfig.showThoughts,
      onMessageFlush: async (text: string) => {
        // Record agent message
        const sessionId = this.currentSessionIds.get(userId);
        if (sessionId && text) {
          await this.sessionService.recordMessage(userId, sessionId, "agent", text);
        }
      },
    });
```

- [ ] **Step 4: Build and verify**

Run: `pnpm --filter telegram-agent run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add packages/telegram-agent/src/plugins/acp/types.ts packages/telegram-agent/src/plugins/acp/client.ts packages/telegram-agent/src/module-bridge/bridge.service.ts
git commit -m "feat(telegram-agent): add onMessageFlush for agent message recording"
```

---

### Task 7: Update Command Handlers

**Files:**
- Modify: `packages/telegram-agent/src/module-bot/command.handler.ts`

- [ ] **Step 1: Import SessionService**

Add to imports:

```typescript
import { SessionService } from "../module-bridge/session.service";
```

- [ ] **Step 2: Inject SessionService**

Add after BridgeService injection:

```typescript
  @Inject(SessionService)
  sessionService!: SessionService;
```

- [ ] **Step 3: Modify handleStart to show restored info**

Replace handleStart method:

```typescript
  async handleStart(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    const username = ctx.from?.username || ctx.from?.first_name || "unknown";
    if (!userId) return;

    this.logger.info(`[command] /start from ${username} (${userId})`);

    // Check for stored session
    const stored = await this.sessionService.loadRestorable(userId);
    const session = this.bridgeService.getUserSession(userId);

    if (session) {
      const messageCount = stored?.messages.length ?? 0;
      await ctx.reply(
        `<b>Session restored</b>\n` +
        `Session ID: <code>${session.sessionId}</code>\n` +
        `Messages: ${messageCount}`,
        { parse_mode: "HTML" }
      );
    } else {
      await ctx.reply(
        `<b>Session ready</b>\n` +
        `Send a message to start chatting.`,
        { parse_mode: "HTML" }
      );
    }
  }
```

- [ ] **Step 4: Modify handleStatus to show storage info**

Replace handleStatus method:

```typescript
  async handleStatus(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    this.logger.info(`[command] /status from ${userId}`);

    const session = this.bridgeService.getUserSession(userId);
    const sessionId = this.bridgeService.getUserSessionId(userId);
    const stored = sessionId ? await this.sessionService.load(userId, sessionId) : null;

    if (!session || !sessionId) {
      await ctx.reply("<b>No active session</b>", { parse_mode: "HTML" });
      return;
    }

    const formatDate = (ts: number) => new Date(ts).toLocaleString();

    await ctx.reply(
      `<b>Session Status</b>\n\n` +
      `<b>ID:</b> <code>${session.sessionId}</code>\n` +
      `<b>Created:</b> ${stored ? formatDate(stored.createdAt) : 'N/A'}\n` +
      `<b>Last Activity:</b> ${formatDate(session.lastActivity.getTime())}\n` +
      `<b>Messages:</b> ${stored?.messages.length ?? 0}\n` +
      `<b>Status:</b> ${stored?.status ?? 'N/A'}`,
      { parse_mode: "HTML" }
    );
  }
```

- [ ] **Step 5: Modify handleRestart to terminate stored session**

Replace handleRestart method:

```typescript
  async handleRestart(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    this.logger.info(`[command] /restart from ${userId}`);

    await ctx.reply("<b>Restarting session...</b>", { parse_mode: "HTML" });

    // Mark current session as terminated
    const sessionId = this.bridgeService.getUserSessionId(userId);
    if (sessionId) {
      await this.sessionService.updateStatus(userId, sessionId, "terminated");
    }

    await this.bridgeService.closeUserSession(userId);
    this.bridgeService.resetReactionState(userId);

    await ctx.reply(
      `<b>Session closed</b>\n` +
      `Send a message to start new session.`,
      { parse_mode: "HTML" }
    );
  }
```

- [ ] **Step 6: Modify handleClear to clear history**

Replace handleClear method:

```typescript
  async handleClear(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    this.logger.info(`[command] /clear from ${userId}`);

    const sessionId = this.bridgeService.getUserSessionId(userId);
    if (sessionId) {
      await this.sessionService.clearHistory(userId, sessionId);
    }

    this.bridgeService.resetReactionState(userId);
    await ctx.reply("<b>History cleared</b>", { parse_mode: "HTML" });
  }
```

- [ ] **Step 7: Build and verify**

Run: `pnpm --filter telegram-agent run build`
Expected: Build succeeds

- [ ] **Step 8: Commit**

```bash
git add packages/telegram-agent/src/module-bot/command.handler.ts
git commit -m "feat(telegram-agent): update command handlers with session persistence"
```

---

### Task 8: Verify SessionService Auto-Registration

**Files:**
- No changes needed (plugin.ts is correct as-is)

- [ ] **Step 1: Verify @Injectable decorator**

SessionService has `@Injectable()` decorator which enables automatic registration by ArtusX framework.

Run: `grep "@Injectable" packages/telegram-agent/src/module-bridge/session.service.ts`
Expected: Shows `@Injectable()` decorator

- [ ] **Step 2: Verify import in bridge.service.ts**

SessionService is imported and injected via `@Inject(SessionService)` in BridgeService, which ensures it's loaded.

Run: `grep "SessionService" packages/telegram-agent/src/module-bridge/bridge.service.ts`
Expected: Shows import and injection

- [ ] **Step 3: No commit needed for this task**

SessionService auto-registers through dependency injection.

---

### Task 9: Build and Test

- [ ] **Step 1: Full build**

Run: `pnpm --filter telegram-agent run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Run linter**

Run: `pnpm --filter telegram-agent run lint`
Expected: No lint errors (or run lint:fix if needed)

- [ ] **Step 3: Manual smoke test**

Start the application:
```bash
pnpm --filter telegram-agent run dev
```

Verify logs show SessionService initialization.

- [ ] **Step 4: Verify sessions directory creation**

Run: `ls ~/.telegram-agent/sessions/`
Expected: Directory exists (after first message sent)

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(telegram-agent): session persistence implementation fixes"
```

---

### Task 10: Update Documentation

**Files:**
- Modify: `packages/telegram-agent/README.md`

- [ ] **Step 1: Add session persistence section**

Add after Configuration section:

```markdown
## Session Persistence

Sessions and message history are persisted to `~/.telegram-agent/sessions/<userId>/<sessionId>.json`.

### Benefits
- Session state survives application restarts
- Message history preserved (up to 100 messages, 7 days)
- Commands `/restart` and `/clear` manage stored history

### Storage Format

```json
{
  "userId": "123456",
  "sessionId": "123456-1700000000000",
  "createdAt": 1700000000000,
  "lastActivity": 1700000001000,
  "status": "active",
  "messages": [
    { "role": "user", "content": "Hello", "timestamp": 1700000000000 },
    { "role": "agent", "content": "Hi there!", "timestamp": 1700000000500 }
  ]
}
```

### History Limits

- `maxMessages`: 100 (configurable)
- `maxDays`: 7 (configurable)

Configure in `~/.telegram-agent/config.yaml`:
```yaml
history:
  maxMessages: 100
  maxDays: 7
```
```

- [ ] **Step 2: Commit**

```bash
git add packages/telegram-agent/README.md
git commit -m "docs(telegram-agent): document session persistence feature"
```