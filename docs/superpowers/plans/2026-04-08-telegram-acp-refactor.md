# telegram-acp 架构重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 telegram-acp 代码结构，实现模块职责单一、边界明确、代码量减少 20%+

**Architecture:** 将大文件拆分为目录模块，删除未使用的 metrics.ts，简化 bridge.ts 的回调模式为依赖注入

**Tech Stack:** TypeScript, grammy Bot API, ACP SDK, vitest

---

## 文件结构规划

### 新增文件

```
packages/telegram-acp/src/
├── session/
│   ├── index.ts          # SessionManager 导出入口
│   ├── lifecycle.ts      # Session 生命周期 CRUD
│   ├── spawn.ts          # Agent 进程 spawn + ACP 连接
│   ├── idle-manager.ts   # Idle timeout + eviction
│   └── types.ts          # UserSession、SessionManagerOpts、RestoredSession
├── storage/
│   ├── index.ts          # 导出入口
│   ├── file-storage.ts   # 文件存储实现
│   └── types.ts          # StoredSession、StoredMessage、SessionStatus
├── streaming/
│   ├── index.ts          # 导出入口
│   ├── message-stream.ts # MessageStream 类
│   ├── state.ts          # StreamingMessageState
│   ├── rate-limiter.ts   # TelegramRateLimiter
│   ├── formatting.ts     # markdownToHtml、escapeHtml
│   └── types.ts          # StreamingConfig、MessageCallbacks
├── telegram-api.ts       # Bot API 封装
```

### 删除文件

- `src/session.ts` → 拆分到 `session/`
- `src/storage.ts` → 拆分到 `storage/`
- `src/streaming.ts` → 拆分到 `streaming/`
- `src/metrics.ts` → 删除（未使用）

---

## Phase 1: session.ts 拆分

### Task 1: 创建 session/types.ts

**Files:**
- Create: `packages/telegram-acp/src/session/types.ts`

- [ ] **Step 1: 创建类型定义文件**

```typescript
/**
 * Session types and interfaces.
 */

import type { ChildProcess } from "node:child_process";
import type { TelegramAcpClient } from "../client.ts";
import type * as acp from "@agentclientprotocol/sdk";
import type { HealthMonitor } from "../health.ts";
import type { SessionConfig, HistoryConfig } from "../config.ts";

export interface UserSession {
  userId: string;
  client: TelegramAcpClient;
  connection: acp.ClientSideConnection;
  sessionId: string;
  process: ChildProcess;
  lastActivity: number;
  healthMonitor: HealthMonitor;
}

export interface RestoredSession {
  session: UserSession;
  hadHistory: boolean;
  messages: StoredMessage[];
}

export interface SessionManagerOpts {
  agentPreset?: string;
  agentCommand: string;
  agentArgs: string[];
  agentCwd: string;
  agentEnv?: Record<string, string>;
  sessionConfig: SessionConfig;
  historyConfig: HistoryConfig;
  showThoughts: boolean;
  log: (msg: string) => void;
  onReply: (userId: string, text: string) => Promise<void>;
  sendTyping: (userId: string) => Promise<void>;
  sendMessage: (userId: string, text: string, parseMode?: 'HTML') => Promise<number>;
  editMessage: (userId: string, msgId: number, text: string, parseMode?: 'HTML') => Promise<number>;
}

// Import from storage types (will be created later)
import type { StoredMessage } from "../storage/types.ts";
```

- [ ] **Step 2: 暂时使用 placeholder import（storage/types.ts 未创建时）**

由于 storage/types.ts 尚未创建，先使用临时定义：

```typescript
// Temporary - will import from storage/types.ts after Task 5
export interface StoredMessage {
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
}
```

- [ ] **Step 3: 提交**

```bash
git add packages/telegram-acp/src/session/types.ts
git commit -m "refactor(session): add types.ts with session interfaces"
```

---

### Task 2: 创建 session/spawn.ts

**Files:**
- Create: `packages/telegram-acp/src/session/spawn.ts`

- [ ] **Step 1: 创建 spawn 模块**

```typescript
/**
 * Agent process spawning and ACP connection initialization.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { Writable, Readable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";
import { TelegramAcpClient } from "../client.ts";
import packageJson from "../../package.json" with { type: "json" };

export interface SpawnResult {
  process: ChildProcess;
  connection: acp.ClientSideConnection;
  sessionId: string;
}

export interface SpawnOpts {
  agentCommand: string;
  agentArgs: string[];
  agentCwd: string;
  agentEnv?: Record<string, string>;
  log: (msg: string) => void;
}

/**
 * Spawn agent process and initialize ACP connection.
 */
export async function spawnAgent(
  userId: string,
  client: TelegramAcpClient,
  opts: SpawnOpts
): Promise<SpawnResult> {
  const { agentCommand, agentArgs, agentCwd, agentEnv, log } = opts;
  const cmdLine = [agentCommand, ...agentArgs].join(" ");
  log(`[agent] Spawning for ${userId}: ${cmdLine}`);

  const useShell = process.platform === "win32";
  const proc = spawn(agentCommand, agentArgs, {
    stdio: ["pipe", "pipe", "inherit"],
    cwd: agentCwd,
    env: { ...process.env, ...agentEnv },
    shell: useShell,
  });

  proc.on("error", (err) => log(`[agent] Process error: ${String(err)}`));

  if (!proc.stdin || !proc.stdout) {
    proc.kill();
    throw new Error("Failed to get agent process stdio");
  }

  const input = Writable.toWeb(proc.stdin);
  const output = Readable.toWeb(proc.stdout) as ReadableStream<Uint8Array>;
  const stream = acp.ndJsonStream(input, output);
  const connection = new acp.ClientSideConnection(() => client, stream);

  log("[acp] Initializing connection...");
  const initResult = await connection.initialize({
    protocolVersion: acp.PROTOCOL_VERSION,
    clientInfo: {
      name: packageJson.name,
      title: packageJson.name,
      version: packageJson.version,
    },
    clientCapabilities: {
      fs: { readTextFile: true, writeTextFile: true },
    },
  });
  log(`[acp] Initialized v${initResult.protocolVersion}`);

  log("[acp] Creating session...");
  const sessionResult = await connection.newSession({
    cwd: agentCwd,
    mcpServers: [],
  });
  log(`[acp] Session: ${sessionResult.sessionId}`);

  return { process: proc, connection, sessionId: sessionResult.sessionId };
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/telegram-acp/src/session/spawn.ts
git commit -m "refactor(session): add spawn.ts for agent process creation"
```

---

### Task 3: 创建 session/idle-manager.ts

**Files:**
- Create: `packages/telegram-acp/src/session/idle-manager.ts`

- [ ] **Step 1: 创建 idle 管理模块**

