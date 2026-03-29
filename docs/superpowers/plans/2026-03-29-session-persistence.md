# Session Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement session persistence for telegram-acp so sessions survive restarts and conversation history is preserved.

**Architecture:** Add a storage module for file I/O, integrate it into SessionManager for persisting metadata and messages, update bot commands to expose session info, and add startup/shutdown hooks for session restoration.

**Tech Stack:** TypeScript, Node.js fs module, JSON file storage, grammy bot framework, ACP SDK

---

## Task 1: Add Test Framework

**Files:**
- Modify: `packages/telegram-acp/package.json`

- [ ] **Step 1: Add vitest dependency**

Run:
```bash
cd /root/gpm/github.com/thonatos/claude-code-monorepo/packages/telegram-acp && pnpm add -D vitest
```

Expected: vitest added to devDependencies

- [ ] **Step 2: Add test script to package.json**

Edit `packages/telegram-acp/package.json`, add to scripts:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Create vitest config**

Create `packages/telegram-acp/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create test directory**

Run:
```bash
mkdir -p /root/gpm/github.com/thonatos/claude-code-monorepo/packages/telegram-acp/test
```

- [ ] **Step 5: Commit**

```bash
git add packages/telegram-acp/package.json packages/telegram-acp/vitest.config.ts
git commit -m "chore: add vitest test framework"
```

---

## Task 2: Create Storage Types

**Files:**
- Create: `packages/telegram-acp/src/storage.ts` (partial - types only)

- [ ] **Step 1: Write the type definitions**

Create `packages/telegram-acp/src/storage.ts`:
```typescript
/**
 * Storage types and service for session persistence.
 */

export type SessionStatus = 'active' | 'inactive' | 'terminated';

export interface StoredMessage {
  role: 'user' | 'agent';
  content: string;
  timestamp: number;  // Unix timestamp (ms)
}

export interface StoredSession {
  userId: string;
  sessionId: string;
  agentConfig: {
    preset?: string;
    command: string;
    args: string[];
    cwd: string;
  };
  createdAt: number;
  lastActivity: number;
  status: SessionStatus;
  messages: StoredMessage[];
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/telegram-acp/src/storage.ts
git commit -m "feat(storage): add StoredSession and StoredMessage types"
```

---

## Task 3: Implement SessionStorage Core Methods

**Files:**
- Modify: `packages/telegram-acp/src/storage.ts` (add class implementation)

- [ ] **Step 1: Add imports and SessionStorage class skeleton**

Edit `packages/telegram-acp/src/storage.ts`, add after the type definitions:
```typescript
import path from 'node:path';
import fs from 'node:fs/promises';
import { defaultStorageDir } from './config.ts';

export class SessionStorage {
  private sessionsDir: string;

  constructor(baseDir?: string) {
    this.sessionsDir = path.join(baseDir ?? defaultStorageDir(), 'sessions');
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
}
```

- [ ] **Step 2: Implement save method**

Add to SessionStorage class:
```typescript
  async save(session: StoredSession): Promise<void> {
    await this.ensureUserDir(session.userId);
    const filePath = this.getFilePath(session.userId, session.sessionId);

    // Atomic write: write to temp file, then rename
    const tempPath = filePath + '.tmp';
    await fs.writeFile(tempPath, JSON.stringify(session, null, 2), 'utf-8');
    await fs.rename(tempPath, filePath);
  }
```

- [ ] **Step 3: Implement load method**

Add to SessionStorage class:
```typescript
  async load(userId: string, sessionId: string): Promise<StoredSession | null> {
    const filePath = this.getFilePath(userId, sessionId);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as StoredSession;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      // Log parse error but don't throw - return null to allow new session creation
      console.error(`[storage] Failed to load ${filePath}: ${String(err)}`);
      return null;
    }
  }
```

- [ ] **Step 4: Implement loadActive method**

Add to SessionStorage class:
```typescript
  async loadActive(userId: string): Promise<StoredSession | null> {
    const userDir = this.getUserDir(userId);
    try {
      const files = await fs.readdir(userDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const sessionId = file.replace('.json', '');
        const session = await this.load(userId, sessionId);
        if (session && session.status === 'active') {
          return session;
        }
      }
      return null;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      console.error(`[storage] Failed to list sessions for ${userId}: ${String(err)}`);
      return null;
    }
  }
```

- [ ] **Step 5: Commit**

```bash
git add packages/telegram-acp/src/storage.ts
git commit -m "feat(storage): implement save, load, and loadActive methods"
```

---

## Task 4: Implement SessionStorage Additional Methods

**Files:**
- Modify: `packages/telegram-acp/src/storage.ts` (add remaining methods)

- [ ] **Step 1: Implement list method**

Add to SessionStorage class:
```typescript
  async list(userId: string): Promise<StoredSession[]> {
    const userDir = this.getUserDir(userId);
    try {
      const files = await fs.readdir(userDir);
      const sessions: StoredSession[] = [];
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const sessionId = file.replace('.json', '');
        const session = await this.load(userId, sessionId);
        if (session) {
          sessions.push(session);
        }
      }
      return sessions.sort((a, b) => b.lastActivity - a.lastActivity);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      console.error(`[storage] Failed to list sessions for ${userId}: ${String(err)}`);
      return [];
    }
  }
