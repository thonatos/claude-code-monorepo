import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import {
  DEFAULT_AGENT_CONFIG,
  DEFAULT_SESSION_CONFIG,
  DEFAULT_WEBHOOK_CONFIG,
  DEFAULT_HISTORY_CONFIG,
  defaultMediaDir,
  defaultStorageDir,
  resolvePreset,
} from "../constants";
import type { TelegramAgentConfig } from "../types";

function loadConfigFromFile(): Partial<TelegramAgentConfig> {
  const configPath = path.join(defaultStorageDir(), "config.yaml");

  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(configPath, "utf-8");
    return parseYaml(content) as Partial<TelegramAgentConfig>;
  } catch (err) {
    console.error(`Failed to parse config file ${configPath}: ${String(err)}`);
    return {};
  }
}

export default () => {
  const fileConfig = loadConfigFromFile();

  const config: TelegramAgentConfig = {
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || fileConfig.telegram?.botToken || "",
    },
    agent: {
      preset: fileConfig.agent?.preset ?? DEFAULT_AGENT_CONFIG.preset,
      command: fileConfig.agent?.command ?? DEFAULT_AGENT_CONFIG.command,
      args: fileConfig.agent?.args ?? DEFAULT_AGENT_CONFIG.args,
      cwd: fileConfig.agent?.cwd ?? DEFAULT_AGENT_CONFIG.cwd,
      env: fileConfig.agent?.env ?? DEFAULT_AGENT_CONFIG.env,
      showThoughts: fileConfig.agent?.showThoughts ?? DEFAULT_AGENT_CONFIG.showThoughts,
    },
    session: {
      idleTimeoutMs: fileConfig.session?.idleTimeoutMs ?? DEFAULT_SESSION_CONFIG.idleTimeoutMs,
      maxConcurrentUsers:
        fileConfig.session?.maxConcurrentUsers ?? DEFAULT_SESSION_CONFIG.maxConcurrentUsers,
      autoRecover: fileConfig.session?.autoRecover ?? DEFAULT_SESSION_CONFIG.autoRecover,
    },
    history: {
      maxMessages: fileConfig.history?.maxMessages ?? DEFAULT_HISTORY_CONFIG.maxMessages,
      maxDays: fileConfig.history?.maxDays ?? DEFAULT_HISTORY_CONFIG.maxDays,
    },
    webhook: {
      token:
        process.env.TELEGRAM_WEBHOOK_TOKEN ??
        fileConfig.webhook?.token ??
        DEFAULT_WEBHOOK_CONFIG.token,
      enableAuth: fileConfig.webhook?.enableAuth ?? DEFAULT_WEBHOOK_CONFIG.enableAuth,
    },
    media: {
      tempDir: fileConfig.media?.tempDir ?? defaultMediaDir(),
    },
    allowedUsers: fileConfig.allowedUsers ?? [],
    proxy: fileConfig.proxy ?? "",
  };

  // Resolve preset if specified
  if (config.agent.preset) {
    const resolved = resolvePreset(config.agent.preset);
    if (resolved) {
      config.agent.command = resolved.preset.command;
      config.agent.args = resolved.preset.args;
      if (resolved.preset.env) {
        config.agent.env = { ...config.agent.env, ...resolved.preset.env };
      }
    }
  }

  return {
    ...config,
    artusx: {
      keys: "artusx-koa",
      port: 7001,
      static: {
        dirs: [
          {
            prefix: "/public/",
            dir: path.resolve(__dirname, "../public"),
          },
        ],
        dynamic: true,
        preload: false,
        buffer: false,
        maxFiles: 1000,
      },
    },
  };
};
