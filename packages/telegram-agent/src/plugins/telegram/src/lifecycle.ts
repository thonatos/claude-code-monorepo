import { LifecycleHookUnit, LifecycleHook, Inject, ArtusInjectEnum } from '@artusx/core';
import { InjectEnum } from './constants';
import type { TelegramClient } from './client';

@LifecycleHookUnit()
export default class TelegramPlugin {
  @Inject(ArtusInjectEnum.Application)
  private app!: any;

  @Inject(InjectEnum.Client)
  private client!: TelegramClient;

  @LifecycleHook()
  async willReady(): Promise<void> {
    const config = this.app?.config || {};
    const botToken = config.artusx?.telegram?.botToken;

    if (!botToken) {
      console.warn('[telegram-plugin] Bot token not configured, skipping initialization');
      return;
    }

    this.client.init(botToken);
    await this.client.start();

    console.log('[telegram-plugin] Bot started successfully');
  }

  @LifecycleHook()
  async beforeClose(): Promise<void> {
    await this.client.stop();
    console.log('[telegram-plugin] Bot stopped');
  }
}
