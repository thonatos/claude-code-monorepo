/**
 * Storage types and service for session persistence.
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
      // Log parse error but don't throw - return null to allow new session creation
      console.error(`[storage] Failed to load ${filePath}: ${String(err)}`);
      return null;
    }
  }

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
    const session = await this.load(userId, sessionId);
    if (session) {
      session.status = status;
      await this.save(session);
    }
  }

  async clearHistory(userId: string, sessionId: string): Promise<void> {
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