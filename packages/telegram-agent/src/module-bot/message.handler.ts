import { Inject, Injectable, ScopeEnum } from "@artusx/core";
import type { Context } from "grammy";
import { BridgeService } from "../module-bridge/bridge.service";
import { BotService } from "./bot.service";

@Injectable({
  scope: ScopeEnum.TRANSIENT,
})
export class MessageHandler {
  @Inject(BotService)
  botService!: BotService;

  @Inject(BridgeService)
  bridgeService!: BridgeService;

  async handle(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const message = ctx.message;
    if (!message) return;

    await this.botService.sendReaction(userId, message.message_id);
    await this.bridgeService.handleUserMessage(userId, message);
  }
}
