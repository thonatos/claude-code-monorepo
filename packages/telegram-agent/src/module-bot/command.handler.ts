import { Injectable, Inject } from '@artusx/core';
import type { Context } from 'grammy';
import { BotService } from './bot.service';
import { SessionManager } from '../plugins/acp/src/session';

@Injectable()
export class CommandHandler {
  @Inject(BotService)
  botService!: BotService;

  @Inject(SessionManager)
  sessionManager!: SessionManager;

  async handleStart(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    await this.botService.sendMessage(userId, 'Welcome to Telegram Agent! Use /status to check session.');
  }

  async handleStatus(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const session = this.sessionManager.get(userId);
    if (!session) {
      await this.botService.sendMessage(userId, 'No active session. Send a message to start.');
      return;
    }

    const status = `Session: ${session.id}\nStatus: ${session.status}\nCreated: ${session.createdAt}`;
    await this.botService.sendMessage(userId, status);
  }

  async handleRestart(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const session = this.sessionManager.get(userId);
    if (session) {
      await this.sessionManager.destroy(userId);
    }

    await this.botService.sendMessage(userId, 'Session restarted. Send a message to create new session.');
  }

  async handleClear(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    await this.botService.sendMessage(userId, 'History cleared.');
  }
}
