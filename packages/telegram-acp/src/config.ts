/**
 * Configuration types and defaults for telegram-acp.
 */

import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { parse as parseYaml } from "yaml";

export interface AgentPreset {
  label: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface SessionConfig {
  idleTimeoutMs: number;
  maxConcurrentUsers: number;
}

export interface ReactionConfig {
  enabled: boolean;
  emoji?: string;
  randomEmojis?: string[];
}

export interface TelegramAcpConfig {
  telegram: { botToken: string };
  agent: {
    preset?: string;
    command: string;
    args: string[];
    cwd: string;
    env?: Record<string, string>;
    showThoughts: boolean;
  };
  proxy?: string;
  allowedUsers?: string[];
  open?: boolean;
  reaction: ReactionConfig;
  session: SessionConfig;
  log?: (msg: string) => void;
}

export const PRESETS: Record<string, AgentPreset> = {
  copilot: {
    label: "GitHub Copilot",
    command: "pnpx",
    args: ["@github/copilot", "--acp", "--yolo"],
  },
  claude: {
    label: "Claude Code",
    command: "pnpx",
    args: ["@agentclientprotocol/claude-agent-acp"],
  },
  codex: {
    label: "Codex CLI",
    command: "pnpx",
    args: ["@zed-industries/codex-acp"],
  },
};

export const DEFAULT_REACTION_EMOJIS = ["👍", "👌", "🫡", "⏳", "🔄"];

export function defaultStorageDir(): string {
  return path.join(os.homedir(), ".telegram-acp");
}

export function defaultConfig(): TelegramAcpConfig {
  const storageDir = defaultStorageDir();
  return {
    telegram: { botToken: "" },
    agent: {
      preset: undefined,
      command: "",
      args: [],
      cwd: process.cwd(),
      showThoughts: false,
    },
    reaction: {
      enabled: true,
      randomEmojis: DEFAULT_REACTION_EMOJIS,
    },
    session: {
      idleTimeoutMs: 1440 * 60_000, // 24 hours
      maxConcurrentUsers: 10,
    },
    log: undefined,
  };
}

export function resolvePreset(
  presetName: string,
): { id: string; preset: AgentPreset } | null {
  const preset = PRESETS[presetName];
  if (!preset) return null;
  return { id: presetName, preset };
}

export function parseAgentCommand(agentStr: string): { command: string; args: string[] } {
  const parts = agentStr.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) {
    throw new Error("Agent command cannot be empty");
  }
  return { command: parts[0], args: parts.slice(1) };
}

export function loadConfig(configPath?: string, presetArg?: string): TelegramAcpConfig {
  const config = defaultConfig();

  // Determine config file path
  const filePath = configPath ?? path.join(defaultStorageDir(), "config.yaml");

  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const fileConfig = parseYaml(content) as Partial<TelegramAcpConfig>;

      // Merge nested objects
      if (fileConfig.telegram) config.telegram = fileConfig.telegram;
      if (fileConfig.agent) {
        config.agent.preset = fileConfig.agent.preset ?? config.agent.preset;
        config.agent.command = fileConfig.agent.command ?? config.agent.command;
        config.agent.args = fileConfig.agent.args ?? config.agent.args;
        config.agent.cwd = fileConfig.agent.cwd ?? config.agent.cwd;
        config.agent.env = fileConfig.agent.env ?? config.agent.env;
        config.agent.showThoughts = fileConfig.agent.showThoughts ?? config.agent.showThoughts;
      }
      if (fileConfig.session) {
        config.session.idleTimeoutMs = fileConfig.session.idleTimeoutMs ?? config.session.idleTimeoutMs;
        config.session.maxConcurrentUsers = fileConfig.session.maxConcurrentUsers ?? config.session.maxConcurrentUsers;
      }
      if (fileConfig.reaction) config.reaction = fileConfig.reaction;

      // Top-level fields
      if (fileConfig.proxy) config.proxy = fileConfig.proxy;
      if (fileConfig.allowedUsers) config.allowedUsers = fileConfig.allowedUsers;
      if (fileConfig.open) config.open = fileConfig.open;
    } catch (err) {
      console.error(`Failed to parse config file ${filePath}: ${String(err)}`);
      // Continue with defaults
    }
  }

  // Resolve preset (CLI arg takes precedence)
  const presetName = presetArg ?? config.agent.preset;
  if (presetName) {
    const resolved = resolvePreset(presetName);
    if (resolved) {
      config.agent.preset = resolved.id;
      config.agent.command = resolved.preset.command;
      config.agent.args = resolved.preset.args;
      if (resolved.preset.env) {
        config.agent.env = { ...config.agent.env, ...resolved.preset.env };
      }
    } else {
      // Not a preset name, parse as raw command
      const parsed = parseAgentCommand(presetName);
      config.agent.command = parsed.command;
      config.agent.args = parsed.args;
    }
  }

  return config;
}

export function listPresets(): Array<{ id: string; preset: AgentPreset }> {
  return Object.entries(PRESETS)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, preset]) => ({ id, preset }));
}