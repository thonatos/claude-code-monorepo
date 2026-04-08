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