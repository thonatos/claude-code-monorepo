import { Injectable, ScopeEnum } from '@artusx/core';
import { Bot } from 'grammy';
import { InjectEnum } from './constants';
import { SocksProxyAgent } from "socks-proxy-agent";

@Injectable({
  id: InjectEnum.Client,
  scope: ScopeEnum.SINGLETON,
})
export default class TelegramClient {
  private bot!: Bot;

  async init(token: string, proxy?: string) {
    if (!token) {
      throw new Error('Telegram bot token is required');
    }

    this.bot = new Bot(token, {
      client: {
        baseFetchConfig: {
          agent: proxy ? new SocksProxyAgent(proxy) : undefined,
          compress: true,
        },
      }
    });

    this.bot.catch((err) => {
      console.log?.(`[grammy] Error: ${err.message}`);
    });
  }

  async start() {
    try {
      this.bot.start();      
    } catch (error) {
      console.error('[telegram-plugin] Failed to start bot, retrying...', error);
    }
  }

  async stop() {
    this.bot.stop();
  }

  getBot(): Bot {
    return this.bot;
  }
}
