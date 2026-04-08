// packages/telegram-acp/test/media/temp-manager.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TempFileManager } from '../../src/media/temp-manager.ts';
import fs from 'node:fs';
import path from 'node:path';

describe('TempFileManager', () => {
  let manager: TempFileManager;
  const testBaseDir = '/tmp/telegram-acp-temp-test';

  beforeEach(async () => {
    manager = new TempFileManager(testBaseDir);
    // Create test directory
    await fs.promises.mkdir(testBaseDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup
    try {
      await fs.promises.rm(testBaseDir, { recursive: true });
    } catch {}
  });

  it('should schedule cleanup after delay', async () => {
    const userId = 'user123';
    const userDir = path.join(testBaseDir, userId);
    await fs.promises.mkdir(userDir, { recursive: true });
    await fs.promises.writeFile(path.join(userDir, 'test.jpg'), 'data');

    // Schedule cleanup (100ms delay for testing)
    manager.scheduleCleanup(userId, 100);

    // Verify file still exists immediately
    expect(fs.existsSync(userDir)).toBe(true);

    // Wait for cleanup
    await new Promise(r => setTimeout(r, 150));

    // Verify file is deleted
    expect(fs.existsSync(userDir)).toBe(false);
  });

  it('should not throw when cleanup fails', async () => {
    const userId = 'nonexistent-user';

    // Should not throw error
    await expect(manager.cleanup(userId)).resolves.toBeUndefined();
  });

  it('should return correct user directory path', () => {
    const userDir = manager.getUserDir('user123');
    expect(userDir).toBe(path.join(testBaseDir, 'user123'));
  });
});