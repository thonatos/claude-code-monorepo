/**
 * Message handler for Telegram bot.
 */

import { Context } from "grammy";
import type * as acp from "@agentclientprotocol/sdk";
import type { AcpContext } from "../middleware/session.ts";
import type { HistoryInjector } from "../../history.ts";

export function createMessageHandler(historyInjector: HistoryInjector) {
  return async (ctx: Context) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const acpCtx = ctx as AcpContext;

    // 1. React with acknowledgment
    try {
      await ctx.react("👀");
    } catch {
      // Best-effort - don't block if fails
    }

    // 2. Extract message content
    let prompt = extractPrompt(ctx);
    const isMedia = isMediaMessage(ctx);

    // 3. Inject history if needed
    const cachedMessages = historyInjector.getCachedMessages(userId);
    if (cachedMessages && cachedMessages.length > 0 && !historyInjector.hasInjected(userId)) {
      historyInjector.markInjected(userId, cachedMessages);
      prompt = historyInjector.buildContext(cachedMessages, prompt);
    }

    // 4. Record user message
    await acpCtx.sessionManager.recordMessage(userId, 'user', prompt);

    // 5. Update reaction based on content type
    try {
      await ctx.react(isMedia ? "⚡" : "🤔");
    } catch {
      // Best-effort
    }

    // 6. Build ACP prompt
    const content: acp.ContentBlock = {
      type: "text",
      text: prompt,
    };

    const session = acpCtx.session;

    try {
      // Reset streaming state for new prompt
      session.client.reset();

      // Mark session as healthy
      session.healthMonitor.markHealthy();

      // 7. Send prompt to ACP agent
      const result = await session.connection.prompt({
        sessionId: session.sessionId,
        prompt: [content],
      });

      // Collect agent reply
      let replyText = await session.client.flush();

      // Handle stop reasons
      if (result.stopReason === "cancelled") {
        replyText += "\n[cancelled]";
      } else if (result.stopReason === "refusal") {
        replyText += "\n[agent refused]";
      }

      // Record agent reply
      await acpCtx.sessionManager.recordMessage(userId, 'agent', replyText);

      // 8. Clear reaction
      try {
        await ctx.react([]); // Clear reaction
      } catch {}
    } catch (err) {
      // Mark as unhealthy
      session.healthMonitor.markUnhealthy(String(err));

      try {
        await ctx.react([]); // Clear reaction on error
      } catch {}
      await ctx.reply(`⚠️ Error: ${String(err)}`);
    }
  };
}

// --- Helpers ---

function extractPrompt(ctx: Context): string {
  const msg = ctx.message;

  if (msg?.text) return msg.text;
  if (msg?.photo) return `[Photo]`;
  if (msg?.animation) return `[GIF]`;
  if (msg?.video) return `[Video]`;
  if (msg?.audio) return `[Audio]`;
  if (msg?.voice) return `[Voice]`;
  if (msg?.document) return `[Document]`;
  return msg?.caption ?? `[Unknown]`;
}

function isMediaMessage(ctx: Context): boolean {
  const msg = ctx.message;
  return !!msg?.photo || !!msg?.video || !!msg?.audio || !!msg?.document || !!msg?.animation;
}
