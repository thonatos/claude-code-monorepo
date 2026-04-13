import { LifecycleHookUnit, LifecycleHook, Inject, ArtusInjectEnum } from '@artusx/core';
import { InjectEnum } from './constants';
import type { SessionManager } from './session';
import type { HistoryManager } from './history';
import path from 'path';

@LifecycleHookUnit()
export default class ACPPlugin {
  @Inject(ArtusInjectEnum.Application)
  private app!: any;

  @Inject(InjectEnum.SessionManager)
  private sessionManager!: SessionManager;

  @Inject(InjectEnum.HistoryManager)
  private historyManager!: HistoryManager;

  @LifecycleHook()
  async willReady(): Promise<void> {
    const config = this.app?.config || {};
    const sessionConfig = config.artusx?.session;

    // Initialize session manager with config
    this.sessionManager.init(sessionConfig);

    // Initialize history manager with config
    const historyDir = path.join(process.env.HOME || '/tmp', '.telegram-agent', 'history');
    this.historyManager.init(
      historyDir,
      config.artusx?.history?.maxMessages,
      config.artusx?.history?.maxDays
    );

    console.log('[acp-plugin] Session and process managers initialized');
  }

  @LifecycleHook()
  async beforeClose(): Promise<void> {
    const sessions = this.sessionManager.getAll();
    for (const [userId] of sessions) {
      await this.sessionManager.destroy(userId);
    }
    console.log('[acp-plugin] All sessions cleaned up');
  }
}
