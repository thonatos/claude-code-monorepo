/**
 * Telegram bot setup: configuration, middleware, and message handling.
 */

import { Bot, Context, GrammyError } from "grammy";
import { SocksProxyAgent } from "socks-proxy-agent";
import { SessionManager, type UserSession } from "./session.ts";
import type { TelegramAcpConfig } from "./config.ts";
import type * as acp from "@agentclientprotocol/sdk";
import { SessionStorage, type StoredSession, type StoredMessage } from "./storage.ts";

// Map userId -> messages to inject on first user message after restoration
const pendingHistoryInjection = new Map<string, StoredMessage[]>();

// Extended context with ACP session
interface AcpContext extends Context {
  session: UserSession;
  sessionManager: SessionManager;
}

export type { Bot };

/**
 * Build a formatted context string from stored messages for history injection.
 * Truncates long messages to prevent context explosion.
 */
function buildHistoryContext(messages: StoredMessage[]): string {
  const lines = ["[Previous conversation context]:"];
  for (const msg of messages) {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    // Truncate very long messages to prevent context explosion
    const content = msg.content.length > 2000
      ? msg.content.slice(0, 2000) + '...'
      : msg.content;
    lines.push(`${role}: ${content}`);
  }
  return lines.join('\n');
}

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

    // Session middleware already called getOrCreate(), which may have restored
    // a persisted session. Just report the status.
    const pendingHistory = pendingHistoryInjection.get(userId);

    if (pendingHistory && pendingHistory.length > 0) {
      await ctx.reply(
        `Session restored with ${pendingHistory.length} previous messages.\nSession ID: ${acpCtx.session.sessionId}`
      );
    } else {
      await ctx.reply(
        `Session ready.\nSession ID: ${acpCtx.session.sessionId}`
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

    // Clear any pending history injection to avoid injecting stale history into new session
    pendingHistoryInjection.delete(userId);

    await ctx.reply("Restarting session...");

    const acpCtx = ctx as AcpContext;
    const session = await acpCtx.sessionManager.restart(userId);

    await ctx.reply(`New session created.\nSession ID: ${session.sessionId}`);
  });

  bot.command("clear", async (ctx) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    // Clear any pending history injection to avoid re-injecting cleared history
    pendingHistoryInjection.delete(userId);

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

    // Check if history injection already pending (from /start)
    if (!pendingHistoryInjection.has(userId)) {
      const stored = await sessionManager.getStorage().loadRestorable(userId);
      if (stored && stored.messages.length > 0) {
        // Track history for injection on first message
        pendingHistoryInjection.set(userId, stored.messages);
      }
    }

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
  let prompt = extractPrompt(ctx);
  const isMedia = isMediaMessage(ctx);

  // Inject history on first message after restoration
  const historyToInject = pendingHistoryInjection.get(userId);
  if (historyToInject && historyToInject.length > 0) {
    pendingHistoryInjection.delete(userId); // One-time injection
    const historyPrefix = buildHistoryContext(historyToInject);
    prompt = historyPrefix + "\n\n[Current message]:\n" + prompt;
  }

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
/**
 * Escape special HTML characters for safe embedding in HTML tags.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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

/**
 * Convert Markdown to Telegram HTML format.
 * Processes code blocks first to prevent their content from being modified.
 */
export function formatForTelegram(text: string): string {
  // Use placeholders to protect code blocks from further processing
  const codeBlocks: string[] = [];

  // 1. Extract and protect code blocks (multiline) first
  let result = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) => {
    const index = codeBlocks.length;
    codeBlocks.push(`<pre><code>${escapeHtml(code)}</code></pre>`);
    return `\x00CODEBLOCK${index}\x00`;
  });

  // 2. Inline code - `code` → <code>escaped</code>
  result = result.replace(/`([^`]+)`/g, (_, code) => {
    return `<code>${escapeHtml(code)}</code>`;
  });

  // 3. Bold - **text** → <b>text</b>
  result = result.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

  // 4. Italic - *text* or _text_ → <i>text</i>
  result = result.replace(/\*([^*]+)\*/g, '<i>$1</i>');
  result = result.replace(/_([^_]+)_/g, '<i>$1</i>');

  // 5. Links - [text](url) → <a href="url">text</a>
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // 6. Restore code blocks
  codeBlocks.forEach((block, index) => {
    result = result.replace(`\x00CODEBLOCK${index}\x00`, block);
  });

  return result.trim();
}

// --- Bot lifecycle ---
export async function startBot(bot: Bot): Promise<void> {
  const COMMANDS = [
    { command: "start", description: "Create or restore session" },
    { command: "help", description: "Show available commands" },
    { command: "status", description: "Show session details" },
    { command: "restart", description: "Restart session" },
    { command: "clear", description: "Clear conversation history" },
  ];
  const SCOPE = { type: "all_private_chats" } as const;

  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await bot.start({
        onStart: async (info) => {
          process.stderr.write(`telegram channel: polling as @${info.username}\n`);
          await bot.api.setMyCommands(COMMANDS, { scope: SCOPE });
        },
      });
      return; // Clean exit (bot.stop() was called)
    } catch (err) {
      // 409 Conflict: another instance polling → retry with backoff
      if (err instanceof GrammyError && err.error_code === 409) {
        const delay = Math.min(1000 * attempt, 15000);
        const detail = attempt === 1
          ? " — another instance is polling"
          : "";
        process.stderr.write(
          `telegram channel: 409 Conflict${detail}, retrying in ${delay / 1000}s\n`
        );
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      // "Aborted delay": bot.stop() called mid-setup → clean exit
      if (err instanceof Error && err.message === "Aborted delay") {
        return;
      }

      // Other errors (including command registration failure) → stop and throw
      try { await bot.stop(); } catch {}
      throw err;
    }
  }

  throw new Error(`Failed to start bot after ${maxAttempts} attempts`);
}

export async function stopBot(bot: Bot): Promise<void> {
  await bot.stop();
}