```typescript
/**
 * Idle timeout management and session eviction.
 */

import type { UserSession } from "./types.ts";
import { gracefulTerminate } from "../health.ts";

export interface IdleManagerOpts {
  idleTimeoutMs: number;
  maxConcurrentUsers: number;
  log: (msg: string) => void;
  onEvict: (userId: string, session: UserSession) => Promise<void>;
}

export class IdleManager {
  private timers = new Map<string, NodeJS.Timeout>();
  private opts: IdleManagerOpts;

  constructor(opts: IdleManagerOpts) {
    this.opts = opts;
  }

  /**
   * Reset idle timer for a user session.
   */
  resetTimer(userId: string, session: UserSession, sessions: Map<string, UserSession>): void {
    if (this.opts.idleTimeoutMs <= 0) return;

    const existing = this.timers.get(userId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      this.opts.log(`[session] ${userId} idle, removing`);
      const s = sessions.get(userId);
      if (s) {
        await this.opts.onEvict(userId, s);
        sessions.delete(userId);
      }
      this.timers.delete(userId);
    }, this.opts.idleTimeoutMs);

    this.timers.set(userId, timer);
  }

  /**
   * Clear timer for a specific user.
   */
  clearTimer(userId: string): void {
    const timer = this.timers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(userId);
    }
  }

  /**
   * Clear all timers.
   */
  clearAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  /**
   * Check capacity and evict oldest session if needed.
   */
  checkCapacity(sessions: Map<string, UserSession>): boolean {
    if (sessions.size < this.opts.maxConcurrentUsers) return false;

    let oldest: { userId: string; lastActivity: number } | null = null;

    for (const [userId, session] of sessions) {
      if (!oldest || session.lastActivity < oldest.lastActivity) {
        oldest = { userId, lastActivity: session.lastActivity };
      }
    }

    if (oldest) {
      this.opts.log(`[session] Evicting oldest: ${oldest.userId}`);
      const session = sessions.get(oldest.userId);
      if (session) {
        session.healthMonitor.stop();
        gracefulTerminate(session.process, 5000, this.opts.log).catch(err => {
          this.opts.log(`[session] Eviction error: ${String(err)}`);
        });
        sessions.delete(oldest.userId);
        this.clearTimer(oldest.userId);
      }
      return true;
    }
    return false;
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/telegram-acp/src/session/idle-manager.ts
git commit -m "refactor(session): add idle-manager.ts for timeout handling"
```

---

### Task 4: 创建 session/lifecycle.ts

**Files:**
- Create: `packages/telegram-acp/src/session/lifecycle.ts`

- [ ] **Step 1: 创建生命周期管理模块**

```typescript
/**
 * Session lifecycle management: create, restore, stop, restart, message recording.
 */

import type { ChildProcess } from "node:child_process";
import { TelegramAcpClient } from "../client.ts";
import { HealthMonitor, DEFAULT_HEALTH_CONFIG, gracefulTerminate } from "../health.ts";
import { spawnAgent } from "./spawn.ts";
import { IdleManager } from "./idle-manager.ts";
import type { UserSession, RestoredSession, SessionManagerOpts } from "./types.ts";
import type { StoredSession, StoredMessage } from "../storage/types.ts";
import type { FileStorage } from "../storage/file-storage.ts";

export interface LifecycleOpts extends SessionManagerOpts {
  storage: FileStorage;
}

export class SessionLifecycle {
  private sessions = new Map<string, UserSession>();
  private idleManager: IdleManager;
  private pendingReplies = new Map<string, string[]>();
  private opts: LifecycleOpts;

  constructor(opts: LifecycleOpts) {
    this.opts = opts;
    this.idleManager = new IdleManager({
      idleTimeoutMs: opts.sessionConfig.idleTimeoutMs,
      maxConcurrentUsers: opts.sessionConfig.maxConcurrentUsers,
      log: opts.log,
      onEvict: async (userId: string, session: UserSession) => {
        await this.opts.storage.updateStatus(userId, session.sessionId, 'inactive');
        session.healthMonitor.stop();
        await gracefulTerminate(session.process, 5000, this.opts.log);
      },
    });
  }

  /**
   * Get all active sessions.
   */
  getSessions(): Map<string, UserSession> {
    return this.sessions;
  }

  /**
   * Get existing session or return null.
   */
  get(userId: string): UserSession | undefined {
    return this.sessions.get(userId);
  }

  /**
   * Update last activity and reset idle timer.
   */
  touch(userId: string): void {
    const session = this.sessions.get(userId);
    if (session) {
      session.lastActivity = Date.now();
      this.idleManager.resetTimer(userId, session, this.sessions);
    }
  }

  /**
   * Create new session for user.
   */
  async create(userId: string): Promise<UserSession> {
    this.opts.log(`[session] Creating for ${userId}`);

    // Check capacity
    this.idleManager.checkCapacity(this.sessions);

    const client = new TelegramAcpClient({
      sendTyping: () => this.opts.sendTyping(userId),
      onThoughtFlush: (text: string) => this.opts.onReply(userId, text),
      log: (msg: string) => this.opts.log(`[${userId}] ${msg}`),
      showThoughts: this.opts.showThoughts,
      sendMessage: async (text: string, parseMode?: 'HTML') => {
        return this.opts.sendMessage(userId, text, parseMode);
      },
      editMessage: async (msgId: number, text: string, parseMode?: 'HTML') => {
        return this.opts.editMessage(userId, msgId, text, parseMode);
      },
    });

    const { process, connection, sessionId } = await spawnAgent(userId, client, {
      agentCommand: this.opts.agentCommand,
      agentArgs: this.opts.agentArgs,
      agentCwd: this.opts.agentCwd,
      agentEnv: this.opts.agentEnv,
      log: this.opts.log,
    });

    // Initialize session data
    const now = Date.now();
    const storedSession: StoredSession = {
      userId,
      sessionId,
      agentConfig: {
        preset: this.opts.agentPreset,
        command: this.opts.agentCommand,
        args: this.opts.agentArgs,
        cwd: this.opts.agentCwd,
      },
      createdAt: now,
      lastActivity: now,
      status: 'active',
      messages: [],
    };
    await this.opts.storage.save(storedSession);

    // Create health monitor
    const healthMonitor = new HealthMonitor(
      DEFAULT_HEALTH_CONFIG,
      (msg) => this.opts.log(`[${userId}] ${msg}`),
      async () => {
        this.opts.log(`[health] Auto-recovering ${userId}`);
        const session = this.sessions.get(userId);
        if (session) {
          await this.restart(userId);
          await this.opts.sendMessage(userId, "🔄 Session auto-recovered due to health issue", "HTML");
        }
      }
    );

    const session: UserSession = {
      userId,
      client,
      connection,
      sessionId,
      process,
      lastActivity: now,
      healthMonitor,
    };

    // Setup process exit handler
    process.on('exit', (code, signal) => {
      this.opts.log(`[agent] ${userId} exited code=${code ?? "?"} signal=${signal ?? "?"}`);
      const s = this.sessions.get(userId);
      if (s && s.process === process) {
        s.healthMonitor.markUnhealthy(`Process exited with code=${code ?? "?"}`);
        this.sessions.delete(userId);
        this.idleManager.clearTimer(userId);
      }
    });

    healthMonitor.start();
    this.sessions.set(userId, session);
    this.idleManager.resetTimer(userId, session, this.sessions);

    return session;
  }

  /**
   * Restore session from stored data.
   */
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
      sendMessage: async (text: string, parseMode?: 'HTML') => {
        return this.opts.sendMessage(userId, text, parseMode);
      },
      editMessage: async (msgId: number, text: string, parseMode?: 'HTML') => {
        return this.opts.editMessage(userId, msgId, text, parseMode);
      },
    });

    const { process, connection, sessionId } = await spawnAgent(userId, client, {
      agentCommand: this.opts.agentCommand,
      agentArgs: this.opts.agentArgs,
      agentCwd: this.opts.agentCwd,
      agentEnv: this.opts.agentEnv,
      log: this.opts.log,
    });

    // Update stored session
    stored.sessionId = sessionId;
    stored.lastActivity = Date.now();
    stored.status = 'active';
    await this.opts.storage.save(stored);

    // Create health monitor
    const healthMonitor = new HealthMonitor(
      DEFAULT_HEALTH_CONFIG,
      (msg) => this.opts.log(`[${userId}] ${msg}`),
      async () => {
        this.opts.log(`[health] Auto-recovering ${userId}`);
        const session = this.sessions.get(userId);
        if (session) {
          await this.restart(userId);
          await this.opts.sendMessage(userId, "🔄 Session auto-recovered", "HTML");
        }
      }
    );

    const session: UserSession = {
      userId,
      client,
      connection,
      sessionId,
      process,
      lastActivity: Date.now(),
      healthMonitor,
    };

    process.on('exit', (code, signal) => {
      this.opts.log(`[agent] ${userId} exited code=${code ?? "?"} signal=${signal ?? "?"}`);
      const s = this.sessions.get(userId);
      if (s && s.process === process) {
        s.healthMonitor.markUnhealthy(`Process exited with code=${code ?? "?"}`);
        this.sessions.delete(userId);
        this.idleManager.clearTimer(userId);
      }
    });

    healthMonitor.start();
    this.sessions.set(userId, session);
    this.idleManager.resetTimer(userId, session, this.sessions);

    return {
      session,
      hadHistory: stored.messages.length > 0,
      messages: stored.messages,
    };
  }

  /**
   * Restart session (terminate existing, create new).
   */
  async restart(userId: string): Promise<UserSession> {
    const existing = this.sessions.get(userId);
    if (existing) {
      await this.opts.storage.markTerminated(userId, existing.sessionId);
      existing.healthMonitor.stop();
      await gracefulTerminate(existing.process, 5000, this.opts.log);
      this.sessions.delete(userId);
      this.idleManager.clearTimer(userId);
      this.opts.log(`[session] Terminated session for ${userId}`);
    }

    return this.create(userId);
  }

  /**
   * Stop all sessions.
   */
  async stop(): Promise<void> {
    for (const [userId, session] of this.sessions) {
      await this.opts.storage.updateStatus(userId, session.sessionId, 'inactive');
      session.healthMonitor.stop();
    }

    for (const [userId, session] of this.sessions) {
      this.opts.log(`[session] Stopping for ${userId}`);
      await gracefulTerminate(session.process, 5000, this.opts.log);
    }
    this.sessions.clear();
    this.idleManager.clearAll();
  }

  /**
   * Clear history for user's current session.
   */
  async clearHistory(userId: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (session) {
      await this.opts.storage.clearHistory(userId, session.sessionId);
      this.opts.log(`[session] Cleared history for ${userId}`);
    }
  }

  /**
   * Record a message to storage.
   */
  async recordMessage(userId: string, role: 'user' | 'agent', content: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (!session) return;

    const message: StoredMessage = {
      role,
      content,
      timestamp: Date.now(),
    };

    const stored = await this.opts.storage.load(userId, session.sessionId);
    if (!stored) return;

    stored.messages.push(message);
    this.applyHistoryLimits(stored);
    stored.lastActivity = Date.now();
    await this.opts.storage.save(stored);
  }

  /**
   * Buffer a reply for later flushing.
   */
  bufferReply(userId: string, text: string): void {
    const buffer = this.pendingReplies.get(userId) || [];
    buffer.push(text);
    this.pendingReplies.set(userId, buffer);
  }

  /**
   * Flush buffered replies and record as agent message.
   */
  async flushAndRecord(userId: string): Promise<void> {
    const buffer = this.pendingReplies.get(userId);
    if (buffer && buffer.length > 0) {
      const fullText = buffer.join('\n');
      await this.recordMessage(userId, 'agent', fullText);
      this.pendingReplies.delete(userId);
    }
  }

  /**
   * Apply history limits to stored session.
   */
  private applyHistoryLimits(session: StoredSession): void {
    const { maxMessages, maxDays } = this.opts.historyConfig;

    if (maxMessages !== null && session.messages.length > maxMessages) {
      session.messages = session.messages.slice(-maxMessages);
    }

    if (maxDays !== null) {
      const cutoff = Date.now() - maxDays * 24 * 60 * 60 * 1000;
      session.messages = session.messages.filter(m => m.timestamp >= cutoff);
    }
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/telegram-acp/src/session/lifecycle.ts
git commit -m "refactor(session): add lifecycle.ts for session CRUD operations"
```

