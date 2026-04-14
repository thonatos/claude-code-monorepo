import { Inject, Injectable, ScopeEnum } from "@artusx/core";
import type { Context } from "grammy";
import { InputFile } from "grammy";
import type TelegramClient from "../plugins/telegram/client";
import { InjectEnum as TelegramInjectEnum } from "../plugins/telegram/constants";
import type { SendMessageOptions } from "../types";

@Injectable({
  scope: ScopeEnum.TRANSIENT,
})
export class BotService {
  @Inject(TelegramInjectEnum.Client)
  private telegramClient!: TelegramClient;

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

  async editMessage(
    userId: string,
    messageId: number,
    text: string,
    options?: SendMessageOptions
  ): Promise<void> {
    const bot = this.telegramClient.getBot();
    await bot.api.editMessageText(userId, messageId, text, {
      parse_mode: options?.parseMode,
    });
  }

  async sendReaction(userId: string, messageId: number): Promise<void> {
    const bot = this.telegramClient.getBot();
    await bot.api.setMessageReaction(userId, messageId, [{ type: "emoji", emoji: "👍" }]);
  }

  async removeReaction(userId: string, messageId: number): Promise<void> {
    const bot = this.telegramClient.getBot();
    await bot.api.setMessageReaction(userId, messageId, []);
  }

  async sendTyping(userId: string): Promise<void> {
    const bot = this.telegramClient.getBot();
    await bot.api.sendChatAction(userId, "typing");
  }

  async downloadFile(fileId: string): Promise<string> {
    const bot = this.telegramClient.getBot();
    const file = await bot.api.getFile(fileId);
    return file.file_path || "";
  }

  setupMessageHandler(handler: (ctx: Context) => Promise<void>): void {
    const bot = this.telegramClient.getBot();
    bot.on("message", handler);
  }
}
