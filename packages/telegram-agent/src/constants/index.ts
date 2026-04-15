import os from "node:os";
import path from "node:path";
import type { ReactionPhase } from "../types";

/**
 * Agent Presets
 */
export const PRESETS: Record<
  string,
  { label: string; command: string; args: string[]; env?: Record<string, string> }
> = {
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
  copilot: {
    label: "GitHub Copilot",
    command: "pnpx",
    args: ["@github/copilot", "--acp", "--yolo"],
  },
};

/**
 * Default storage directory
 */
export function defaultStorageDir(): string {
  return path.join(os.homedir(), ".telegram-agent");
}

/**
 * Default media directory
 */
export function defaultMediaDir(): string {
  return path.join(defaultStorageDir(), "media");
}

/**
 * Default sessions directory
 */
export function defaultSessionsDir(): string {
  return path.join(defaultStorageDir(), "sessions");
}

/**
 * Default session config
 */
export const DEFAULT_SESSION_CONFIG = {
  idleTimeoutMs: 24 * 60 * 60 * 1000, // 24 hours
  maxConcurrentUsers: 10,
  autoRecover: true,
};

/**
 * Default history config
 */
export const DEFAULT_HISTORY_CONFIG = {
  maxMessages: 100,
  maxDays: 7,
};

/**
 * Default webhook config
 */
export const DEFAULT_WEBHOOK_CONFIG = {
  token: "default-webhook-token",
  enableAuth: true,
};

/**
 * Default agent config
 */
export const DEFAULT_AGENT_CONFIG = {
  preset: "claude",
  command: "pnpx",
  args: ["@agentclientprotocol/claude-agent-acp"],
  cwd: process.cwd(),
  env: {},
  showThoughts: false,
};

/**
 * Resolve preset by name
 */
export function resolvePreset(
  presetName: string
): { id: string; preset: (typeof PRESETS)[keyof typeof PRESETS] } | null {
  const preset = PRESETS[presetName];
  if (!preset) return null;
  return { id: presetName, preset };
}

/**
 * Emoji mapping for reaction phases.
 */
export const DEFAULT_EMOJI_MAP: Record<ReactionPhase, string> = {
  thought: "🤔",
  tool: "🔧",
  done: "✅",
};

/**
 * Minimum delay between reaction API calls (ms).
 */
export const REACTION_DEBOUNCE_MS = 500;
