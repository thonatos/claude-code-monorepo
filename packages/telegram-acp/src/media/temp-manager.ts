// packages/telegram-acp/src/media/temp-manager.ts
/**
 * Manages temporary media files lifecycle with automatic cleanup.
 */

import fs from 'node:fs';
import path from 'node:path';

export class TempFileManager {
  constructor(private baseDir: string = '/tmp/telegram-acp/media') {}

  scheduleCleanup(userId: string, delayMs: number = 60000): void {
    setTimeout(async () => {
      await this.cleanup(userId);
    }, delayMs);
  }

  async cleanup(userId: string): Promise<void> {
    const userDir = path.join(this.baseDir, userId);

    try {
      if (fs.existsSync(userDir)) {
        await fs.promises.rm(userDir, { recursive: true });
      }
    } catch (err) {
      // Log but don't throw to avoid blocking other cleanup
      console.warn(`[temp-manager] Failed to cleanup ${userDir}: ${String(err)}`);
    }
  }

  getUserDir(userId: string): string {
    return path.join(this.baseDir, userId);
  }
}