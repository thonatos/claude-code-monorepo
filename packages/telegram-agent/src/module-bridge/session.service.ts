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