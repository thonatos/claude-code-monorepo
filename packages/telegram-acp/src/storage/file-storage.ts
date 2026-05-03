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
      this.flushKey(key).catch((err) => {
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
      this.flushKey(key).catch((err) => {
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
