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

  it('should return most recent non-terminated session from loadRestorable', async () => {
    const active = createTestSession('user123', 'active-session');
    const inactive = createTestSession('user123', 'inactive-session');
    inactive.status = 'inactive';
    inactive.lastActivity = Date.now() + 1000; // More recent

    const terminated = createTestSession('user123', 'terminated-session');
    terminated.status = 'terminated';
    terminated.lastActivity = Date.now() + 2000; // Most recent but terminated

    await storage.save(active);
    await storage.save(inactive);
    await storage.save(terminated);

    const loaded = await storage.loadRestorable('user123');
    expect(loaded).not.toBeNull();
    // Should return inactive (most recent non-terminated)
    expect(loaded?.sessionId).toBe('inactive-session');
  });

  it('should return null from loadRestorable when all sessions are terminated', async () => {
    const terminated = createTestSession('user123', 'terminated-session');
    terminated.status = 'terminated';
    await storage.save(terminated);

    const loaded = await storage.loadRestorable('user123');
    expect(loaded).toBeNull();
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