import { ArtusInjectEnum, Inject, Injectable, ScopeEnum } from "@artusx/core";
import type { ArtusApplication } from "@artusx/core";
import type { Context } from "grammy";
import { BridgeService } from "../module-bridge/bridge.service";
import { BotService } from "./bot.service";

@Injectable({
  scope: ScopeEnum.TRANSIENT,
})
export class CommandHandler {
  @Inject(BotService)
  botService!: BotService;

  @Inject(BridgeService)
  bridgeService!: BridgeService;

  @Inject(ArtusInjectEnum.Application)
  private app!: ArtusApplication;

  private get logger() {
    return this.app.logger;
  }

  async handleStart(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    const username = ctx.from?.username || ctx.from?.first_name || "unknown";
    if (!userId) return;

    this.logger.info(`[command] /start from ${username} (${userId})`);

    const session = this.bridgeService.getUserSession(userId);
    if (session) {
      await ctx.reply(
        `<b>Session restored</b>\n` +
        `Session ID: <code>${session.sessionId}</code>`,
        { parse_mode: "HTML" }
      );
    } else {
      await ctx.reply(
        `<b>Session ready</b>\n` +
        `Send a message to start chatting.`,
        { parse_mode: "HTML" }
      );
    }
  }

  async handleStatus(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    this.logger.info(`[command] /status from ${userId}`);

    const session = this.bridgeService.getUserSession(userId);
    if (!session) {
      await ctx.reply("<b>No active session</b>", { parse_mode: "HTML" });
      return;
    }

    const formatDate = (ts: number) => new Date(ts).toLocaleString();

    await ctx.reply(
      `<b>Session Status</b>\n\n` +
      `<b>ID:</b> <code>${session.sessionId}</code>\n` +
      `<b>Last Activity:</b> ${formatDate(session.lastActivity.getTime())}`,
      { parse_mode: "HTML" }
    );
  }

  async handleRestart(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    this.logger.info(`[command] /restart from ${userId}`);

    await ctx.reply("<b>Restarting session...</b>", { parse_mode: "HTML" });

    await this.bridgeService.closeUserSession(userId);
    this.bridgeService.resetReactionState(userId);

    await ctx.reply(
      `<b>Session closed</b>\n` +
      `Send a message to start new session.`,
      { parse_mode: "HTML" }
    );
  }

  async handleClear(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    this.logger.info(`[command] /clear from ${userId}`);

    this.bridgeService.resetReactionState(userId);
    await ctx.reply("<b>State cleared</b>", { parse_mode: "HTML" });
  }

  async handleHelp(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    this.logger.info(`[command] /help from ${userId}`);

    await ctx.reply(
      `<b>Telegram Agent Bot</b>\n\n` +
      `Send any message to chat with the AI agent.\n\n` +
      `<b>Commands:</b>\n` +
      `<code>/start</code> - Create or restore session\n` +
      `<code>/help</code> - Show this help\n` +
      `<code>/status</code> - Show session details\n` +
      `<code>/restart</code> - Restart session\n` +
      `<code>/clear</code> - Clear state`,
      { parse_mode: "HTML" }
    );
  }
}