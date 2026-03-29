import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { SessionStorage, StoredSession } from '../src/storage.ts';

describe('SessionStorage', () => {
  let storage: SessionStorage;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `telegram-acp-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    storage = new SessionStorage(testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  const createTestSession = (userId: string, sessionId: string): StoredSession => ({
    userId,
    sessionId,
    agentConfig: {
      preset: 'claude',
      command: 'pnpx',
      args: ['@agentclientprotocol/claude-agent-acp'],
      cwd: '/tmp',
    },
    createdAt: Date.now(),
    lastActivity: Date.now(),
    status: 'active',
    messages: [],
  });

  it('should save and load a session', async () => {
    const session = createTestSession('user123', 'session-abc');
    await storage.save(session);

    const loaded = await storage.load('user123', 'session-abc');
    expect(loaded).not.toBeNull();
    expect(loaded?.userId).toBe('user123');
    expect(loaded?.sessionId).toBe('session-abc');
    expect(loaded?.status).toBe('active');
  });

  it('should return active session from loadActive', async () => {
    const active = createTestSession('user123', 'active-session');
    const inactive = createTestSession('user123', 'inactive-session');
    inactive.status = 'inactive';

    await storage.save(active);
    await storage.save(inactive);

    const loaded = await storage.loadActive('user123');
    expect(loaded).not.toBeNull();
    expect(loaded?.sessionId).toBe('active-session');
  });

  it('should clear history', async () => {
    const session = createTestSession('user123', 'session-abc');
    session.messages.push({ role: 'user', content: 'Hello', timestamp: Date.now() });
    await storage.save(session);

    await storage.clearHistory('user123', 'session-abc');

    const loaded = await storage.load('user123', 'session-abc');
    expect(loaded?.messages).toHaveLength(0);
  });

  it('should update session status', async () => {
    const session = createTestSession('user123', 'session-abc');
    await storage.save(session);

    await storage.updateStatus('user123', 'session-abc', 'inactive');

    const loaded = await storage.load('user123', 'session-abc');
    expect(loaded?.status).toBe('inactive');
  });

  it('should return null for nonexistent session', async () => {
    const loaded = await storage.load('nonexistent', 'no-session');
    expect(loaded).toBeNull();
  });
});