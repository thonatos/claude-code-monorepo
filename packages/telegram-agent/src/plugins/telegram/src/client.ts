import { Injectable, ScopeEnum } from '@artusx/core';
import { Bot } from 'grammy';
import type { TelegramClientInterface } from './types';
import { InjectEnum } from './constants';

@Injectable({
  id: InjectEnum.Client,
  scope: ScopeEnum.SINGLETON,
})
export class TelegramClient implements TelegramClientInterface {
  private bot: Bot;

  constructor() {
    // Bot will be initialized via lifecycle hook with config
    this.bot = null as any;
  }

  init(token: string): void {
    if (!token) {
      throw new Error('Telegram bot token is required');
    }
    this.bot = new Bot(token);
  }

  async start(): Promise<void> {
    await this.bot.start();
  }

  async stop(): Promise<void> {
    await this.bot.stop();
  }

  getBot(): Bot {
    return this.bot;
  }
}
