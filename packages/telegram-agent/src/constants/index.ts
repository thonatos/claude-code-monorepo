import os from 'os';
import path from 'path';

/**
 * Agent Presets
 */
export const PRESETS: Record<string, { label: string; command: string; args: string[]; env?: Record<string, string> }> = {
  claude: {
    label: 'Claude Code',
    command: 'pnpx',
    args: ['@agentclientprotocol/claude-agent-acp'],
  },
  codex: {
    label: 'Codex CLI',
    command: 'pnpx',
    args: ['@zed-industries/codex-acp'],
  },
  copilot: {
    label: 'GitHub Copilot',
    command: 'pnpx',
    args: ['@github/copilot', '--acp', '--yolo'],
  },
};

/**
 * Default storage directory
 */
export function defaultStorageDir(): string {
  return path.join(os.homedir(), '.telegram-agent');
}

/**
 * Default media directory
 */
export function defaultMediaDir(): string {
  return path.join(defaultStorageDir(), 'media');
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
 * Default webhook config
 */
export const DEFAULT_WEBHOOK_CONFIG = {
  token: 'default-webhook-token',
  enableAuth: true,
};

/**
 * Default agent config
 */
export const DEFAULT_AGENT_CONFIG = {
  preset: 'claude',
  command: 'pnpx',
  args: ['@agentclientprotocol/claude-agent-acp'],
  cwd: process.cwd(),
  env: {},
  showThoughts: false,
};

/**
 * Resolve preset by name
 */
export function resolvePreset(presetName: string): { id: string; preset: typeof PRESETS[keyof typeof PRESETS] } | null {
  const preset = PRESETS[presetName];
  if (!preset) return null;
  return { id: presetName, preset };
}
