import { Inject, Injectable, ScopeEnum } from "@artusx/core";
import type { Context } from "grammy";
import { AuthService } from "../module-auth/auth.service";
import { BridgeService } from "../module-bridge/bridge.service";
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

  async handle(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    // Auth check
    if (!this.authService.isAuthorized(userId)) {
      await ctx.reply("⛔ 未授权用户，请联系管理员");
      return;
    }

    const message = ctx.message;
    if (!message) return;

    await this.botService.sendReaction(userId, message.message_id);
    await this.bridgeService.handleUserMessage(userId, message);
  }
}
