/**
 * Telegram Bot API wrapper for dependency injection.
 */

import type { BotApi } from "./bot/index.ts";

export class TelegramApiWrapper {
  constructor(private api: BotApi) {}

  async sendMessage(userId: string, text: string, parseMode?: 'HTML'): Promise<number> {
    try {
      const msg = await this.api.sendMessage(userId, text, {
        parse_mode: parseMode
      });
      return msg.message_id;
    } catch (err) {
      console.error(`[telegram-api] Error sending message: ${String(err)}`);
      return 0;
    }
  }

  async editMessage(userId: string, msgId: number, text: string, parseMode?: 'HTML'): Promise<number> {
    if (!msgId || msgId <= 0) return 0;
    try {
      const result = await this.api.editMessageText(userId, msgId, text, {
        parse_mode: parseMode
      });
      if (result === true) return msgId;
      return result.message_id;
    } catch (err) {
      console.error(`[telegram-api] Error editing message: ${String(err)}`);
      return 0;
    }
  }

  async sendTyping(userId: string): Promise<void> {
    await this.api.sendChatAction(userId, "typing");
  }

  async sendReaction(userId: string, messageId: number, emoji: string): Promise<void> {
    await this.api.setMessageReaction(userId, messageId, [{ type: 'emoji', emoji: emoji as any }]);
  }
}