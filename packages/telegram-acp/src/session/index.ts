/**
 * SessionManager - orchestrates session lifecycle.
 */

import path from 'node:path';
import fs from 'node:fs';
import { FileStorage } from '../storage/index.ts';
import { SessionLifecycle } from './lifecycle.ts';
import type { UserSession, RestoredSession, SessionManagerOpts } from './types.ts';
import type { StoredSession } from '../storage/types.ts';
import { defaultStorageDir } from '../config.ts';

export { UserSession, RestoredSession, SessionManagerOpts } from './types.ts';

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
