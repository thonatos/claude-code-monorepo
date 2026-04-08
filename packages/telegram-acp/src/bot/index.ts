/**
 * Telegram bot setup: configuration, middleware, and message handling.
 * Refactored with modular structure for better maintainability.
 */

import { Bot, GrammyError, Api } from "grammy";
import { SocksProxyAgent } from "socks-proxy-agent";
import { authMiddleware } from "./middleware/auth.ts";
import { sessionMiddleware } from "./middleware/session.ts";
import { createCommandHandlers } from "./handlers/commands.ts";
import { createMessageHandler } from "./handlers/message.ts";
import type { TelegramAcpConfig } from "../config.ts";
import type { SessionManager } from "../session/index.ts";
import { HistoryInjector } from "../history.ts";

export type { Bot };
export type BotApi = Api;

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

  // Initialize history injector
  const historyInjector = new HistoryInjector();

  // --- Layer 1: Error handling ---
  bot.catch((err) => {
    config.log?.(`[grammy] Error: ${err.message}`);
  });

  // --- Layer 2: Auth middleware ---
  bot.use(authMiddleware(config));

  // --- Layer 3: Session middleware ---
  bot.use(sessionMiddleware(sessionManager));

  // --- Layer 4: Command handlers ---
  const commands = createCommandHandlers(historyInjector);
  
  bot.command("start", commands.start);
  bot.command("status", commands.status);
  bot.command("restart", commands.restart);
  bot.command("clear", commands.clear);
  bot.command("help", commands.help);

  // --- Layer 5: Message handler ---
  const messageHandler = createMessageHandler(historyInjector);
  bot.on("message", messageHandler);

  return bot;
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
