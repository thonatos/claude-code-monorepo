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