```

- [ ] **Step 2: Implement updateStatus method**

Add to SessionStorage class:
```typescript
  async updateStatus(userId: string, sessionId: string, status: SessionStatus): Promise<void> {
    const session = await this.load(userId, sessionId);
    if (session) {
      session.status = status;
      await this.save(session);
    }
  }
```

- [ ] **Step 3: Implement clearHistory method**

Add to SessionStorage class:
```typescript
  async clearHistory(userId: string, sessionId: string): Promise<void> {
    const session = await this.load(userId, sessionId);
    if (session) {
      session.messages = [];
      await this.save(session);
    }
  }
```

- [ ] **Step 4: Implement markTerminated method**

Add to SessionStorage class:
```typescript
  async markTerminated(userId: string, sessionId: string): Promise<void> {
    await this.updateStatus(userId, sessionId, 'terminated');
  }
```

- [ ] **Step 5: Implement delete method**

Add to SessionStorage class:
```typescript
  async delete(userId: string, sessionId: string): Promise<void> {
    const filePath = this.getFilePath(userId, sessionId);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`[storage] Failed to delete ${filePath}: ${String(err)}`);
      }
    }
  }
```

- [ ] **Step 6: Commit**

```bash
git add packages/telegram-acp/src/storage.ts
git commit -m "feat(storage): implement list, updateStatus, clearHistory, markTerminated, delete"
```

---

## Task 5: Add Storage Unit Tests

**Files:**
- Create: `packages/telegram-acp/test/storage.test.ts`

- [ ] **Step 1: Write test file setup**

Create `packages/telegram-acp/test/storage.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { SessionStorage, StoredSession } from '../src/storage.ts';

