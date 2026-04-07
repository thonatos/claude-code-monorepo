/**
 * Storage backend abstraction and optimized persistence.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { defaultStorageDir } from './config.ts';

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

// --- Storage Backend Interface ---

export interface StorageBackend {
  save(session: StoredSession): Promise<void>;
  load(userId: string, sessionId: string): Promise<StoredSession | null>;
  loadRestorable(userId: string): Promise<StoredSession | null>;
  list(userId: string): Promise<StoredSession[]>;
  updateStatus(userId: string, sessionId: string, status: SessionStatus): Promise<void>;
  clearHistory(userId: string, sessionId: string): Promise<void>;
  markTerminated(userId: string, sessionId: string): Promise<void>;
  delete(userId: string, sessionId: string): Promise<void>;
}

// --- File-based Storage Backend ---

export interface FileStorageConfig {
  baseDir?: string;
  flushIntervalMs?: number;     // Batch flush interval (default: 5000ms)
  maxPendingMessages?: number;  // Max pending messages before forced flush (default: 10)
}

export class FileStorageBackend implements StorageBackend {
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
    
    // Start batch flush timer
    this.startFlushTimer();
  }

  /**
   * Stop the flush timer (for cleanup).
   */
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    // Flush remaining pending writes
    this.flushPending();
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

  /**
   * Record message to pending buffer (for batch flush).
   */
  recordMessage(userId: string, sessionId: string, message: StoredMessage): void {
    const key = `${userId}:${sessionId}`;
    const pending = this.pendingWrites.get(key) || { messages: [], lastActivity: Date.now() };
    pending.messages.push(message);
    pending.lastActivity = Date.now();
    this.pendingWrites.set(key, pending);

    // Force flush if threshold reached
    if (pending.messages.length >= this.config.maxPendingMessages) {
      this.flushKey(key).catch(err => {
        console.error(`[storage] Flush error for ${key}: ${String(err)}`);
      });
    }
  }

  /**
   * Start periodic flush timer.
   */
  private startFlushTimer(): void {
    this.flushInterval = setInterval(() => {
      this.flushPending();
    }, this.config.flushIntervalMs);
    
    this.flushInterval.unref();
  }

  /**
   * Flush all pending writes.
   */
  private flushPending(): void {
    for (const key of this.pendingWrites.keys()) {
      this.flushKey(key).catch(err => {
        console.error(`[storage] Flush error for ${key}: ${String(err)}`);
      });
    }
  }

  /**
   * Flush pending writes for a specific key.
   */
  private async flushKey(key: string): Promise<void> {
    const pending = this.pendingWrites.get(key);
    if (!pending || pending.messages.length === 0) {
      this.pendingWrites.delete(key);
      return;
    }

    const [userId, sessionId] = key.split(':');
    
    // Load existing session
    const session = await this.load(userId, sessionId);
    if (!session) {
      this.pendingWrites.delete(key);
      return;
    }

    // Append pending messages
    session.messages.push(...pending.messages);
    session.lastActivity = pending.lastActivity;

    // Save and clear pending
    await this.save(session);
    this.pendingWrites.delete(key);
  }

  // --- Storage Backend Implementation ---

  async save(session: StoredSession): Promise<void> {
    await this.ensureUserDir(session.userId);
    const filePath = this.getFilePath(session.userId, session.sessionId);

    // Atomic write: write to temp file, then rename
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
    // Flush pending first
    const key = `${userId}:${sessionId}`;
    await this.flushKey(key);

    const session = await this.load(userId, sessionId);
    if (session) {
      session.status = status;
      await this.save(session);
    }
  }

  async clearHistory(userId: string, sessionId: string): Promise<void> {
    // Clear pending messages for this session
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
}

// --- Legacy SessionStorage (wraps FileStorageBackend) ---

export class SessionStorage {
  private backend: FileStorageBackend;

  constructor(baseDir?: string) {
    this.backend = new FileStorageBackend({ baseDir });
  }

  /**
   * Get underlying backend for direct access.
   */
  getBackend(): FileStorageBackend {
    return this.backend;
  }

  /**
   * Record message using batch flush.
   */
  async recordMessage(userId: string, sessionId: string, role: 'user' | 'agent', content: string): Promise<void> {
    const message: StoredMessage = {
      role,
      content,
      timestamp: Date.now(),
    };
    this.backend.recordMessage(userId, sessionId, message);
  }

  /**
   * Stop batch flush timer.
   */
  stop(): void {
    this.backend.stop();
  }

  // --- Legacy methods (delegate to backend) ---

  async save(session: StoredSession): Promise<void> {
    return this.backend.save(session);
  }

  async load(userId: string, sessionId: string): Promise<StoredSession | null> {
    return this.backend.load(userId, sessionId);
  }

  async loadRestorable(userId: string): Promise<StoredSession | null> {
    return this.backend.loadRestorable(userId);
  }

  async list(userId: string): Promise<StoredSession[]> {
    return this.backend.list(userId);
  }

  async updateStatus(userId: string, sessionId: string, status: SessionStatus): Promise<void> {
    return this.backend.updateStatus(userId, sessionId, status);
  }

  async clearHistory(userId: string, sessionId: string): Promise<void> {
    return this.backend.clearHistory(userId, sessionId);
  }

  async markTerminated(userId: string, sessionId: string): Promise<void> {
    return this.backend.markTerminated(userId, sessionId);
  }

  async delete(userId: string, sessionId: string): Promise<void> {
    return this.backend.delete(userId, sessionId);
  }
}
