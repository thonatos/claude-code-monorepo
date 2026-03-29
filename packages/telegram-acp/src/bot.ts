/**
 * Telegram bot setup: configuration, middleware, and message handling.
 */

import { Bot, Context } from "grammy";
import { SocksProxyAgent } from "socks-proxy-agent";
import { SessionManager, type UserSession } from "./session.ts";
import type { TelegramAcpConfig } from "./config.ts";
import type * as acp from "@agentclientprotocol/sdk";

// Extended context with ACP session
interface AcpContext extends Context {
  session: UserSession;
  sessionManager: SessionManager;
}

export type { Bot };

/**
 * Create configured bot with auth, session middleware, and handlers.
 */
export function createBot(
  token: string,
  config: TelegramAcpConfig,
  sessionManager: SessionManager
): Bot {
  // Bot options (with proxy if configured)
  const botOptions = {} as {
    client?: { baseFetchConfig: { agent: SocksProxyAgent; compress: boolean } };
  };
  if (config.proxy) {
    botOptions.client = {
      baseFetchConfig: {
        agent: new SocksProxyAgent(config.proxy),
        compress: true,
      },
    };
  }

  const bot = new Bot(token, botOptions);

  // --- Layer 1: Error handling ---
  bot.catch((err) => {
    config.log?.(`[grammy] Error: ${err.message}`);
  });

  // --- Layer 2: Auth middleware ---
  bot.use(authMiddleware(config));

  // --- Layer 3: Session middleware ---
  bot.use(sessionMiddleware(sessionManager));

  // --- Layer 4: Command handlers (must be before message handler) ---
  bot.command("start", async (ctx) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const acpCtx = ctx as AcpContext;
    const session = await acpCtx.sessionManager.getOrCreate(userId);
    const stored = await acpCtx.sessionManager.getStorage().loadRestorable(userId);

    if (stored) {
      await ctx.reply(
        `Session restored.\nSession ID: ${stored.sessionId}\nMessages: ${stored.messages.length}`
      );
    } else {
      await ctx.reply(
        `New session created.\nSession ID: ${session.sessionId}`
      );
    }
  });

  bot.command("status", async (ctx) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const acpCtx = ctx as AcpContext;
    const stored = await acpCtx.sessionManager.getStorage().loadRestorable(userId);

    if (!stored) {
      await ctx.reply("No active session.");
      return;
    }

    const formatDate = (ts: number) => new Date(ts).toLocaleString();

    await ctx.reply(
      `Session ID: ${stored.sessionId}\n` +
      `Created: ${formatDate(stored.createdAt)}\n` +
      `Last Activity: ${formatDate(stored.lastActivity)}\n` +
      `Messages: ${stored.messages.length}\n` +
      `Agent: ${stored.agentConfig.preset ?? stored.agentConfig.command}\n` +
      `Status: ${stored.status}`
    );
  });

  bot.command("restart", async (ctx) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    await ctx.reply("Restarting session...");

    const acpCtx = ctx as AcpContext;
    const session = await acpCtx.sessionManager.restart(userId);

    await ctx.reply(`New session created.\nSession ID: ${session.sessionId}`);
  });

  bot.command("clear", async (ctx) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const acpCtx = ctx as AcpContext;
    await acpCtx.sessionManager.clearHistory(userId);

    await ctx.reply("History cleared.");
  });

  bot.command("help", (ctx) =>
    ctx.reply("Send any message to chat with the AI agent.\nCommands: /start, /help, /status, /restart, /clear")
  );

  // --- Layer 5: Message handler ---
  bot.on("message", messageHandler);

  return bot;
}

// --- Auth middleware (inline) ---
function authMiddleware(config: TelegramAcpConfig) {
  return async (ctx: Context, next: () => Promise<void>) => {
    const userId = ctx.from?.id.toString();

    // Open mode: allow all users
    if (config.open) {
      return next();
    }

    // Whitelist mode: check allowedUsers
    if (!userId || !config.allowedUsers?.includes(userId)) {
      config.log?.(`[auth] Blocked user ${userId ?? "?"}`);
      return;
    }

    await next();
  };
}

// --- Session middleware (inline) ---
function sessionMiddleware(sessionManager: SessionManager) {
  return async (ctx: Context, next: () => Promise<void>) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const session = await sessionManager.getOrCreate(userId);

    const acpCtx = ctx as AcpContext;
    acpCtx.session = session;
    acpCtx.sessionManager = sessionManager;

    await next();
  };
}

// --- Message handler (inline) ---
async function messageHandler(ctx: Context) {
  const acpCtx = ctx as AcpContext;
  const userId = ctx.from?.id.toString();
  const chatId = ctx.chat?.id;

  if (!userId || !chatId) return;

  // 1. Immediate feedback on receipt
  try {
    await ctx.react("👀");
  } catch {
    // Best-effort - don't block if fails
  }

  // 2. Extract message content
  const prompt = extractPrompt(ctx);
  const isMedia = isMediaMessage(ctx);

  // Record user message
  await acpCtx.sessionManager.recordMessage(userId, 'user', prompt);

  // 3. Update reaction based on content type
  try {
    await ctx.react(isMedia ? "⚡" : "🤔");
  } catch {
    // Best-effort
  }

  // Build ACP prompt
  const content: acp.ContentBlock = {
    type: "text",
    text: prompt,
  };

  const session = acpCtx.session;

  try {
    // 4. Send prompt to ACP agent
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

    // 5. Clear reaction + send reply
    try {
      await ctx.react([]); // Clear reaction
    } catch {}
    if (replyText.trim()) {
      await ctx.reply(formatForTelegram(replyText));
    }
  } catch (err) {
    try {
      await ctx.react([]); // Clear reaction on error
    } catch {}
    await ctx.reply(`⚠️ Error: ${String(err)}`);
  }
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

function formatForTelegram(text: string): string {
  let out = text;
  // Bold: **text** → *text*
  out = out.replace(/\*\*(.+?)\*\*/g, "*$1*");
  // Italic: *text* → _text_
  out = out.replace(/\*(.+?)\*/g, "_$1_");
  return out.trim();
}

// --- Bot lifecycle ---
export async function startBot(bot: Bot): Promise<void> {
  // Register commands to Telegram UI menu
  await bot.api.setMyCommands([
    { command: "start", description: "Create or restore session" },
    { command: "help", description: "Show available commands" },
    { command: "status", description: "Show session details" },
    { command: "restart", description: "Restart session" },
    { command: "clear", description: "Clear conversation history" },
  ]);

  await bot.start();
}

export async function stopBot(bot: Bot): Promise<void> {
  await bot.stop();
}
