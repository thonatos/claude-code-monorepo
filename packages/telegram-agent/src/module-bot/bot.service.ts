import type { ArtusApplication } from '@artusx/core';
import { ArtusInjectEnum, Inject, Injectable, ScopeEnum } from '@artusx/core';
import type { Context } from 'grammy';
import { InputFile } from 'grammy';
import type TelegramClient from '../plugins/telegram/client';
import { InjectEnum as TelegramInjectEnum } from '../plugins/telegram/constants';
import type { ReactionPhase, SendMessageOptions } from '../types';
import type { CommandHandler } from './command.handler';
import { ReactionService } from './reaction.service';

@Injectable({
  scope: ScopeEnum.SINGLETON,
})
export class BotService {
  @Inject(ArtusInjectEnum.Application)
  private app!: ArtusApplication;

  @Inject(TelegramInjectEnum.Client)
  private telegramClient!: TelegramClient;

  @Inject(ReactionService)
  private reactionService!: ReactionService;

  private get logger() {
    return this.app.logger;
  }

  private readonly COMMANDS = [
    { command: 'start', description: 'Create or restore session' },
    { command: 'help', description: 'Show available commands' },
    { command: 'status', description: 'Show session details' },
    { command: 'restart', description: 'Restart session' },
    { command: 'clear', description: 'Clear state' },
  ];

  async sendMessage(userId: string, text: string, options?: SendMessageOptions): Promise<number> {
    const bot = this.telegramClient.getBot();
    const result = await bot.api.sendMessage(userId, text, {
      parse_mode: options?.parseMode,
    });
    return result.message_id;
  }

  async sendPhoto(userId: string, filePath: string): Promise<number> {
    const bot = this.telegramClient.getBot();
    const result = await bot.api.sendPhoto(userId, new InputFile(filePath));
    return result.message_id;
  }

  async sendAudio(userId: string, filePath: string): Promise<number> {
    const bot = this.telegramClient.getBot();
    const result = await bot.api.sendAudio(userId, new InputFile(filePath));
    return result.message_id;
  }

  async editMessage(userId: string, messageId: number, text: string, options?: SendMessageOptions): Promise<void> {
    const bot = this.telegramClient.getBot();
    await bot.api.editMessageText(userId, messageId, text, {
      parse_mode: options?.parseMode,
    });
  }

  async sendReaction(userId: string, messageId: number, phase: ReactionPhase = 'thought'): Promise<void> {
    await this.reactionService.sendReaction(userId, messageId, phase);
  }

  async removeReaction(userId: string, messageId: number): Promise<void> {
    await this.reactionService.clearReaction(userId, messageId);
  }

  async sendTyping(userId: string): Promise<void> {
    const bot = this.telegramClient.getBot();
    await bot.api.sendChatAction(userId, 'typing');
  }

  async downloadFile(fileId: string): Promise<string> {
    const bot = this.telegramClient.getBot();
    const file = await bot.api.getFile(fileId);
    return file.file_path || '';
  }

  /**
   * Setup all handlers (commands + messages) for the bot.
   */
  setupHandlers(commandHandler: CommandHandler, messageHandler: (ctx: Context) => Promise<void>): void {
    const bot = this.telegramClient.getBot();

    // Register command handlers
    bot.command('start', (ctx) => commandHandler.handleStart(ctx));
    bot.command('help', (ctx) => commandHandler.handleHelp(ctx));
    bot.command('status', (ctx) => commandHandler.handleStatus(ctx));
    bot.command('restart', (ctx) => commandHandler.handleRestart(ctx));
    bot.command('clear', (ctx) => commandHandler.handleClear(ctx));

    // Register message handler
    bot.on('message', messageHandler);

    // Set command menu
    bot.api.setMyCommands(this.COMMANDS, { scope: { type: 'all_private_chats' } }).catch((err) => {
      this.logger.warn(`[bot] Failed to set commands: ${err.message}`);
    });
  }
}
