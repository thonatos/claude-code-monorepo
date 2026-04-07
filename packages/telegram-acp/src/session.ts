/**
 * Session lifecycle management: spawn agent, manage idle timeout, health checks, cleanup.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { Writable, Readable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";
import { TelegramAcpClient } from "./client.ts";
import { HealthMonitor, DEFAULT_HEALTH_CONFIG, isProcessAlive, gracefulTerminate } from "./health.ts";
import packageJson from "../package.json" with { type: "json" };
import type { SessionConfig, HistoryConfig } from "./config.ts";
import { SessionStorage, type StoredSession, type StoredMessage } from "./storage.ts";

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

export class SessionManager {
  private sessions = new Map<string, UserSession>();
  private timers = new Map<string, NodeJS.Timeout>();
  private opts: SessionManagerOpts;
  private storage: SessionStorage;
  private pendingReplies = new Map<string, string[]>();

  constructor(opts: SessionManagerOpts) {
    this.opts = opts;
    this.storage = new SessionStorage();
  }

  getStorage(): SessionStorage {
    return this.storage;
  }

  /**
   * Get existing session or create new one for user.
   */
  async getOrCreate(userId: string): Promise<UserSession> {
    const existing = this.sessions.get(userId);
    if (existing) {
      existing.lastActivity = Date.now();
      this.resetIdleTimer(userId);
      return existing;
    }

    // Try to restore persisted session
    const stored = await this.storage.loadRestorable(userId);
    if (stored) {
      this.opts.log(`[session] Restoring persisted session for ${userId}`);
      const restored = await this.restore(userId, stored);
      return restored.session;
    }

    // Check capacity and evict if needed
    if (this.sessions.size >= this.opts.sessionConfig.maxConcurrentUsers) {
      this.evictOldest();
    }

    return this.create(userId);
  }

  /**
   * Stop all sessions and cleanup.
   */
  async stop(): Promise<void> {
    // Mark all active sessions as inactive
    for (const [userId, session] of this.sessions) {
      await this.storage.updateStatus(userId, session.sessionId, 'inactive');
      session.healthMonitor.stop();
    }

    // Terminate all processes
    for (const [userId, session] of this.sessions) {
      this.opts.log(`[session] Stopping for ${userId}`);
      await gracefulTerminate(session.process, 5000, this.opts.log);
    }
    this.sessions.clear();

    // Clear timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  /**
   * Record a message to session storage.
   */
  async recordMessage(userId: string, role: 'user' | 'agent', content: string): Promise<void> {
    const stored = await this.storage.loadRestorable(userId);
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
   * Restart session for user (terminate existing, create new).
   */
  async restart(userId: string): Promise<UserSession> {
    const existing = this.sessions.get(userId);
    if (existing) {
      // Mark old session as terminated
      await this.storage.markTerminated(userId, existing.sessionId);
      existing.healthMonitor.stop();
      await gracefulTerminate(existing.process, 5000, this.opts.log);
      this.sessions.delete(userId);
      this.timers.delete(userId);
      this.opts.log(`[session] Terminated session for ${userId}`);
    }

    return this.create(userId);
  }

  /**
   * Clear history for user's current session.
   */
  async clearHistory(userId: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (session) {
      await this.storage.clearHistory(userId, session.sessionId);
      this.opts.log(`[session] Cleared history for ${userId}`);
    }
  }

  // --- Private methods ---

  private async create(userId: string): Promise<UserSession> {
    this.opts.log(`[session] Creating for ${userId}`);

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

    const { process, connection, sessionId } = await this.spawnAgent(userId, client);

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
    await this.storage.save(storedSession);

    // Create health monitor with auto-recovery
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
        // Mark as unhealthy on unexpected exit
        s.healthMonitor.markUnhealthy(`Process exited with code=${code ?? "?"}`);
        this.sessions.delete(userId);
        this.timers.delete(userId);
      }
    });

    // Start health monitoring
    healthMonitor.start();

    this.sessions.set(userId, session);
    this.resetIdleTimer(userId);

    return session;
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
      sendMessage: async (text: string, parseMode?: 'HTML') => {
        return this.opts.sendMessage(userId, text, parseMode);
      },
      editMessage: async (msgId: number, text: string, parseMode?: 'HTML') => {
        return this.opts.editMessage(userId, msgId, text, parseMode);
      },
    });

    const { process, connection, sessionId } = await this.spawnAgent(userId, client);

    // Update stored session with new sessionId
    stored.sessionId = sessionId;
    stored.lastActivity = Date.now();
    stored.status = 'active';
    await this.storage.save(stored);

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
        this.timers.delete(userId);
      }
    });

    healthMonitor.start();
    this.sessions.set(userId, session);
    this.resetIdleTimer(userId);

    return {
      session,
      hadHistory: stored.messages.length > 0,
      messages: stored.messages,
    };
  }

  private async spawnAgent(
    userId: string,
    client: TelegramAcpClient
  ): Promise<{ process: ChildProcess; connection: acp.ClientSideConnection; sessionId: string }> {
    const { agentCommand, agentArgs, agentCwd, agentEnv, log } = this.opts;
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

  private resetIdleTimer(userId: string): void {
    if (this.opts.sessionConfig.idleTimeoutMs <= 0) return;

    const existing = this.timers.get(userId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      this.opts.log(`[session] ${userId} idle, removing`);
      const session = this.sessions.get(userId);
      if (session) {
        // Mark as inactive before removing
        await this.storage.updateStatus(userId, session.sessionId, 'inactive');
        session.healthMonitor.stop();
        await gracefulTerminate(session.process, 5000, this.opts.log);
        this.sessions.delete(userId);
      }
      this.timers.delete(userId);
    }, this.opts.sessionConfig.idleTimeoutMs);

    this.timers.set(userId, timer);
  }

  private evictOldest(): void {
    let oldest: { userId: string; lastActivity: number } | null = null;

    for (const [userId, session] of this.sessions) {
      if (!oldest || session.lastActivity < oldest.lastActivity) {
        oldest = { userId, lastActivity: session.lastActivity };
      }
    }

    if (oldest) {
      this.opts.log(`[session] Evicting oldest: ${oldest.userId}`);
      const session = this.sessions.get(oldest.userId);
      if (session) {
        session.healthMonitor.stop();
        gracefulTerminate(session.process, 5000, this.opts.log).catch(err => {
          this.opts.log(`[session] Eviction error: ${String(err)}`);
        });
        this.sessions.delete(oldest.userId);
        this.timers.delete(oldest.userId);
      }
    }
  }

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
}
