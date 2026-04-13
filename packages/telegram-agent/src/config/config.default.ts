import path from 'path';
import os from 'os';
import fs from 'fs';
import { parse as parseYaml } from 'yaml';
import type { ArtusXConfig } from '@artusx/core';

export interface TelegramAgentConfig {
  telegram: {
    botToken: string;
  };
  agent: {
    preset?: string;
    command: string;
    args: string[];
    cwd: string;
    env?: Record<string, string>;
    showThoughts: boolean;
  };
  session: {
    idleTimeoutMs: number;
    maxConcurrentUsers: number;
    autoRecover: boolean;
  };
  webhook?: {
    token: string;
    enableAuth: boolean;
  };
  allowedUsers?: string[];
}

const PRESETS: Record<string, { command: string; args: string[] }> = {
  claude: {
    command: 'pnpx',
    args: ['@agentclientprotocol/claude-agent-acp'],
  },
};

function defaultStorageDir(): string {
  return path.join(os.homedir(), '.telegram-acp');
}

function defaultConfig(): TelegramAgentConfig {
  return {
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    },
    agent: {
      preset: 'claude',
      command: 'pnpx',
      args: ['@agentclientprotocol/claude-agent-acp'],
      cwd: process.cwd(),
      showThoughts: false,
    },
    session: {
      idleTimeoutMs: 24 * 60 * 60 * 1000, // 24 hours
      maxConcurrentUsers: 10,
      autoRecover: true,
    },
    webhook: {
      token: process.env.TELEGRAM_WEBHOOK_TOKEN || 'default-webhook-token',
      enableAuth: true,
    },
  };
}

function loadConfigFromFile(): Partial<TelegramAgentConfig> {
  const configPath = path.join(defaultStorageDir(), 'config.yaml');
  
  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const fileConfig = parseYaml(content) as Partial<TelegramAgentConfig>;
    return fileConfig;
  } catch (err) {
    console.error(`Failed to parse config file ${configPath}: ${String(err)}`);
    return {};
  }
}

export default () => {
  const defaultCfg = defaultConfig();
  const fileConfig = loadConfigFromFile();

  // Merge configurations
  const config: TelegramAgentConfig = {
    telegram: {
      botToken: fileConfig.telegram?.botToken || defaultCfg.telegram.botToken,
    },
    agent: {
      preset: fileConfig.agent?.preset || defaultCfg.agent.preset,
      command: fileConfig.agent?.command || defaultCfg.agent.command,
      args: fileConfig.agent?.args || defaultCfg.agent.args,
      cwd: fileConfig.agent?.cwd || defaultCfg.agent.cwd,
      env: fileConfig.agent?.env || defaultCfg.agent.env,
      showThoughts: fileConfig.agent?.showThoughts ?? defaultCfg.agent.showThoughts,
    },
    session: {
      idleTimeoutMs: fileConfig.session?.idleTimeoutMs || defaultCfg.session.idleTimeoutMs,
      maxConcurrentUsers: fileConfig.session?.maxConcurrentUsers || defaultCfg.session.maxConcurrentUsers,
      autoRecover: fileConfig.session?.autoRecover ?? defaultCfg.session.autoRecover,
    },
    webhook: {
      token: fileConfig.webhook?.token || defaultCfg.webhook!.token,
      enableAuth: fileConfig.webhook?.enableAuth ?? defaultCfg.webhook!.enableAuth,
    },
    allowedUsers: fileConfig.allowedUsers || defaultCfg.allowedUsers,
  };

  // Resolve preset if specified
  if (config.agent.preset && PRESETS[config.agent.preset]) {
    const preset = PRESETS[config.agent.preset];
    config.agent.command = preset.command;
    config.agent.args = preset.args;
  }

  const artusx: ArtusXConfig = {
    keys: 'artusx-koa',
    port: 7001,
  };

  return {
    ...config,
    artusx,
  };
};
