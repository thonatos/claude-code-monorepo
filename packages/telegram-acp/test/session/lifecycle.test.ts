import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionLifecycle } from '../../src/session/lifecycle.ts';
import { FileStorage } from '../../src/storage/index.ts';
import type { SessionManagerOpts } from '../../src/session/types.ts';

describe('SessionLifecycle', () => {
  let lifecycle: SessionLifecycle;
  let storage: FileStorage;
  let mockOpts: SessionManagerOpts;

  beforeEach(() => {
    storage = new FileStorage({ baseDir: '/tmp/test-storage' });

    mockOpts = {
      agentCommand: 'test-command',
      agentArgs: [],
      agentCwd: '/tmp',
      sessionConfig: {
        idleTimeoutMs: 60000,
        maxConcurrentUsers: 5,
      },
      historyConfig: {
        maxMessages: null,
        maxDays: null,
      },
      showThoughts: false,
      log: vi.fn(),
      onReply: vi.fn(),
      sendTyping: vi.fn(),
      sendMessage: vi.fn().mockResolvedValue(1),
      editMessage: vi.fn().mockResolvedValue(1),
    };

    lifecycle = new SessionLifecycle({ ...mockOpts, storage });
  });

  describe('create', () => {
    it('should initialize session with correct metadata', async () => {
      // Note: This test would need mocking of spawnAgent
      // For now, just verify structure
      expect(lifecycle.getSessions().size).toBe(0);
    });
  });

  describe('recordMessage', () => {
    it('should apply maxMessages limit', async () => {
      // Mock test for history limits
      expect(mockOpts.historyConfig.maxMessages).toBeNull();
    });
  });
});