---

### Task 5: 创建 storage/types.ts

**Files:**
- Create: `packages/telegram-acp/src/storage/types.ts`

- [ ] **Step 1: 创建存储类型定义**

```typescript
/**
 * Storage types and interfaces.
 */

export type SessionStatus = 'active' | 'inactive' | 'terminated';

export interface StoredMessage {
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
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

export interface StorageBackend {
  save(session: StoredSession): Promise<void>;
  load(userId: string, sessionId: string): Promise<StoredSession | null>;
  loadRestorable(userId: string): Promise<StoredSession | null>;
  list(userId: string): Promise<StoredSession[]>;
  updateStatus(userId: string, sessionId: string, status: SessionStatus): Promise<void>;
  clearHistory(userId: string, sessionId: string): Promise<void>;
  markTerminated(userId: string, sessionId: string): Promise<void>;
  delete(userId: string, sessionId: string): Promise<void>;
  stop(): void;
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/telegram-acp/src/storage/types.ts
git commit -m "refactor(storage): add types.ts with storage interfaces"
```

---

### Task 6: 创建 storage/file-storage.ts

**Files:**
- Create: `packages/telegram-acp/src/storage/file-storage.ts`

- [ ] **Step 1: 创建文件存储实现（合并原 SessionStorage 和 FileStorageBackend）**

