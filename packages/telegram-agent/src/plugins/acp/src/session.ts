import path from 'path';
import fs from 'fs';
import { Injectable, ScopeEnum, Inject } from '@artusx/core';
import type { Session, AgentConfig, SessionConfig } from './types';
import { ProcessManager } from './process';
import { InjectEnum } from './constants';

@Injectable({
  id: InjectEnum.SessionManager,
  scope: ScopeEnum.SINGLETON,
})
export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private config: SessionConfig | null = null;
  private storageDir: string | null = null;

  @Inject(InjectEnum.ProcessManager)
  private processManager!: ProcessManager;

  init(config: SessionConfig): void {
    this.config = config;
    this.storageDir = path.join(process.env.HOME || '/tmp', '.telegram-agent', 'sessions');
  }

  async create(userId: string, agentConfig: AgentConfig): Promise<Session> {
    if (!this.config) {
      throw new Error('SessionManager not initialized');
    }

    if (this.sessions.size >= this.config.maxConcurrentUsers) {
      throw new Error('Max concurrent users reached');
    }

    if (!this.storageDir) {
      throw new Error('Storage directory not initialized');
    }

    const sessionDir = path.join(this.storageDir, userId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const agentProcess = await this.processManager.spawnAgent(agentConfig);

    const session: Session = {
      id: `${userId}-${Date.now()}`,
      userId,
      agentProcess,
      status: 'active',
      agentConfig,
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };

    this.sessions.set(userId, session);

    const metadataPath = path.join(sessionDir, `${session.id}.json`);
    await fs.promises.writeFile(metadataPath, JSON.stringify({
      id: session.id,
      userId: session.userId,
      status: session.status,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
    }));

    return session;
  }

  get(userId: string): Session | undefined {
    return this.sessions.get(userId);
  }

  async destroy(userId: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (!session) return;

    if (session.agentProcess) {
      await this.processManager.killProcess(session.agentProcess);
    }

    session.status = 'closed';
    session.agentProcess = null;
    this.sessions.delete(userId);

    if (!this.storageDir) return;

    const sessionDir = path.join(this.storageDir, userId);
    const metadataPath = path.join(sessionDir, `${session.id}.json`);
    if (fs.existsSync(metadataPath)) {
      await fs.promises.writeFile(metadataPath, JSON.stringify({
        id: session.id,
        userId: session.userId,
        status: 'closed',
        createdAt: session.createdAt,
        lastActivityAt: session.lastActivityAt,
      }));
    }
  }

  async restore(userId: string, agentConfig: AgentConfig): Promise<Session | null> {
    if (!this.storageDir) return null;

    const sessionDir = path.join(this.storageDir, userId);
    if (!fs.existsSync(sessionDir)) return null;

    const files = await fs.promises.readdir(sessionDir);
    const latestFile = files.filter(f => f.endsWith('.json')).sort().pop();
    if (!latestFile) return null;

    const metadataPath = path.join(sessionDir, latestFile);
    const metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf-8'));

    if (metadata.status !== 'active') return null;

    return await this.create(userId, agentConfig);
  }

  getAll(): Map<string, Session> {
    return this.sessions;
  }
}
