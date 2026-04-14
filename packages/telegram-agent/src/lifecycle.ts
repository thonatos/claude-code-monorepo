import fs from 'fs';
import { LifecycleHookUnit, LifecycleHook, Inject, ArtusInjectEnum } from '@artusx/core';
import type { ArtusApplication } from '@artusx/core';

import { defaultMediaDir } from './constants';
import { BotService } from './module-bot/bot.service';
import { CommandHandler } from './module-bot/command.handler';
import { MessageHandler } from './module-bot/message.handler';

@LifecycleHookUnit()
export default class TelegramAgentLifecycle {
  @Inject(ArtusInjectEnum.Application)
  private readonly app!: ArtusApplication;

  @Inject(BotService)
  private botService!: BotService;
  @Inject(CommandHandler)
  private commandHandler!: CommandHandler;
  @Inject(MessageHandler)
  private messageHandler!: MessageHandler;

  get logger() {
    return this.app.logger;
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

    // Setup all bot handlers
    this.botService.setupHandlers(
      this.commandHandler,
      (ctx) => this.messageHandler.handle(ctx)
    );

    this.logger.info('[telegram-agent] Bot handlers registered');
  }

  @LifecycleHook()
  beforeClose(): void {
    this.logger.info('[telegram-agent] Application shutting down');
  }
}
