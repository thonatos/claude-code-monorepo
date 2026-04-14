import { ArtusInjectEnum, Inject, Injectable, ScopeEnum } from "@artusx/core";
import type { ArtusApplication } from "@artusx/core";
import type { Context } from "grammy";
import { BridgeService } from "../module-bridge/bridge.service";
import { AuthService } from "./auth.service";
import { BotService } from "./bot.service";

@Injectable({
  scope: ScopeEnum.TRANSIENT,
})
export class MessageHandler {
  @Inject(AuthService)
  authService!: AuthService;

  @Inject(BotService)
  botService!: BotService;

  @Inject(BridgeService)
  bridgeService!: BridgeService;

  @Inject(ArtusInjectEnum.Application)
  private app!: ArtusApplication;

  private get logger() {
    return this.app.logger;
  }

  async handle(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    const username = ctx.from?.username || ctx.from?.first_name || "unknown";

    if (!userId) return;

    this.logger.info(`[message] Received from ${username} (${userId})`);

    // Auth check
    if (!this.authService.isAuthorized(userId)) {
      this.logger.warn(`[message] Unauthorized user: ${userId}`);
      await ctx.reply("⛔ 未授权用户，请联系管理员");
      return;
    }

    const message = ctx.message;
    if (!message) return;

    const messageType = message.text ? "text" : message.photo ? "photo" : message.voice ? "voice" : "other";
    this.logger.info(`[message] Type: ${messageType}, ID: ${message.message_id}`);

    await this.botService.sendReaction(userId, message.message_id);
    await this.bridgeService.handleUserMessage(userId, message);
  }
}
