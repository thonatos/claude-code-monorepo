/**
 * Command handlers for Telegram bot.
 */

import { Context } from 'grammy';
import type { AcpContext } from '../middleware/session.ts';
import type { HistoryInjector } from '../../history.ts';

export function createCommandHandlers(historyInjector: HistoryInjector) {
  return {
    start: async (ctx: Context) => {
      const userId = ctx.from?.id.toString();
      if (!userId) return;

      const acpCtx = ctx as AcpContext;
      const cachedMessages = historyInjector.getCachedMessages(userId);

      if (cachedMessages && cachedMessages.length > 0) {
        await ctx.reply(
          `<b>Session restored</b>\n` +
            `Messages: <code>${cachedMessages.length}</code>\n` +
            `Session ID: <code>${acpCtx.session.sessionId}</code>`,
          { parse_mode: 'HTML' },
        );
      } else {
        await ctx.reply(`<b>Session ready</b>\n` + `Session ID: <code>${acpCtx.session.sessionId}</code>`, {
          parse_mode: 'HTML',
        });
      }
    },

    status: async (ctx: Context) => {
      const userId = ctx.from?.id.toString();
      if (!userId) return;

      const acpCtx = ctx as AcpContext;
      const stored = await acpCtx.sessionManager.getStorage().loadRestorable(userId);

      if (!stored) {
        await ctx.reply('<b>No active session</b>', { parse_mode: 'HTML' });
        return;
      }

      const formatDate = (ts: number) => new Date(ts).toLocaleString();

      await ctx.reply(
        `<b>Session Status</b>\n\n` +
          `<b>ID:</b> <code>${stored.sessionId}</code>\n` +
          `<b>Created:</b> ${formatDate(stored.createdAt)}\n` +
          `<b>Last Activity:</b> ${formatDate(stored.lastActivity)}\n` +
          `<b>Messages:</b> <code>${stored.messages.length}</code>\n` +
          `<b>Agent:</b> <code>${stored.agentConfig.preset ?? stored.agentConfig.command}</code>\n` +
          `<b>Status:</b> <code>${stored.status}</code>`,
        { parse_mode: 'HTML' },
      );
    },

    restart: async (ctx: Context) => {
      const userId = ctx.from?.id.toString();
      if (!userId) return;

      // Clear history injection cache
      historyInjector.clearInjection(userId);

      await ctx.reply('<b>Restarting session...</b>', { parse_mode: 'HTML' });

      const acpCtx = ctx as AcpContext;
      const session = await acpCtx.sessionManager.restart(userId);

      await ctx.reply(`<b>New session created</b>\n` + `Session ID: <code>${session.sessionId}</code>`, {
        parse_mode: 'HTML',
      });
    },

    clear: async (ctx: Context) => {
      const userId = ctx.from?.id.toString();
      if (!userId) return;

      // Clear history injection cache
      historyInjector.clearInjection(userId);

      const acpCtx = ctx as AcpContext;
      await acpCtx.sessionManager.clearHistory(userId);

      await ctx.reply('<b>History cleared</b>', { parse_mode: 'HTML' });
    },

    help: async (ctx: Context) => {
      await ctx.reply(
        `<b>Telegram ACP Bot</b>\n\n` +
          `Send any message to chat with the AI agent.\n\n` +
          `<b>Commands:</b>\n` +
          `<code>/start</code> - Create or restore session\n` +
          `<code>/help</code> - Show this help\n` +
          `<code>/status</code> - Show session details\n` +
          `<code>/restart</code> - Restart session\n` +
          `<code>/clear</code> - Clear conversation history`,
        { parse_mode: 'HTML' },
      );
    },
  };
}