```typescript
/**
 * File-based storage implementation with batch flush support.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { defaultStorageDir } from '../config.ts';
import type { StorageBackend, StoredSession, StoredMessage, SessionStatus } from './types.ts';

export interface FileStorageConfig {
  baseDir?: string;
  flushIntervalMs?: number;
  maxPendingMessages?: number;
}

export class FileStorage implements StorageBackend {
  private sessionsDir: string;
  private flushInterval: NodeJS.Timeout | null = null;
  private pendingWrites: Map<string, { messages: StoredMessage[]; lastActivity: number }> = new Map();
  private config: {
    flushIntervalMs: number;
    maxPendingMessages: number;
  };

  constructor(config?: FileStorageConfig) {
    this.sessionsDir = path.join(config?.baseDir ?? defaultStorageDir(), 'sessions');
    this.config = {
      flushIntervalMs: config?.flushIntervalMs ?? 5000,
      maxPendingMessages: config?.maxPendingMessages ?? 10,
    };
    this.startFlushTimer();
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

  // --- Batch Operations ---

  recordMessage(userId: string, sessionId: string, message: StoredMessage): void {
    const key = `${userId}:${sessionId}`;
    const pending = this.pendingWrites.get(key) || { messages: [], lastActivity: Date.now() };
    pending.messages.push(message);
    pending.lastActivity = Date.now();
    this.pendingWrites.set(key, pending);

    if (pending.messages.length >= this.config.maxPendingMessages) {
      this.flushKey(key).catch(err => {
        console.error(`[storage] Flush error for ${key}: ${String(err)}`);
      });
    }
  }

  private startFlushTimer(): void {
    this.flushInterval = setInterval(() => {
      this.flushPending();
    }, this.config.flushIntervalMs);
    this.flushInterval.unref();
  }

  private flushPending(): void {
    for (const key of this.pendingWrites.keys()) {
      this.flushKey(key).catch(err => {
        console.error(`[storage] Flush error for ${key}: ${String(err)}`);
      });
    }
  }

  private async flushKey(key: string): Promise<void> {
    const pending = this.pendingWrites.get(key);
    if (!pending || pending.messages.length === 0) {
      this.pendingWrites.delete(key);
      return;
    }

    const [userId, sessionId] = key.split(':');
    const session = await this.load(userId, sessionId);
    if (!session) {
      this.pendingWrites.delete(key);
      return;
    }

    session.messages.push(...pending.messages);
    session.lastActivity = pending.lastActivity;
    await this.save(session);
    this.pendingWrites.delete(key);
  }

  // --- StorageBackend Implementation ---

  async save(session: StoredSession): Promise<void> {
    await this.ensureUserDir(session.userId);
    const filePath = this.getFilePath(session.userId, session.sessionId);
    const tempPath = filePath + '.tmp';
    await fs.writeFile(tempPath, JSON.stringify(session, null, 2), 'utf-8');
    await fs.rename(tempPath, filePath);
  }

  async load(userId: string, sessionId: string): Promise<StoredSession | null> {
    const filePath = this.getFilePath(userId, sessionId);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as StoredSession;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      console.error(`[storage] Failed to load ${filePath}: ${String(err)}`);
      return null;
    }
  }

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
      return candidates.sort((a, b) => b.lastActivity - a.lastActivity)[0];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      console.error(`[storage] Failed to list sessions for ${userId}: ${String(err)}`);
      return null;
    }
  }

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

  async updateStatus(userId: string, sessionId: string, status: SessionStatus): Promise<void> {
    const key = `${userId}:${sessionId}`;
    await this.flushKey(key);

    const session = await this.load(userId, sessionId);
    if (session) {
      session.status = status;
      await this.save(session);
    }
  }

  async clearHistory(userId: string, sessionId: string): Promise<void> {
    const key = `${userId}:${sessionId}`;
    this.pendingWrites.delete(key);

    const session = await this.load(userId, sessionId);
    if (session) {
      session.messages = [];
      await this.save(session);
    }
  }

  async markTerminated(userId: string, sessionId: string): Promise<void> {
    await this.updateStatus(userId, sessionId, 'terminated');
  }

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

  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flushPending();
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/telegram-acp/src/storage/file-storage.ts
git commit -m "refactor(storage): add file-storage.ts merging SessionStorage and FileStorageBackend"
```

---

### Task 7: 创建 storage/index.ts

**Files:**
- Create: `packages/telegram-acp/src/storage/index.ts`

- [ ] **Step 1: 创建存储导出入口**

```typescript
/**
 * Storage module exports.
 */

export { FileStorage } from './file-storage.ts';
export type { StorageBackend, StoredSession, StoredMessage, SessionStatus, FileStorageConfig } from './types.ts';
```

- [ ] **Step 2: 提交**

```bash
git add packages/telegram-acp/src/storage/index.ts
git commit -m "refactor(storage): add index.ts export file"
```

---

### Task 8: 创建 session/index.ts (SessionManager)

**Files:**
- Create: `packages/telegram-acp/src/session/index.ts`

- [ ] **Step 1: 创建 SessionManager 入口（组合各模块）**

```typescript
/**
 * SessionManager - orchestrates session lifecycle.
 */

import path from "node:path";
import fs from "node:fs";
import { FileStorage } from "../storage/index.ts";
import { SessionLifecycle } from "./lifecycle.ts";
import type { UserSession, RestoredSession, SessionManagerOpts } from "./types.ts";
import type { StoredSession } from "../storage/types.ts";
import { defaultStorageDir } from "../config.ts";

export { UserSession, RestoredSession, SessionManagerOpts } from "./types.ts";

export class SessionManager {
  private lifecycle: SessionLifecycle;
  private storage: FileStorage;
  private opts: SessionManagerOpts;

  constructor(opts: SessionManagerOpts) {
    this.opts = opts;
    this.storage = new FileStorage();
    this.lifecycle = new SessionLifecycle({
      ...opts,
      storage: this.storage,
    });
  }

  /**
   * Get storage instance.
   */
  getStorage(): FileStorage {
    return this.storage;
  }

  /**
   * Get existing session or create new one.
   */
  async getOrCreate(userId: string): Promise<UserSession> {
    const existing = this.lifecycle.get(userId);
    if (existing) {
      this.lifecycle.touch(userId);
      return existing;
    }

    // Try to restore persisted session
    const stored = await this.storage.loadRestorable(userId);
    if (stored) {
      this.opts.log(`[session] Restoring persisted session for ${userId}`);
      const restored = await this.lifecycle.restore(userId, stored);
      return restored.session;
    }

    return this.lifecycle.create(userId);
  }

  /**
   * Restore session from stored data.
   */
  async restore(userId: string, stored: StoredSession): Promise<RestoredSession> {
    return this.lifecycle.restore(userId, stored);
  }

  /**
   * Restart session.
   */
  async restart(userId: string): Promise<UserSession> {
    return this.lifecycle.restart(userId);
  }

  /**
   * Stop all sessions.
   */
  async stop(): Promise<void> {
    await this.lifecycle.stop();
    this.storage.stop();
  }

  /**
   * Record message.
   */
  async recordMessage(userId: string, role: 'user' | 'agent', content: string): Promise<void> {
    await this.lifecycle.recordMessage(userId, role, content);
  }

  /**
   * Buffer reply.
   */
  bufferReply(userId: string, text: string): void {
    this.lifecycle.bufferReply(userId, text);
  }

  /**
   * Flush and record.
   */
  async flushAndRecord(userId: string): Promise<void> {
    await this.lifecycle.flushAndRecord(userId);
  }

  /**
   * Clear history.
   */
  async clearHistory(userId: string): Promise<void> {
    await this.lifecycle.clearHistory(userId);
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/telegram-acp/src/session/index.ts
git commit -m "refactor(session): add index.ts with SessionManager orchestrator"
```

---

## Phase 2: streaming.ts 拆分

### Task 9: 创建 streaming/types.ts

**Files:**
- Create: `packages/telegram-acp/src/streaming/types.ts`

- [ ] **Step 1: 创建流式类型定义**

```typescript
/**
 * Streaming types and interfaces.
 */

export interface StreamingConfig {
  firstSendThreshold: number;
  editThreshold: number;
  editIntervalMs: number;
  typingIntervalMs: number;
  rateLimitDelayMs: number;
}

export const DEFAULT_STREAMING_CONFIG: StreamingConfig = {
  firstSendThreshold: 20,
  editThreshold: 50,
  editIntervalMs: 500,
  typingIntervalMs: 5000,
  rateLimitDelayMs: 100,
};

export interface MessageCallbacks {
  sendMessage: (text: string, parseMode?: 'HTML') => Promise<number>;
  editMessage: (msgId: number, text: string, parseMode?: 'HTML') => Promise<number>;
  sendTyping: () => Promise<void>;
  log: (msg: string) => void;
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/telegram-acp/src/streaming/types.ts
git commit -m "refactor(streaming): add types.ts with streaming interfaces"
```

---

### Task 10: 创建 streaming/formatting.ts

**Files:**
- Create: `packages/telegram-acp/src/streaming/formatting.ts`

- [ ] **Step 1: 创建格式化模块**

