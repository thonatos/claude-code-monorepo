import { LifecycleHookUnit, LifecycleHook, Inject, ArtusInjectEnum, ApplicationLifecycle } from '@artusx/core';
import { InjectEnum } from './constants';
import type TelegramClient from './client';

@LifecycleHookUnit()
export default class TelegramPLifecycle implements ApplicationLifecycle {
  @Inject(ArtusInjectEnum.Application)
  private app!: any;

  @Inject(InjectEnum.Client)
  private client!: TelegramClient;

  @LifecycleHook()
  async willReady() {
    const config = this.app?.config || {};
    const proxy = config?.proxy || '';
    const botToken = config?.telegram?.botToken;
    
    if (!botToken) {
      console.warn('[telegram-plugin] Bot token not configured, skipping initialization');
      return;
    }

    await this.client.init(botToken, proxy);
    await this.client.start();

    console.log('[telegram-plugin] Bot started successfully');
  }

  @LifecycleHook()
  async beforeClose() {
    await this.client.stop();
    console.log('[telegram-plugin] Bot stopped');
  }
}
