import { ArtusInjectEnum, Injectable, ScopeEnum, Inject } from '@artusx/core';
import { Bot } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import { InjectEnum } from './constants';
import { SocksProxyAgent } from 'socks-proxy-agent';

@Injectable({
  id: InjectEnum.Client,
  scope: ScopeEnum.SINGLETON,
})
export default class TelegramClient {
  @Inject(ArtusInjectEnum.Application)
  private app!: any;

  private bot!: Bot;

  private get logger() {
    return this.app.logger;
  }

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
      },
    });

    // Auto-retry on API failures (rate limits, network issues)
    this.bot.api.config.use(autoRetry());

    this.bot.catch((err) => {
      this.logger.error(`[grammy] Error: ${err.message}`);
    });
  }

  async start() {
    try {
      this.bot.start();
    } catch (error) {
      this.logger.error('[telegram-plugin] Failed to start bot, retrying...', error);
    }
  }

  async stop() {
    this.bot.stop();
  }

  getBot(): Bot {
    return this.bot;
  }
}