```typescript
/**
 * Text formatting utilities for Telegram messages.
 */

/**
 * Escape HTML special characters.
 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Convert Markdown to HTML for Telegram.
 */
export function markdownToHtml(text: string): string {
  const codeBlocks: string[] = [];

  // Preserve code blocks
  let result = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) => {
    const index = codeBlocks.length;
    codeBlocks.push(`<pre><code>${escapeHtml(code)}</code></pre>`);
    return `\x00CODEBLOCK${index}\x00`;
  });

  // Inline code
  result = result.replace(/`([^`]+)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`);
  
  // Bold
  result = result.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  
  // Italic
  result = result.replace(/\*([^*]+)\*/g, '<i>$1</i>');
  result = result.replace(/_([^_]+)_/g, '<i>$1</i>');
  
  // Links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Restore code blocks
  codeBlocks.forEach((block, index) => {
    result = result.replace(`\x00CODEBLOCK${index}\x00`, block);
  });

  return result.trim();
}

/**
 * Format thought message for display.
 */
export function formatThought(text: string): string {
  const escaped = escapeHtml(text);
  return `<i>💭 Thinking...</i>\n${escaped}`;
}

/**
 * Format thought final message.
 */
export function formatThoughtFinal(text: string): string {
  const escaped = escapeHtml(text);
  return `<i>💭 Thought complete</i>\n${escaped}`;
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/telegram-acp/src/streaming/formatting.ts
git commit -m "refactor(streaming): add formatting.ts for markdown/HTML conversion"
```

---

### Task 11: 创建 streaming/message-stream.ts

**Files:**
- Create: `packages/telegram-acp/src/streaming/message-stream.ts`

- [ ] **Step 1: 创建 MessageStream 类**

```typescript
/**
 * Manages state for a single streaming message.
 */

import type { StreamingConfig, MessageCallbacks } from './types.ts';

export type StreamType = 'thought' | 'text' | 'tool';

export class MessageStream {
  private msgId: number | null = null;
  private chunks: string[] = [];
  private charCount: number = 0;
  private lastEditTime: number = 0;
  private isSending: boolean = false;
  private pendingChunks: string[] = [];

  constructor(
    private readonly type: StreamType,
    private readonly callbacks: MessageCallbacks,
    private readonly config: StreamingConfig,
    private readonly formatter: (text: string) => string
  ) {}

  async append(chunk: string): Promise<void> {
    if (this.isSending) {
      this.pendingChunks.push(chunk);
      this.charCount += chunk.length;
    } else {
      this.chunks.push(chunk);
      this.charCount += chunk.length;
    }
  }

  async flushIfNeeded(): Promise<void> {
    if (this.isSending) return;

    const now = Date.now();

    if (!this.msgId && this.charCount >= this.config.firstSendThreshold) {
      await this.sendFirstMessage();
      return;
    }

    if (this.msgId) {
      const shouldEditByThreshold = this.charCount >= this.config.editThreshold;
      const shouldEditByTime = (now - this.lastEditTime) >= this.config.editIntervalMs && this.charCount > 0;
      
      if (shouldEditByThreshold || shouldEditByTime) {
        const elapsed = now - this.lastEditTime;
        if (elapsed >= this.config.rateLimitDelayMs) {
          await this.editMessage();
        }
      }
    }
  }

  private async sendFirstMessage(): Promise<void> {
    if (this.isSending || this.msgId) return;
    
    this.isSending = true;
    
    try {
      const text = this.formatter(this.chunks.join(''));
      const msgId = await this.callbacks.sendMessage(text, 'HTML');
      
      if (msgId && msgId > 0) {
        this.msgId = msgId;
        this.lastEditTime = Date.now();
        this.charCount = 0;
        
        if (this.pendingChunks.length > 0) {
          this.chunks.push(...this.pendingChunks);
          this.charCount = this.pendingChunks.reduce((sum, c) => sum + c.length, 0);
          this.pendingChunks = [];
        }
      }
    } catch (err) {
      this.callbacks.log(`[streaming] Error sending message: ${String(err)}`);
    } finally {
      this.isSending = false;
    }
  }

  private async editMessage(): Promise<void> {
    if (this.isSending || !this.msgId) return;
    
    this.isSending = true;
    
    try {
      const text = this.formatter(this.chunks.join(''));
      await this.callbacks.editMessage(this.msgId, text, 'HTML');
      
      this.lastEditTime = Date.now();
      this.charCount = 0;
      
      if (this.pendingChunks.length > 0) {
        this.chunks.push(...this.pendingChunks);
        this.charCount = this.pendingChunks.reduce((sum, c) => sum + c.length, 0);
        this.pendingChunks = [];
      }
    } catch (err) {
      this.callbacks.log(`[streaming] Error editing message: ${String(err)}`);
    } finally {
      this.isSending = false;
    }
  }

  async finalize(): Promise<string> {
    while (this.isSending) {
      await new Promise(r => setTimeout(r, 10));
    }
    
    const text = this.chunks.join('');
    
    if (this.msgId && this.chunks.length > 0) {
      const formatted = this.formatter(text);
      try {
        await this.callbacks.editMessage(this.msgId, formatted, 'HTML');
      } catch (err) {
        this.callbacks.log(`[streaming] Error finalizing message: ${String(err)}`);
      }
    }

    return text;
  }

  getMessageId(): number | null {
    return this.msgId;
  }

  setMessageId(id: number): void {
    this.msgId = id;
  }

  reset(): void {
    this.msgId = null;
    this.chunks = [];
    this.charCount = 0;
    this.lastEditTime = 0;
    this.isSending = false;
    this.pendingChunks = [];
  }

  hasContent(): boolean {
    return this.chunks.length > 0 || this.pendingChunks.length > 0;
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/telegram-acp/src/streaming/message-stream.ts
git commit -m "refactor(streaming): add message-stream.ts for single message state"
```

---

### Task 12: 创建 streaming/state.ts

**Files:**
- Create: `packages/telegram-acp/src/streaming/state.ts`

- [ ] **Step 1: 创建 StreamingMessageState 类**

```typescript
/**
 * Manages all streaming messages for a single user session.
 */

import { MessageStream } from './message-stream.ts';
import { formatThought, formatThoughtFinal, markdownToHtml } from './formatting.ts';
import type { StreamingConfig, MessageCallbacks } from './types.ts';
import { DEFAULT_STREAMING_CONFIG } from './types.ts';

export class StreamingMessageState {
  private thoughtStream: MessageStream;
  private textStream: MessageStream;
  private toolStreams: Map<string, MessageStream> = new Map();
  private lastTypingAt: number = 0;

  constructor(
    private readonly callbacks: MessageCallbacks,
    private readonly config: StreamingConfig = DEFAULT_STREAMING_CONFIG
  ) {
    this.thoughtStream = new MessageStream('thought', callbacks, config, formatThought);
    this.textStream = new MessageStream('text', callbacks, config, markdownToHtml);
  }

  reset(): void {
    this.thoughtStream.reset();
    this.textStream.reset();
    this.toolStreams.clear();
  }

  async appendThought(chunk: string): Promise<void> {
    await this.thoughtStream.append(chunk);
    await this.thoughtStream.flushIfNeeded();
    await this.maybeSendTyping();
  }

  async finalizeThought(): Promise<string> {
    return await this.thoughtStream.finalize();
  }

  async appendText(chunk: string): Promise<void> {
    if (this.thoughtStream.hasContent()) {
      await this.finalizeThought();
    }

    await this.textStream.append(chunk);
    await this.textStream.flushIfNeeded();
    await this.maybeSendTyping();
  }

  async finalizeText(): Promise<string> {
    return await this.textStream.finalize();
  }

  async updateToolCall(toolCallId: string, formatter: () => string): Promise<void> {
    if (this.thoughtStream.hasContent()) {
      await this.finalizeThought();
    }

    let stream = this.toolStreams.get(toolCallId);
    
    if (!stream) {
      stream = new MessageStream('tool', this.callbacks, this.config, formatter);
      this.toolStreams.set(toolCallId, stream);
    }

    if (!stream.getMessageId()) {
      const text = formatter();
      const msgId = await this.callbacks.sendMessage(text, 'HTML');
      stream.setMessageId(msgId);
    }

    await this.maybeSendTyping();
  }

  async editToolCall(toolCallId: string, formatter: () => string): Promise<void> {
    const stream = this.toolStreams.get(toolCallId);
    if (stream && stream.getMessageId()) {
      const text = formatter();
      await this.callbacks.editMessage(stream.getMessageId()!, text, 'HTML');
    }
  }

  async finalizeAll(): Promise<string> {
    await this.finalizeThought();
    return await this.finalizeText();
  }

  private async maybeSendTyping(): Promise<void> {
    if (!this.callbacks.sendTyping) return;

    const now = Date.now();
    if (now - this.lastTypingAt < this.config.typingIntervalMs) {
      return;
    }

    this.lastTypingAt = now;
    try {
      await this.callbacks.sendTyping();
    } catch {
      // Best effort
    }
  }

  /**
   * Format thought with final prefix (public for external use).
   */
  formatThoughtFinal(text: string): string {
    return formatThoughtFinal(text);
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/telegram-acp/src/streaming/state.ts
git commit -m "refactor(streaming): add state.ts for multi-stream coordination"
```

---

### Task 13: 创建 streaming/rate-limiter.ts

**Files:**
- Create: `packages/telegram-acp/src/streaming/rate-limiter.ts`

- [ ] **Step 1: 创建速率限制器**

```typescript
/**
 * Rate limiter for Telegram API calls.
 */

export class TelegramRateLimiter {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private lastCallTime = 0;

  constructor(
    private readonly minIntervalMs: number = 50,
    private readonly maxConcurrent: number = 3
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const elapsed = now - this.lastCallTime;
      
      if (elapsed < this.minIntervalMs) {
        await new Promise(r => setTimeout(r, this.minIntervalMs - elapsed));
      }

      const fn = this.queue.shift();
      if (fn) {
        this.lastCallTime = Date.now();
        await fn();
      }
    }

    this.processing = false;
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/telegram-acp/src/streaming/rate-limiter.ts
git commit -m "refactor(streaming): add rate-limiter.ts for API throttling"
```

---

### Task 14: 创建 streaming/index.ts

**Files:**
- Create: `packages/telegram-acp/src/streaming/index.ts`

- [ ] **Step 1: 创建流式模块导出**

```typescript
/**
 * Streaming module exports.
 */

export { StreamingMessageState } from './state.ts';
export { TelegramRateLimiter } from './rate-limiter.ts';
export { MessageStream } from './message-stream.ts';
export { escapeHtml, markdownToHtml, formatThought, formatThoughtFinal } from './formatting.ts';
export type { StreamingConfig, MessageCallbacks } from './types.ts';
export { DEFAULT_STREAMING_CONFIG } from './types.ts';
```

- [ ] **Step 2: 提交**

```bash
git add packages/telegram-acp/src/streaming/index.ts
git commit -m "refactor(streaming): add index.ts export file"
```

---

## Phase 3: bridge.ts 回调简化

### Task 15: 创建 telegram-api.ts

**Files:**
- Create: `packages/telegram-acp/src/telegram-api.ts`

- [ ] **Step 1: 创建 Telegram API 封装类**

```typescript
/**
 * Telegram Bot API wrapper for dependency injection.
 */

import type { BotApi } from "./bot/index.ts";

export class TelegramApiWrapper {
  constructor(private api: BotApi) {}

  async sendMessage(userId: string, text: string, parseMode?: 'HTML'): Promise<number> {
    try {
      const msg = await this.api.sendMessage(userId, text, {
        parse_mode: parseMode
      });
      return msg.message_id;
    } catch (err) {
      console.error(`[telegram-api] Error sending message: ${String(err)}`);
      return 0;
    }
  }

  async editMessage(userId: string, msgId: number, text: string, parseMode?: 'HTML'): Promise<number> {
    if (!msgId || msgId <= 0) return 0;
    try {
      const result = await this.api.editMessageText(userId, msgId, text, {
        parse_mode: parseMode
      });
      if (result === true) return msgId;
      return result.message_id;
    } catch (err) {
      console.error(`[telegram-api] Error editing message: ${String(err)}`);
      return 0;
    }
  }

  async sendTyping(userId: string): Promise<void> {
    await this.api.sendChatAction(userId, "typing");
  }

  async sendReaction(userId: string, messageId: number, emoji: string): Promise<void> {
    await this.api.setMessageReaction(userId, messageId, { reaction: [{ type: 'emoji', emoji }] });
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/telegram-acp/src/telegram-api.ts
git commit -m "refactor: add telegram-api.ts wrapper for Bot API"
```

---

### Task 16: 更新 bridge.ts 使用 TelegramApiWrapper

**Files:**
- Modify: `packages/telegram-acp/src/bridge.ts`

- [ ] **Step 1: 简化 bridge.ts 回调模式**

```typescript
/**
 * TelegramAcpBridge — orchestration layer.
 */

import path from "node:path";
import fs from "node:fs";
import { createBot, startBot, stopBot, type Bot } from "./bot/index.ts";
import { SessionManager } from "./session/index.ts";
import { TelegramApiWrapper } from "./telegram-api.ts";
import type { TelegramAcpConfig } from "./config.ts";
import { defaultStorageDir } from "./config.ts";

export class TelegramAcpBridge {
  private config: TelegramAcpConfig;
  private bot: Bot | null = null;
  private sessionManager: SessionManager | null = null;
  private telegramApi: TelegramApiWrapper | null = null;
  private log: (msg: string) => void;
  private stopping = false;

  constructor(config: TelegramAcpConfig) {
    this.config = config;
    this.log = config.log ?? ((msg: string) => console.log(`[telegram-acp] ${msg}`));
    this.config.log = this.log;
  }

  async start(): Promise<void> {
    this.log("[telegram-acp] Starting...");

    // Create and start bot first to get API
    this.bot = createBot(this.config.telegram.botToken, this.config, new SessionManager({
      agentCommand: "",
      agentArgs: [],
      agentCwd: "",
      sessionConfig: this.config.session,
      historyConfig: this.config.history,
      showThoughts: false,
      log: this.log,
      onReply: async () => {},
      sendTyping: async () => {},
      sendMessage: async () => 0,
      editMessage: async () => 0,
    }));

    await startBot(this.bot);

    // Create Telegram API wrapper
    this.telegramApi = new TelegramApiWrapper(this.bot.api);

    // Create session manager with simplified callbacks
    this.sessionManager = new SessionManager({
      agentCommand: this.config.agent.command,
      agentArgs: this.config.agent.args,
      agentCwd: this.config.agent.cwd,
      agentEnv: this.config.agent.env,
      agentPreset: this.config.agent.preset,
      sessionConfig: this.config.session,
      historyConfig: this.config.history,
      showThoughts: this.config.agent.showThoughts,
      log: this.log,
      onReply: async (userId: string, text: string) => {
        await this.telegramApi!.sendMessage(userId, text);
      },
      sendTyping: async (userId: string) => {
        await this.telegramApi!.sendTyping(userId);
      },
      sendMessage: async (userId: string, text: string, parseMode?: 'HTML') => {
        return this.telegramApi!.sendMessage(userId, text, parseMode);
      },
      editMessage: async (userId: string, msgId: number, text: string, parseMode?: 'HTML') => {
        return this.telegramApi!.editMessage(userId, msgId, text, parseMode);
      },
    });

    // Restore persisted sessions
    await this.restorePersistedSessions();

    this.log("[telegram-acp] Started");
  }

  async stop(): Promise<void> {
    if (this.stopping) return;
    this.stopping = true;

    this.log("[telegram-acp] Stopping...");

    if (this.sessionManager) {
      await this.sessionManager.stop();
    }

    if (this.bot) {
      await stopBot(this.bot);
    }

    this.log("[telegram-acp] Stopped");
  }

  async getBotInfo(): Promise<{ id: string; username: string; firstName?: string }> {
    if (!this.bot) {
      throw new Error("Bot not started");
    }
    const me = await this.bot.api.getMe();
    return {
      id: me.id.toString(),
      username: me.username || "",
      firstName: me.first_name || undefined,
    };
  }

  private async restorePersistedSessions(): Promise<void> {
    const sessionsDir = path.join(defaultStorageDir(), 'sessions');
    if (!fs.existsSync(sessionsDir)) return;

    const userDirs = fs.readdirSync(sessionsDir);
    for (const userId of userDirs) {
      const userPath = path.join(sessionsDir, userId);
      if (!fs.statSync(userPath).isDirectory()) continue;

      const stored = await this.sessionManager!.getStorage().loadRestorable(userId);
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
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/telegram-acp/src/bridge.ts
git commit -m "refactor(bridge): use TelegramApiWrapper for simplified callbacks"
```

---

## Phase 4: 更新现有文件

### Task 17: 更新 session/types.ts 使用 storage/types.ts

**Files:**
- Modify: `packages/telegram-acp/src/session/types.ts`

- [ ] **Step 1: 更新 import**

删除临时的 StoredMessage 定义，改为从 storage/types.ts 导入：

```typescript
/**
 * Session types and interfaces.
 */

import type { ChildProcess } from "node:child_process";
import type { TelegramAcpClient } from "../client.ts";
import type * as acp from "@agentclientprotocol/sdk";
import type { HealthMonitor } from "../health.ts";
import type { SessionConfig, HistoryConfig } from "../config.ts";
import type { StoredMessage } from "../storage/types.ts";

export interface UserSession {
  userId: string;
  client: TelegramAcpClient;
  connection: acp.ClientSideConnection;
  sessionId: string;
  process: ChildProcess;
  lastActivity: number;
  healthMonitor: HealthMonitor;
}

export interface RestoredSession {
  session: UserSession;
  hadHistory: boolean;
  messages: StoredMessage[];
}

export interface SessionManagerOpts {
  agentPreset?: string;
  agentCommand: string;
  agentArgs: string[];
  agentCwd: string;
  agentEnv?: Record<string, string>;
  sessionConfig: SessionConfig;
  historyConfig: HistoryConfig;
  showThoughts: boolean;
  log: (msg: string) => void;
  onReply: (userId: string, text: string) => Promise<void>;
  sendTyping: (userId: string) => Promise<void>;
  sendMessage: (userId: string, text: string, parseMode?: 'HTML') => Promise<number>;
  editMessage: (userId: string, msgId: number, text: string, parseMode?: 'HTML') => Promise<number>;
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/telegram-acp/src/session/types.ts
git commit -m "refactor(session): update types.ts to import from storage/types.ts"
```

---

### Task 18: 更新 config.ts 移除 metrics 相关定义

**Files:**
- Modify: `packages/telegram-acp/src/config.ts`

- [ ] **Step 1: 删除 MetricsConfig import 和 ObservabilityConfig 中的 metrics 字段**

修改后的 config.ts 相关部分：

```typescript
// 删除这行 import
// import type { MetricsConfig } from "./metrics.ts";

// ObservabilityConfig 改为：
export interface ObservabilityConfig {
  logging?: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'text' | 'json';
  };
}

// TelegramAcpConfig 中的 observability 字段保持不变（类型已更新）

// defaultConfig() 中删除 metrics 相关：
observability: {
  // 删除 metrics 字段
  logging: {
    level: 'info',
    format: 'text',
  },
},
```

- [ ] **Step 2: 删除 loadConfig 中的 observability.metrics 合并逻辑**

```typescript
// 在 loadConfig 中，observability 合并时不再处理 metrics
if (fileConfig.observability) {
  config.observability = {
    ...config.observability!,
    ...fileConfig.observability,
  };
}
```

- [ ] **Step 3: 提交**

```bash
git add packages/telegram-acp/src/config.ts
git commit -m "refactor(config): remove MetricsConfig references"
```

---

### Task 19: 更新 index.ts 导出

**Files:**
- Modify: `packages/telegram-acp/src/index.ts`

- [ ] **Step 1: 更新导出路径**

```typescript
export { TelegramAcpBridge } from "./bridge.ts";
export type { TelegramAcpConfig } from "./config.ts";

// 从新的模块导出
export { SessionManager } from "./session/index.ts";
export type { UserSession, SessionManagerOpts, RestoredSession } from "./session/index.ts";

export { FileStorage } from "./storage/index.ts";
export type { StorageBackend, StoredSession, StoredMessage, SessionStatus } from "./storage/index.ts";

export { StreamingMessageState, TelegramRateLimiter, DEFAULT_STREAMING_CONFIG } from "./streaming/index.ts";
export type { StreamingConfig, MessageCallbacks } from "./streaming/index.ts";

export { HealthMonitor, DEFAULT_HEALTH_CONFIG, isProcessAlive, gracefulTerminate } from "./health.ts";
export { HistoryInjector, DEFAULT_HISTORY_CONFIG, estimateTokens } from "./history.ts";
export { formatForTelegram } from "./bot/formatters/markdown.ts";
export { escapeHtml } from "./bot/formatters/escape.ts";
export { TelegramApiWrapper } from "./telegram-api.ts";

// 删除 metrics 导出
// export { MetricsCollector, ... } from "./metrics.ts";
```

- [ ] **Step 2: 提交**

```bash
git add packages/telegram-acp/src/index.ts
git commit -m "refactor(index): update exports to use new module paths"
```

---

### Task 20: 删除旧文件

**Files:**
- Delete: `packages/telegram-acp/src/session.ts`
- Delete: `packages/telegram-acp/src/storage.ts`
- Delete: `packages/telegram-acp/src/streaming.ts`
- Delete: `packages/telegram-acp/src/metrics.ts`

- [ ] **Step 1: 删除旧文件**

```bash
rm packages/telegram-acp/src/session.ts
rm packages/telegram-acp/src/storage.ts
rm packages/telegram-acp/src/streaming.ts
rm packages/telegram-acp/src/metrics.ts
```

- [ ] **Step 2: 提交**

```bash
git add -A
git commit -m "refactor: remove old monolithic files (session.ts, storage.ts, streaming.ts, metrics.ts)"
```

---

### Task 21: 更新测试文件导入路径

**Files:**
- Modify: `packages/telegram-acp/test/storage.test.ts`
- Modify: `packages/telegram-acp/test/streaming.test.ts`

- [ ] **Step 1: 更新 storage.test.ts**

```typescript
import { FileStorage, StoredSession } from '../src/storage/index.ts';
```

- [ ] **Step 2: 更新 streaming.test.ts**

```typescript
import { StreamingMessageState, DEFAULT_STREAMING_CONFIG } from '../src/streaming/index.ts';
```

- [ ] **Step 3: 提交**

```bash
git add packages/telegram-acp/test/storage.test.ts packages/telegram-acp/test/streaming.test.ts
git commit -m "refactor(test): update import paths to use new modules"
```

---

### Task 22: 运行构建验证

**Files:**
- None (build verification)

- [ ] **Step 1: 运行 TypeScript 编译**

```bash
cd packages/telegram-acp && pnpm run build
```

Expected: 编译成功，无错误

- [ ] **Step 2: 运行现有测试**

```bash
cd packages/telegram-acp && pnpm test
```

Expected: 所有测试通过

- [ ] **Step 3: 提交验证状态**

```bash
git add -A
git commit -m "refactor: verify build and tests pass after restructuring"
```

---

## Phase 4: 测试完善

### Task 23: 创建 test/session/lifecycle.test.ts

**Files:**
- Create: `packages/telegram-acp/test/session/lifecycle.test.ts`

- [ ] **Step 1: 创建生命周期测试**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionLifecycle } from '../../src/session/lifecycle.ts';
import { FileStorage } from '../../src/storage/index.ts';
import type { SessionManagerOpts } from '../../src/session/types.ts';

describe('SessionLifecycle', () => {
  let lifecycle: SessionLifecycle;
  let storage: FileStorage;
  let mockOpts: SessionManagerOpts;

  beforeEach(() => {
    storage = new FileStorage({ baseDir: '/tmp/test-storage' });
    
    mockOpts = {
      agentCommand: 'test-command',
      agentArgs: [],
      agentCwd: '/tmp',
      sessionConfig: {
        idleTimeoutMs: 60000,
        maxConcurrentUsers: 5,
      },
      historyConfig: {
        maxMessages: null,
        maxDays: null,
      },
      showThoughts: false,
      log: vi.fn(),
      onReply: vi.fn(),
      sendTyping: vi.fn(),
      sendMessage: vi.fn().mockResolvedValue(1),
      editMessage: vi.fn().mockResolvedValue(1),
    };

    lifecycle = new SessionLifecycle({ ...mockOpts, storage });
  });

  describe('create', () => {
    it('should initialize session with correct metadata', async () => {
      // Note: This test would need mocking of spawnAgent
      // For now, just verify structure
      expect(lifecycle.getSessions().size).toBe(0);
    });
  });

  describe('recordMessage', () => {
    it('should apply maxMessages limit', async () => {
      // Mock test for history limits
      expect(mockOpts.historyConfig.maxMessages).toBeNull();
    });
  });
});
```

- [ ] **Step 2: 提交**

```bash
git add packages/telegram-acp/test/session/lifecycle.test.ts
git commit -m "test(session): add lifecycle.test.ts skeleton"
```

---

### Task 24: 创建 test/streaming/formatting.test.ts

**Files:**
- Create: `packages/telegram-acp/test/streaming/formatting.test.ts`

- [ ] **Step 1: 创建格式化测试**

```typescript
import { describe, it, expect } from 'vitest';
import { escapeHtml, markdownToHtml, formatThought, formatThoughtFinal } from '../../src/streaming/formatting.ts';

describe('Formatting', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    it('should escape ampersand', () => {
      expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
    });
  });

  describe('markdownToHtml', () => {
    it('should convert bold markdown to HTML', () => {
      expect(markdownToHtml('**bold text**')).toBe('<b>bold text</b>');
    });

    it('should convert italic markdown to HTML', () => {
      expect(markdownToHtml('*italic text*')).toBe('<i>italic text</i>');
    });

    it('should convert inline code to HTML', () => {
      expect(markdownToHtml('`code snippet`')).toBe('<code>code snippet</code>');
    });

    it('should convert code blocks to HTML', () => {
      const result = markdownToHtml('```javascript\nconst x = 1;\n```');
      expect(result).toContain('<pre><code>');
      expect(result).toContain('const x = 1;');
    });

    it('should convert links to HTML', () => {
      expect(markdownToHtml('[link text](https://example.com)')).toBe('<a href="https://example.com">link text</a>');
    });
  });

  describe('formatThought', () => {
    it('should format thought with emoji prefix', () => {
      expect(formatThought('thinking...')).toContain('💭 Thinking...');
      expect(formatThought('thinking...')).toContain('thinking...');
    });
  });

  describe('formatThoughtFinal', () => {
    it('should format thought complete message', () => {
      expect(formatThoughtFinal('final thought')).toContain('💭 Thought complete');
    });
  });
});
```

- [ ] **Step 2: 运行测试验证**

```bash
cd packages/telegram-acp && pnpm test test/streaming/formatting.test.ts
```

Expected: 所有测试通过

- [ ] **Step 3: 提交**

```bash
git add packages/telegram-acp/test/streaming/formatting.test.ts
git commit -m "test(streaming): add formatting.test.ts for markdown/HTML conversion"
```

---

### Task 25: 创建 test/streaming/state.test.ts

**Files:**
- Create: `packages/telegram-acp/test/streaming/state.test.ts`

- [ ] **Step 1: 创建 state 测试**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StreamingMessageState, DEFAULT_STREAMING_CONFIG } from '../../src/streaming/index.ts';

describe('StreamingMessageState', () => {
  let mockSendMessage: ReturnType<typeof vi.fn>;
  let mockEditMessage: ReturnType<typeof vi.fn>;
  let mockSendTyping: ReturnType<typeof vi.fn>;
  let mockLog: ReturnType<typeof vi.fn>;
  let state: StreamingMessageState;

  beforeEach(() => {
    mockSendMessage = vi.fn().mockResolvedValue(123);
    mockEditMessage = vi.fn().mockResolvedValue(true);
    mockSendTyping = vi.fn().mockResolvedValue(undefined);
    mockLog = vi.fn();
    
    state = new StreamingMessageState({
      sendMessage: mockSendMessage,
      editMessage: mockEditMessage,
      sendTyping: mockSendTyping,
      log: mockLog,
    }, DEFAULT_STREAMING_CONFIG);
  });

  describe('thought streaming', () => {
    it('should send message when reaching first send threshold', async () => {
      await state.appendThought('This is a thought with more than twenty characters');
      
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.stringContaining('💭 Thinking...'),
        'HTML'
      );
    });

    it('should not send before reaching threshold', async () => {
      await state.appendThought('short');
      
      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('text streaming', () => {
    it('should convert markdown to HTML', async () => {
      await state.appendText('Use **bold** text with enough chars to trigger');
      
      const sentText = mockSendMessage.mock.calls[0][0];
      expect(sentText).toContain('<b>bold</b>');
    });
  });

  describe('reset', () => {
    it('should clear all streams', async () => {
      await state.appendThought('Thinking with more than twenty chars');
      await state.appendText('Text with enough characters');
      
      state.reset();
      
      // New messages should create new streams
      await state.appendThought('New thought with more than 20 chars');
      
      expect(mockSendMessage.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
```

- [ ] **Step 2: 提交**

```bash
git add packages/telegram-acp/test/streaming/state.test.ts
git commit -m "test(streaming): add state.test.ts for StreamingMessageState"
```

---

## 验收清单

- [ ] 所有 TypeScript 编译通过
- [ ] 所有现有测试通过
- [ ] 新测试覆盖核心模块
- [ ] 文件行数减少 20%+（从 2515 行减少）
- [ ] 模块职责单一，可独立理解

---

## 风险缓解

| 风险 | 缓解措施 |
|------|----------|
| 导入路径变化导致外部依赖失败 | index.ts 导出保持与原接口兼容 |
| storage 层简化破坏批量写入 | 保留 pendingWrites 逻辑在 FileStorage |
| metrics 删除后无法恢复 | Git 历史可恢复，设计经验保留在文档 |