import type { Bot } from 'grammy';

export interface TelegramClientInterface {
  getBot(): Bot;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface TelegramMessage {
  userId: string;
  text?: string;
  photo?: any;
  audio?: any;
  messageId: number;
}
