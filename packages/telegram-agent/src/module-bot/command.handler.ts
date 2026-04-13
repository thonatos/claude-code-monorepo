import { Injectable, Inject } from '@artusx/core';
import type { Context } from 'grammy';
import { BotService } from './bot.service';
import { BridgeService } from '../module-bridge/bridge.service';

@Injectable()
export class CommandHandler {
  @Inject(BotService)
  botService!: BotService;

  @Inject(BridgeService)
  bridgeService!: BridgeService;

  async handleStart(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    await this.botService.sendMessage(userId, 'Welcome to Telegram Agent! Use /status to check connection.');
  }

  async handleStatus(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    await this.botService.sendMessage(userId, 'Agent is ready. Send a message to start chatting.');
  }

  async handleRestart(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    await this.bridgeService.close();
    await this.botService.sendMessage(userId, 'Session closed. Send a message to start new session.');
  }

  async handleClear(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    await this.botService.sendMessage(userId, 'History cleared.');
  }
}
