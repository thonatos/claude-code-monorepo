import fs from 'fs';
import { LifecycleHookUnit, LifecycleHook, Inject, ArtusInjectEnum } from '@artusx/core';
import type { ArtusApplication } from '@artusx/core';

import { defaultMediaDir } from './constants';
import type TelegramClient from './plugins/telegram/client';
import { InjectEnum as TelegramInjectEnum } from './plugins/telegram/constants';
import { BotService } from './module-bot/bot.service';
import { CommandHandler } from './module-bot/command.handler';
import { MessageHandler } from './module-bot/message.handler';

@LifecycleHookUnit()
export default class TelegramAgentLifecycle {
  @Inject(ArtusInjectEnum.Application)
  private readonly app!: ArtusApplication;

  @Inject(TelegramInjectEnum.Client)
  private telegramClient!: TelegramClient;
  @Inject(BotService)
  private botService!: BotService;
  @Inject(CommandHandler)
  private commandHandler!: CommandHandler;
  @Inject(MessageHandler)
  private messageHandler!: MessageHandler;

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

    // Register command handlers
    const COMMANDS = [
      { command: "start", description: "Create or restore session" },
      { command: "help", description: "Show available commands" },
      { command: "status", description: "Show session details" },
      { command: "restart", description: "Restart session" },
      { command: "clear", description: "Clear state" },
    ];

    this.botService.setupCommandHandler("start", (ctx) => this.commandHandler.handleStart(ctx));
    this.botService.setupCommandHandler("help", (ctx) => this.commandHandler.handleHelp(ctx));
    this.botService.setupCommandHandler("status", (ctx) => this.commandHandler.handleStatus(ctx));
    this.botService.setupCommandHandler("restart", (ctx) => this.commandHandler.handleRestart(ctx));
    this.botService.setupCommandHandler("clear", (ctx) => this.commandHandler.handleClear(ctx));

    this.logger.info('[telegram-agent] Command handlers registered');

    // Register message handler to connect Telegram -> ACP Agent
    this.botService.setupMessageHandler((ctx) => this.messageHandler.handle(ctx));
    this.logger.info('[telegram-agent] Message handler registered');

    // Set bot commands menu
    this.botService.setMyCommands(COMMANDS).catch((err) => {
      this.logger.warn(`[telegram-agent] Failed to set commands: ${err.message}`);
    });
  }

  @LifecycleHook()
  beforeClose(): void {
    this.logger.info('[telegram-agent] Application shutting down');
  }
}
