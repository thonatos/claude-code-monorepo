import fs from 'fs';
import { LifecycleHookUnit, LifecycleHook, Inject, ArtusInjectEnum } from '@artusx/core';
import type { ArtusApplication } from '@artusx/core';

import { defaultMediaDir } from './constants';
import type TelegramClient from './plugins/telegram/client';
import { InjectEnum as TelegramInjectEnum } from './plugins/telegram/constants';

@LifecycleHookUnit()
export default class TelegramAgentLifecycle {
  @Inject(ArtusInjectEnum.Application)
  private readonly app!: ArtusApplication;

  @Inject(TelegramInjectEnum.Client)
  private telegramClient!: TelegramClient;

  get logger() {
    return this.app.logger;
  }

  get telegram() {
    return this.telegramClient.getBot();
  }

  @LifecycleHook()
  willReady() {
    // Initialize media storage directory
    const config = this.app.config;
    const tempDir = config?.media?.tempDir || defaultMediaDir();

    // Create directory if not exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      this.logger.info(`[telegram-agent] Created media directory: ${tempDir}`);
    }

    this.logger.info('[telegram-agent] Application ready');
  }


  @LifecycleHook()
  didReady() {
    this.logger.info('[telegram-agent] Application fully ready');
    this.telegram.on('message', (ctx) => {
      this.logger.info(`[telegram-agent] Received message from ${ctx.from?.username || ctx.from?.id}: ${ctx.message.text}`);
    });
  }

  @LifecycleHook()
  beforeClose(): void {
    this.logger.info('[telegram-agent] Application shutting down');
  }
}
