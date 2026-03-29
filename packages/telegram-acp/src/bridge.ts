/**
 * TelegramAcpBridge — orchestration layer.
 */

import path from "node:path";
import fs from "node:fs";
import { createBot, startBot, stopBot, type Bot } from "./bot.ts";
import { SessionManager } from "./session.ts";
import type { TelegramAcpConfig } from "./config.ts";
import { defaultStorageDir } from "./config.ts";

export class TelegramAcpBridge {
  private config: TelegramAcpConfig;
  private bot: Bot | null = null;
  private sessionManager: SessionManager | null = null;
  private log: (msg: string) => void;

  constructor(config: TelegramAcpConfig) {
    this.config = config;
    this.log = config.log ?? ((msg: string) => console.log(`[telegram-acp] ${msg}`));
    this.config.log = this.log;
  }

  async start(): Promise<void> {
    this.log("[telegram-acp] Starting...");

    // Create session manager
    this.sessionManager = new SessionManager({
      agentCommand: this.config.agent.command,
      agentArgs: this.config.agent.args,
      agentCwd: this.config.agent.cwd,
      agentEnv: this.config.agent.env,
      agentPreset: this.config.agent.preset,
      sessionConfig: this.config.session,
      historyConfig: this.config.history,
      showThoughts: this.config.agent.showThoughts,
      log: this.log,
      onReply: async (userId: string, text: string) => {
        if (this.bot) {
          await this.bot.api.sendMessage(userId, text);
        }
      },
      sendTyping: async (userId: string) => {
        if (this.bot) {
          await this.bot.api.sendChatAction(userId, "typing");
        }
      },
    });

    // Restore persisted sessions
    await this.restorePersistedSessions();

    // Create and start bot
    this.bot = createBot(this.config.telegram.botToken, this.config, this.sessionManager);

    await startBot(this.bot);

    this.log("[telegram-acp] Started");
  }

  async stop(): Promise<void> {
    this.log("[telegram-acp] Stopping...");

    if (this.sessionManager) {
      await this.sessionManager.stop();
    }

    if (this.bot) {
      await stopBot(this.bot);
    }

    this.log("[telegram-acp] Stopped");
  }

  async getBotInfo(): Promise<{ id: string; username: string; firstName?: string }> {
    if (!this.bot) {
      throw new Error("Bot not started");
    }
    const me = await this.bot.api.getMe();
    return {
      id: me.id.toString(),
      username: me.username || "",
      firstName: me.first_name || undefined,
    };
  }

  private async restorePersistedSessions(): Promise<void> {
    const sessionsDir = path.join(defaultStorageDir(), 'sessions');
    if (!fs.existsSync(sessionsDir)) return;

    const userDirs = fs.readdirSync(sessionsDir);
    for (const userId of userDirs) {
      const userPath = path.join(sessionsDir, userId);
      if (!fs.statSync(userPath).isDirectory()) continue;

      const stored = await this.sessionManager!.getStorage().loadActive(userId);
      if (stored && stored.status === 'active') {
        this.log(`[restore] Restoring session for ${userId}`);
        try {
          await this.sessionManager!.restore(userId, stored);
        } catch (err) {
          this.log(`[restore] Failed to restore ${userId}: ${String(err)}`);
        }
      }
    }
  }
}