describe('SessionStorage', () => {
  let storage: SessionStorage;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `telegram-acp-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    storage = new SessionStorage(testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  const createTestSession = (userId: string, sessionId: string): StoredSession => ({
    userId,
    sessionId,
    agentConfig: {
      preset: 'claude',
      command: 'pnpx',
      args: ['@agentclientprotocol/claude-agent-acp'],
      cwd: '/tmp',
    },
    createdAt: Date.now(),
    lastActivity: Date.now(),
    status: 'active',
    messages: [],
  });
});
```

- [ ] **Step 2: Write save/load test**

Add inside describe block:
```typescript
  it('should save and load a session', async () => {
    const session = createTestSession('user123', 'session-abc');
    await storage.save(session);

    const loaded = await storage.load('user123', 'session-abc');
    expect(loaded).not.toBeNull();
    expect(loaded?.userId).toBe('user123');
    expect(loaded?.sessionId).toBe('session-abc');
    expect(loaded?.status).toBe('active');
  });
```

- [ ] **Step 3: Write loadActive test**

Add inside describe block:
```typescript
  it('should return active session from loadActive', async () => {
    const active = createTestSession('user123', 'active-session');
    const inactive = createTestSession('user123', 'inactive-session');
    inactive.status = 'inactive';

    await storage.save(active);
    await storage.save(inactive);

    const loaded = await storage.loadActive('user123');
    expect(loaded).not.toBeNull();
    expect(loaded?.sessionId).toBe('active-session');
  });
```

- [ ] **Step 4: Write clearHistory test**

Add inside describe block:
```typescript
  it('should clear history', async () => {
    const session = createTestSession('user123', 'session-abc');
    session.messages.push({ role: 'user', content: 'Hello', timestamp: Date.now() });
    await storage.save(session);

    await storage.clearHistory('user123', 'session-abc');

    const loaded = await storage.load('user123', 'session-abc');
    expect(loaded?.messages).toHaveLength(0);
  });
```

- [ ] **Step 5: Write updateStatus test**

Add inside describe block:
```typescript
  it('should update session status', async () => {
    const session = createTestSession('user123', 'session-abc');
    await storage.save(session);

    await storage.updateStatus('user123', 'session-abc', 'inactive');

    const loaded = await storage.load('user123', 'session-abc');
    expect(loaded?.status).toBe('inactive');
  });
```

- [ ] **Step 6: Write load nonexistent returns null test**

Add inside describe block:
```typescript
  it('should return null for nonexistent session', async () => {
    const loaded = await storage.load('nonexistent', 'no-session');
    expect(loaded).toBeNull();
  });
```

- [ ] **Step 7: Run tests**

Run:
```bash
cd /root/gpm/github.com/thonatos/claude-code-monorepo/packages/telegram-acp && pnpm test
```

Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add packages/telegram-acp/test/storage.test.ts
git commit -m "test(storage): add unit tests for SessionStorage"
```

---

## Task 6: Extend Config with History Settings

**Files:**
- Modify: `packages/telegram-acp/src/config.ts`

- [ ] **Step 1: Add HistoryConfig interface**

Edit `packages/telegram-acp/src/config.ts`, add after SessionConfig interface (around line 20):
```typescript
export interface HistoryConfig {
  maxMessages: number | null;   // null = unlimited
  maxDays: number | null;       // null = unlimited
}
```

- [ ] **Step 2: Add history field to TelegramAcpConfig**

Edit `packages/telegram-acp/src/config.ts`, add to TelegramAcpConfig interface (around line 43, after session field):
```typescript
  history: HistoryConfig;
```

- [ ] **Step 3: Add default history config**

Edit `packages/telegram-acp/src/config.ts`, add to defaultConfig() return object (around line 90, after session field):
```typescript
    history: {
      maxMessages: null,
      maxDays: null,
    },
```

- [ ] **Step 4: Merge history config from file**

Edit `packages/telegram-acp/src/config.ts`, in loadConfig() function, add after the session merge block (around line 133):
```typescript
      if (fileConfig.history) {
        config.history.maxMessages = fileConfig.history.maxMessages ?? config.history.maxMessages;
        config.history.maxDays = fileConfig.history.maxDays ?? config.history.maxDays;
      }
```

- [ ] **Step 5: Commit**

```bash
git add packages/telegram-acp/src/config.ts
git commit -m "feat(config): add history config for maxMessages and maxDays"
```

---

## Task 7: Integrate Storage into SessionManager

**Files:**
- Modify: `packages/telegram-acp/src/session.ts`

- [ ] **Step 1: Add imports**

Edit `packages/telegram-acp/src/session.ts`, add to imports at top:
```typescript
import { SessionStorage, StoredSession, StoredMessage } from './storage.ts';
import type { HistoryConfig } from './config.ts';
```

- [ ] **Step 2: Add storage and pendingReplies to SessionManager**

Edit `packages/telegram-acp/src/session.ts`, add private fields to SessionManager class (around line 35, after opts):
```typescript
  private storage: SessionStorage;
  private pendingReplies = new Map<string, string[]>();
```

- [ ] **Step 3: Add historyConfig to opts**

Edit `packages/telegram-acp/src/session.ts`, add to SessionManagerOpts interface (around line 25, after sessionConfig):
```typescript
  historyConfig: HistoryConfig;
```

- [ ] **Step 4: Initialize storage in constructor**

Edit `packages/telegram-acp/src/session.ts`, in constructor (around line 38), add:
```typescript
    this.storage = new SessionStorage();
```

- [ ] **Step 5: Export storage for bot.ts access**

Edit `packages/telegram-acp/src/session.ts`, add public getter to SessionManager class:
```typescript
  getStorage(): SessionStorage {
    return this.storage;
  }
```

- [ ] **Step 6: Commit**

```bash
git add packages/telegram-acp/src/session.ts
git commit -m "feat(session): integrate SessionStorage into SessionManager"
```

---

## Task 8: Add SessionManager Persistence Methods

**Files:**
- Modify: `packages/telegram-acp/src/session.ts`

- [ ] **Step 1: Implement recordMessage method**

Edit `packages/telegram-acp/src/session.ts`, add to SessionManager class:
```typescript
  async recordMessage(userId: string, role: 'user' | 'agent', content: string): Promise<void> {
    const stored = await this.storage.loadActive(userId);
    if (!stored) return;

    const message: StoredMessage = {
      role,
      content,
      timestamp: Date.now(),
    };
    stored.messages.push(message);

    // Apply history limits
    this.applyHistoryLimits(stored);

    stored.lastActivity = Date.now();
    await this.storage.save(stored);
  }
```

- [ ] **Step 2: Implement applyHistoryLimits helper**

Edit `packages/telegram-acp/src/session.ts`, add private method to SessionManager class:
```typescript
  private applyHistoryLimits(session: StoredSession): void {
    const { maxMessages, maxDays } = this.opts.historyConfig;

    // Limit by message count
    if (maxMessages !== null && session.messages.length > maxMessages) {
      session.messages = session.messages.slice(-maxMessages);
    }

    // Limit by days
    if (maxDays !== null) {
      const cutoff = Date.now() - maxDays * 24 * 60 * 60 * 1000;
      session.messages = session.messages.filter(m => m.timestamp >= cutoff);
    }
  }
```

- [ ] **Step 3: Implement bufferReply method**

Edit `packages/telegram-acp/src/session.ts`, add to SessionManager class:
```typescript
  bufferReply(userId: string, text: string): void {
    const buffer = this.pendingReplies.get(userId) || [];
    buffer.push(text);
    this.pendingReplies.set(userId, buffer);
  }
```

- [ ] **Step 4: Implement flushAndRecord method**

Edit `packages/telegram-acp/src/session.ts`, add to SessionManager class:
```typescript
  async flushAndRecord(userId: string): Promise<void> {
    const buffer = this.pendingReplies.get(userId);
    if (buffer && buffer.length > 0) {
      const fullText = buffer.join('\n');
      await this.recordMessage(userId, 'agent', fullText);
      this.pendingReplies.delete(userId);
    }
  }
```

- [ ] **Step 5: Commit**

```bash
git add packages/telegram-acp/src/session.ts
git commit -m "feat(session): add recordMessage, bufferReply, flushAndRecord methods"
```

---

## Task 9: Add SessionManager Restore and Restart

**Files:**
- Modify: `packages/telegram-acp/src/session.ts`

- [ ] **Step 1: Modify getOrCreate to try restore**

Edit `packages/telegram-acp/src/session.ts`, modify getOrCreate method (around line 45):
```typescript
  async getOrCreate(userId: string): Promise<UserSession> {
    const existing = this.sessions.get(userId);
    if (existing) {
      existing.lastActivity = Date.now();
      this.resetIdleTimer(userId);
      return existing;
    }

    // Try to restore persisted session
    const stored = await this.storage.loadActive(userId);
    if (stored) {
      this.opts.log(`[session] Restoring persisted session for ${userId}`);
      return this.restore(userId, stored);
    }

    return this.create(userId);
  }
```

- [ ] **Step 2: Implement restore method**

Edit `packages/telegram-acp/src/session.ts`, add private method to SessionManager class:
```typescript
  private async restore(userId: string, stored: StoredSession): Promise<UserSession> {
    this.opts.log(`[session] Restoring for ${userId} (sessionId: ${stored.sessionId})`);

    const client = new TelegramAcpClient({
      sendTyping: () => this.opts.sendTyping(userId),
      onThoughtFlush: (text: string) => {
        this.bufferReply(userId, text);
        this.opts.onReply(userId, text);
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

    return session;
  }
```

- [ ] **Step 3: Implement restart method**

Edit `packages/telegram-acp/src/session.ts`, add to SessionManager class:
```typescript
  async restart(userId: string): Promise<UserSession> {
    const existing = this.sessions.get(userId);
    if (existing) {
      // Mark old session as terminated
      await this.storage.markTerminated(userId, existing.sessionId);
      this.killAgent(existing.process);
      this.sessions.delete(userId);
      this.timers.delete(userId);
      this.opts.log(`[session] Terminated session for ${userId}`);
    }

    return this.create(userId);
  }
```

- [ ] **Step 4: Implement clearHistory method**

Edit `packages/telegram-acp/src/session.ts`, add to SessionManager class:
```typescript
  async clearHistory(userId: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (session) {
      await this.storage.clearHistory(userId, session.sessionId);
      this.opts.log(`[session] Cleared history for ${userId}`);
    }
  }
```

- [ ] **Step 5: Commit**

```bash
git add packages/telegram-acp/src/session.ts
git commit -m "feat(session): add restore, restart, clearHistory methods"
```

---

## Task 10: Modify SessionManager create and stop

**Files:**
- Modify: `packages/telegram-acp/src/session.ts`

- [ ] **Step 1: Modify create to save session**

Edit `packages/telegram-acp/src/session.ts`, modify the create method. After the session object is created (around line 91), add before the process.on('exit'):
```typescript
    // Persist session metadata
    const stored: StoredSession = {
      userId,
      sessionId,
      agentConfig: {
        preset: this.opts.agentPreset,
        command: this.opts.agentCommand,
        args: this.opts.agentArgs,
        cwd: this.opts.agentCwd,
      },
      createdAt: Date.now(),
      lastActivity: Date.now(),
      status: 'active',
      messages: [],
    };
    await this.storage.save(stored);
```

- [ ] **Step 2: Add agentPreset to opts**

Edit `packages/telegram-acp/src/session.ts`, add to SessionManagerOpts interface:
```typescript
  agentPreset?: string;
```

- [ ] **Step 3: Modify stop to mark sessions inactive**

Edit `packages/telegram-acp/src/session.ts`, modify stop method (around line 64). Add before the existing cleanup:
```typescript
  async stop(): Promise<void> {
    // Mark all active sessions as inactive
    for (const [userId, session] of this.sessions) {
      await this.storage.updateStatus(userId, session.sessionId, 'inactive');
    }

    // Existing cleanup...
    for (const [userId, session] of this.sessions) {
      this.opts.log(`[session] Stopping for ${userId}`);
      this.killAgent(session.process);
    }
    this.sessions.clear();

    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
```

- [ ] **Step 4: Commit**

```bash
git add packages/telegram-acp/src/session.ts
git commit -m "feat(session): save session on create, mark inactive on stop"
```

---

## Task 11: Update Bot Commands

**Files:**
- Modify: `packages/telegram-acp/src/bot.ts`

- [ ] **Step 1: Modify /start command**

Edit `packages/telegram-acp/src/bot.ts`, replace the existing /start handler (around line 54):
```typescript
  bot.command("start", async (ctx) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const acpCtx = ctx as AcpContext;
    const session = await acpCtx.sessionManager.getOrCreate(userId);
    const stored = await acpCtx.sessionManager.getStorage().loadActive(userId);

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

- [ ] **Step 2: Modify /status command**

Edit `packages/telegram-acp/src/bot.ts`, replace the existing /status handler (around line 60):
```typescript
  bot.command("status", async (ctx) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const acpCtx = ctx as AcpContext;
    const stored = await acpCtx.sessionManager.getStorage().loadActive(userId);

    if (!stored) {
      await ctx.reply("No active session.");
      return;
    }

    const formatDate = (ts: number) => new Date(ts).toLocaleString();

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

- [ ] **Step 3: Add /restart command**

Edit `packages/telegram-acp/src/bot.ts`, add after /status handler:
```typescript
  bot.command("restart", async (ctx) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    await ctx.reply("Restarting session...");

    const acpCtx = ctx as AcpContext;
    const session = await acpCtx.sessionManager.restart(userId);

    await ctx.reply(`New session created.\nSession ID: ${session.sessionId}`);
  });
```

- [ ] **Step 4: Add /clear command**

Edit `packages/telegram-acp/src/bot.ts`, add after /restart handler:
```typescript
  bot.command("clear", async (ctx) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const acpCtx = ctx as AcpContext;
    await acpCtx.sessionManager.clearHistory(userId);

    await ctx.reply("History cleared.");
  });
```

- [ ] **Step 5: Update /help command**

Edit `packages/telegram-acp/src/bot.ts`, replace the existing /help handler:
```typescript
  bot.command("help", (ctx) =>
    ctx.reply("Send any message to chat with the AI agent.\nCommands: /start, /help, /status, /restart, /clear")
  );
```

- [ ] **Step 6: Commit**

```bash
git add packages/telegram-acp/src/bot.ts
git commit -m "feat(bot): update /start, /status, add /restart, /clear commands"
```

---

## Task 12: Add Message Recording to MessageHandler

**Files:**
- Modify: `packages/telegram-acp/src/bot.ts`

- [ ] **Step 1: Record user message before prompt**

Edit `packages/telegram-acp/src/bot.ts`, in messageHandler function. After extracting prompt (around line 120), add before sending to agent:
```typescript
    // Record user message
    await acpCtx.sessionManager.recordMessage(userId, 'user', prompt);
```

- [ ] **Step 2: Record agent message after reply**

Edit `packages/telegram-acp/src/bot.ts`, in messageHandler function. After collecting replyText (around line 146), add before sending reply:
```typescript
    // Record agent reply
    await acpCtx.sessionManager.recordMessage(userId, 'agent', replyText);
```

- [ ] **Step 3: Commit**

```bash
git add packages/telegram-acp/src/bot.ts
git commit -m "feat(bot): add message recording in messageHandler"
```

---

## Task 13: Update Bridge for Startup Restoration

**Files:**
- Modify: `packages/telegram-acp/src/bridge.ts`

- [ ] **Step 1: Add historyConfig and agentPreset to SessionManager options**

Edit `packages/telegram-acp/src/bridge.ts`, in start() method. Add to SessionManager constructor options (around line 26):
```typescript
      historyConfig: this.config.history,
      agentPreset: this.config.agent.preset,
```

- [ ] **Step 2: Add restorePersistedSessions method**

Edit `packages/telegram-acp/src/bridge.ts`, add private method to TelegramAcpBridge class:
```typescript
  private async restorePersistedSessions(): Promise<void> {
    const sessionsDir = path.join(defaultStorageDir(), 'sessions');
    if (!fs.existsSync(sessionsDir)) return;

    const userDirs = fs.readdirSync(sessionsDir);
    for (const userId of userDirs) {
      const userPath = path.join(sessionsDir, userId);
      if (!fs.statSync(userPath).isDirectory()) continue;

      const stored = await this.sessionManager!.getStorage().loadActive(userId);
      if (stored && stored.status === 'active') {
        this.log(`[restore] Restoring session for ${userId}`);
        try {
          await this.sessionManager!.restore(userId, stored);
        } catch (err) {
          this.log(`[restore] Failed to restore ${userId}: ${String(err)}`);
        }
      }
    }
  }
```

- [ ] **Step 3: Add imports for fs and path**

Edit `packages/telegram-acp/src/bridge.ts`, add to imports at top:
```typescript
import path from 'node:path';
import fs from 'node:fs';
import { defaultStorageDir } from './config.ts';
```

- [ ] **Step 4: Call restorePersistedSessions in start**

Edit `packages/telegram-acp/src/bridge.ts`, in start() method. Add after creating sessionManager (around line 43), before creating bot:
```typescript
    // Restore persisted sessions
    await this.restorePersistedSessions();
```

- [ ] **Step 5: Commit**

```bash
git add packages/telegram-acp/src/bridge.ts
git commit -m "feat(bridge): add startup session restoration"
```

---

## Task 14: Export Storage from Index

**Files:**
- Modify: `packages/telegram-acp/src/index.ts`

- [ ] **Step 1: Add storage exports**

Read `packages/telegram-acp/src/index.ts` first, then add storage exports:
```typescript
export { SessionStorage, StoredSession, StoredMessage, SessionStatus } from './storage.ts';
```

- [ ] **Step 2: Commit**

```bash
git add packages/telegram-acp/src/index.ts
git commit -m "feat: export storage types from index"
```

---

## Task 15: Build and Verify

**Files:**
- None (verification only)

- [ ] **Step 1: Build the project**

Run:
```bash
cd /root/gpm/github.com/thonatos/claude-code-monorepo/packages/telegram-acp && pnpm run build
```

Expected: Build succeeds without errors

- [ ] **Step 2: Run tests**

Run:
```bash
cd /root/gpm/github.com/thonatos/claude-code-monorepo/packages/telegram-acp && pnpm test
```

Expected: All tests pass

- [ ] **Step 3: Final commit if needed**

If any fixes were made during build/test:
```bash
git add -A
git commit -m "fix: resolve build/test issues"
```

---

## Task 16: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update commands documentation**

Edit `CLAUDE.md`, update the CLI commands and built-in agent presets sections to mention the new `/restart` and `/clear` commands.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with new session commands"
```

---

## Self-Review Checklist

| Spec Requirement | Covered by Task |
|-----------------|-----------------|
| Persist session metadata to `~/.telegram-acp/sessions/` | Task 3, 10 |
| Record conversation history | Task 8, 12 |
| `/start` restores persisted session | Task 11 |
| `/status` shows detailed info | Task 11 |
| `/restart` destroys and recreates | Task 9, 11 |
| `/clear` clears history | Task 9, 11 |
| Configurable history limits | Task 6, 8 |
| Startup restoration | Task 13 |
| Shutdown marking inactive | Task 10 |

All spec requirements covered. No placeholders found. Type names consistent across tasks.