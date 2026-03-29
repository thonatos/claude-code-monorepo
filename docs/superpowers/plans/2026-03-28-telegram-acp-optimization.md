# telegram-acp Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify telegram-acp CLI, reduce presets to 3, flatten project structure to 6 files with clear responsibilities, and clean up verbose debug logs.

**Architecture:** Flatten nested directories into flat `src/` structure. Each file has single responsibility: config handles types/loading, session manages lifecycle, bot handles Telegram integration, bridge orchestrates. Inline middleware and handlers into bot.ts.

**Tech Stack:** TypeScript, grammy (Telegram Bot API), @agentclientprotocol/sdk, pnpm monorepo

---

## File Structure Map

| File | Responsibility | Source |
|------|---------------|--------|
| `src/config.ts` | Config types, defaults, preset definitions, loadConfig() | Rewrite from existing |
| `src/client.ts` | ACP client (permission, session updates, buffer) | Keep existing, update imports |
| `src/session.ts` | Session lifecycle + agent spawning | Merge `acp/session.ts` + `acp/agent-manager.ts` |
| `src/bot.ts` | Bot setup, auth, session middleware, message handler | Merge `bot.ts` + `middleware/*` + `handlers/*` |
| `src/bridge.ts` | Orchestration (start/stop bot + session manager) | Adapt to new interfaces |
| `src/index.ts` | Package exports | Keep existing |
| `src/bin/telegram-acp.ts` | CLI entry (preset/config args only) | Simplify from existing |

**Delete:** `src/middleware/auth.ts`, `src/middleware/acp-session.ts`, `src/handlers/message.ts`, `src/adapter/outbound.ts`, `src/acp/agent-manager.ts`

---

### Task 1: Rewrite config.ts

**Files:**
- Modify: `packages/telegram-acp/src/config.ts` (full rewrite)

- [ ] **Step 1: Write the new config.ts with simplified presets and loadConfig**

```typescript
/**
 * Configuration types and defaults for telegram-acp.
 */

import path from "node:path";
import os from "node:os";
import fs from "node:fs";

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
    command: "npx",
    args: ["@github/copilot", "--acp", "--yolo"],
  },
  claude: {
    label: "Claude Code",
    command: "pnpx",
    args: ["@agentclientprotocol/claude-agent-acp"],
  },
  codex: {
    label: "Codex CLI",
    command: "npx",
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
  const filePath = configPath ?? path.join(defaultStorageDir(), "config.json");

  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf-8");
    const fileConfig = JSON.parse(content) as Partial<TelegramAcpConfig>;

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
```

- [ ] **Step 2: Commit config.ts changes**

```bash
git add packages/telegram-acp/src/config.ts
git commit -m "refactor: simplify config.ts with 3 presets and loadConfig()"
```

---

### Task 2: Simplify CLI (bin/telegram-acp.ts)

**Files:**
- Modify: `packages/telegram-acp/src/bin/telegram-acp.ts` (full rewrite)

- [ ] **Step 1: Write simplified CLI with only --preset and --config**

```typescript
#!/usr/bin/env node

/**
 * telegram-acp CLI entry point.
 */

import path from "node:path";
import { TelegramAcpBridge } from "../bridge.js";
import { loadConfig, listPresets, defaultStorageDir } from "../config.js";
import type { TelegramAcpConfig } from "../config.js";

function usage(): void {
  const presets = listPresets()
    .map(({ id }) => id)
    .join(", ");

  console.log(`
telegram-acp — Bridge Telegram to ACP-compatible AI agents

Usage:
  telegram-acp --preset <name>    Start with preset (config from ~/.telegram-acp/config.json)
  telegram-acp --config <file>    Start with config file
  telegram-acp agents             List available presets
  telegram-acp                    Start with default config

Presets: ${presets}

Config file format (~/.telegram-acp/config.json):
  {
    "telegram": { "botToken": "..." },
    "agent": { "preset": "claude" },
    "proxy": "socks5://...",
    "allowedUsers": ["12345"],
    "open": false,
    "reaction": { "enabled": true }
  }
`);
}

function parseArgs(argv: string[]): {
  preset?: string;
  configFile?: string;
  help: boolean;
} {
  const result: { preset?: string; configFile?: string; help: boolean } = {
    help: false,
  };

  const args = argv.slice(2);
  let i = 0;

  // Check for subcommand first
  if (args[0] && !args[0].startsWith("-")) {
    if (args[0] === "agents") {
      handleAgents();
      process.exit(0);
    }
    if (args[0] === "-h" || args[0] === "--help") {
      usage();
      process.exit(0);
    }
    console.error(`Unknown command: ${args[0]}`);
    usage();
    process.exit(1);
  }

  while (i < args.length) {
    const arg = args[i];
    switch (arg) {
      case "--preset":
        result.preset = args[++i];
        break;
      case "--config":
        result.configFile = args[++i];
        break;
      case "-h":
      case "--help":
        result.help = true;
        break;
      default:
        if (arg?.startsWith("-")) {
          console.error(`Unknown option: ${arg}`);
          usage();
          process.exit(1);
        }
    }
    i++;
  }

  return result;
}

function handleAgents(): void {
  console.log("Available presets:\n");
  for (const { id, preset } of listPresets()) {
    const cmd = [preset.command, ...preset.args].join(" ");
    console.log(`  ${id.padEnd(8)} ${preset.label}`);
    console.log(`           ${cmd}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.help) {
    usage();
    process.exit(0);
  }

  const config = loadConfig(args.configFile, args.preset);

  // Validate bot token
  if (!config.telegram.botToken) {
    console.error("Error: botToken not configured");
    console.error("Add 'telegram.botToken' to ~/.telegram-acp/config.json");
    process.exit(1);
  }

  // Validate agent
  if (!config.agent.command) {
    console.error("Error: agent not configured");
    console.error("Use --preset <name> or add 'agent.preset' to config");
    process.exit(1);
  }

  // Setup logger
  const log = (msg: string) => {
    const ts = new Date().toISOString().substring(11, 19);
    console.log(`[${ts}] ${msg}`);
  };
  config.log = log;

  const bridge = new TelegramAcpBridge(config);

  const shutdown = async () => {
    await bridge.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  try {
    await bridge.start();
  } catch (err: any) {
    console.error(`Fatal: ${err.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Fatal: ${String(err)}`);
  process.exit(1);
});
```

- [ ] **Step 2: Commit CLI changes**

```bash
git add packages/telegram-acp/src/bin/telegram-acp.ts
git commit -m "refactor: simplify CLI to --preset and --config only"
```

---

### Task 3: Create session.ts (merge session + agent-manager)

**Files:**
- Create: `packages/telegram-acp/src/session.ts`
- Delete: `packages/telegram-acp/src/acp/session.ts`, `packages/telegram-acp/src/acp/agent-manager.ts`

- [ ] **Step 1: Write merged session.ts with clear logic flow**

```typescript
/**
 * Session lifecycle management: spawn agent, manage idle timeout, cleanup.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { Writable, Readable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";
import { TelegramAcpClient } from "./client.js";
import packageJson from "../package.json" with { type: "json" };
import type { SessionConfig, TelegramAcpConfig } from "./config.js";

export interface UserSession {
  userId: string;
  client: TelegramAcpClient;
  connection: acp.ClientSideConnection;
  sessionId: string;
  process: ChildProcess;
  lastActivity: number;
}

export interface SessionManagerOpts {
  agentCommand: string;
  agentArgs: string[];
  agentCwd: string;
  agentEnv?: Record<string, string>;
  sessionConfig: SessionConfig;
  showThoughts: boolean;
  log: (msg: string) => void;
  onReply: (userId: string, text: string) => Promise<void>;
}

export class SessionManager {
  private sessions = new Map<string, UserSession>();
  private timers = new Map<string, NodeJS.Timeout>();
  private opts: SessionManagerOpts;

  constructor(opts: SessionManagerOpts) {
    this.opts = opts;
  }

  /**
   * Get existing session or create new one for user.
   */
  async getOrCreate(userId: string): Promise<UserSession> {
    const existing = this.sessions.get(userId);
    if (existing) {
      existing.lastActivity = Date.now();
      this.resetIdleTimer(userId);
      return existing;
    }

    // Check capacity and evict if needed
    if (this.sessions.size >= this.opts.sessionConfig.maxConcurrentUsers) {
      this.evictOldest();
    }

    return this.create(userId);
  }

  /**
   * Stop all sessions and cleanup.
   */
  async stop(): Promise<void> {
    for (const [userId, session] of this.sessions) {
      this.opts.log(`[session] Stopping for ${userId}`);
      this.killAgent(session.process);
    }
    this.sessions.clear();

    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  // --- Private methods ---

  private async create(userId: string): Promise<UserSession> {
    this.opts.log(`[session] Creating for ${userId}`);

    const client = new TelegramAcpClient({
      onThoughtFlush: (text: string) => this.opts.onReply(userId, text),
      log: (msg: string) => this.opts.log(`[${userId}] ${msg}`),
      showThoughts: this.opts.showThoughts,
    });

    const { process, connection, sessionId } = await this.spawnAgent(userId, client);

    const session: UserSession = {
      userId,
      client,
      connection,
      sessionId,
      process,
      lastActivity: Date.now(),
    };

    // Cleanup on process exit
    process.on("exit", (code, signal) => {
      this.opts.log(`[agent] ${userId} exited code=${code ?? "?"} signal=${signal ?? "?"}`);
      const s = this.sessions.get(userId);
      if (s && s.process === process) {
        this.sessions.delete(userId);
        this.timers.delete(userId);
      }
    });

    this.sessions.set(userId, session);
    this.resetIdleTimer(userId);

    return session;
  }

  private async spawnAgent(
    userId: string,
    client: TelegramAcpClient,
  ): Promise<{ process: ChildProcess; connection: acp.ClientSideConnection; sessionId: string }> {
    const { agentCommand, agentArgs, agentCwd, agentEnv, log } = this.opts;
    const cmdLine = [agentCommand, ...agentArgs].join(" ");
    log(`[agent] Spawning for ${userId}: ${cmdLine}`);

    const useShell = process.platform === "win32";
    const proc = spawn(agentCommand, agentArgs, {
      stdio: ["pipe", "pipe", "inherit"],
      cwd: agentCwd,
      env: { ...process.env, ...agentEnv },
      shell: useShell,
    });

    proc.on("error", (err) => log(`[agent] Process error: ${String(err)}`));

    if (!proc.stdin || !proc.stdout) {
      proc.kill();
      throw new Error("Failed to get agent process stdio");
    }

    const input = Writable.toWeb(proc.stdin);
    const output = Readable.toWeb(proc.stdout) as ReadableStream<Uint8Array>;
    const stream = acp.ndJsonStream(input, output);
    const connection = new acp.ClientSideConnection(() => client, stream);

    log("[acp] Initializing connection...");
    const initResult = await connection.initialize({
      protocolVersion: acp.PROTOCOL_VERSION,
      clientInfo: {
        name: packageJson.name,
        title: packageJson.name,
        version: packageJson.version,
      },
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
      },
    });
    log(`[acp] Initialized v${initResult.protocolVersion}`);

    log("[acp] Creating session...");
    const sessionResult = await connection.newSession({
      cwd: agentCwd,
      mcpServers: [],
    });
    log(`[acp] Session: ${sessionResult.sessionId}`);

    return { process: proc, connection, sessionId: sessionResult.sessionId };
  }

  private killAgent(proc: ChildProcess): void {
    if (!proc.killed) {
      proc.kill("SIGTERM");
      setTimeout(() => {
        if (!proc.killed) proc.kill("SIGKILL");
      }, 5000).unref();
    }
  }

  private resetIdleTimer(userId: string): void {
    if (this.opts.sessionConfig.idleTimeoutMs <= 0) return;

    const existing = this.timers.get(userId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.opts.log(`[session] ${userId} idle, removing`);
      const session = this.sessions.get(userId);
      if (session) {
        this.killAgent(session.process);
        this.sessions.delete(userId);
      }
      this.timers.delete(userId);
    }, this.opts.sessionConfig.idleTimeoutMs);

    this.timers.set(userId, timer);
  }

  private evictOldest(): void {
    let oldest: { userId: string; lastActivity: number } | null = null;

    for (const [userId, session] of this.sessions) {
      if (!oldest || session.lastActivity < oldest.lastActivity) {
        oldest = { userId, lastActivity: session.lastActivity };
      }
    }

    if (oldest) {
      this.opts.log(`[session] Evicting oldest: ${oldest.userId}`);
      const session = this.sessions.get(oldest.userId);
      if (session) {
        this.killAgent(session.process);
        this.sessions.delete(oldest.userId);
        this.timers.delete(oldest.userId);
      }
    }
  }
}
```

- [ ] **Step 2: Delete old files**

```bash
rm packages/telegram-acp/src/acp/session.ts
rm packages/telegram-acp/src/acp/agent-manager.ts
```

- [ ] **Step 3: Commit session merge**

```bash
git add packages/telegram-acp/src/session.ts
git add -u packages/telegram-acp/src/acp/
git commit -m "refactor: merge session.ts and agent-manager.ts into single session.ts"
```

---

### Task 4: Create bot.ts (merge middleware + handlers)

**Files:**
- Modify: `packages/telegram-acp/src/bot.ts` (full rewrite)
- Delete: `packages/telegram-acp/src/middleware/auth.ts`, `packages/telegram-acp/src/middleware/acp-session.ts`, `packages/telegram-acp/src/handlers/message.ts`

- [ ] **Step 1: Write merged bot.ts with clear layering**

```typescript
/**
 * Telegram bot setup: configuration, middleware, and message handling.
 */

import { Bot, Context } from "grammy";
import { SocksProxyAgent } from "socks-proxy-agent";
import { SessionManager, type UserSession } from "./session.js";
import type { TelegramAcpConfig } from "./config.js";
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
  sessionManager: SessionManager,
): Bot {
  // Bot options (with proxy if configured)
  const botOptions: any = {};
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

  // --- Layer 4: Message handler ---
  bot.on("message", messageHandler);

  // --- Layer 5: Command handlers ---
  bot.command("start", (ctx) => ctx.reply("Telegram ACP ready."));
  bot.command("status", (ctx) => ctx.reply("Running."));

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

  if (!userId) return;

  // Extract message content
  const prompt = extractPrompt(ctx);

  // Build ACP prompt
  const content: acp.ContentBlock = {
    type: "text",
    text: prompt,
  };

  const session = acpCtx.session;

  try {
    // Send prompt to ACP agent
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

    // Send reply
    if (replyText.trim()) {
      await ctx.reply(formatForTelegram(replyText));
    }
  } catch (err) {
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
  await bot.start();
}

export async function stopBot(bot: Bot): Promise<void> {
  await bot.stop();
}
```

- [ ] **Step 2: Delete old files**

```bash
rm packages/telegram-acp/src/middleware/auth.ts
rm packages/telegram-acp/src/middleware/acp-session.ts
rm packages/telegram-acp/src/handlers/message.ts
rm packages/telegram-acp/src/adapter/outbound.ts
rmdir packages/telegram-acp/src/middleware
rmdir packages/telegram-acp/src/handlers
rmdir packages/telegram-acp/src/adapter
```

- [ ] **Step 3: Commit bot merge**

```bash
git add packages/telegram-acp/src/bot.ts
git add -u packages/telegram-acp/src/middleware/
git add -u packages/telegram-acp/src/handlers/
git add -u packages/telegram-acp/src/adapter/
git commit -m "refactor: merge middleware and handlers into bot.ts"
```

---

### Task 5: Move client.ts to src root

**Files:**
- Move: `packages/telegram-acp/src/acp/client.ts` → `packages/telegram-acp/src/client.ts`

- [ ] **Step 1: Move client.ts to src root**

```bash
mv packages/telegram-acp/src/acp/client.ts packages/telegram-acp/src/client.ts
```

- [ ] **Step 2: Commit the move**

```bash
git add packages/telegram-acp/src/client.ts
git add -u packages/telegram-acp/src/acp/client.ts
git commit -m "refactor: move client.ts to src root"
```

---

### Task 6: Update bridge.ts for new interfaces

**Files:**
- Modify: `packages/telegram-acp/src/bridge.ts`

- [ ] **Step 1: Update bridge.ts to use new session.ts and bot.ts**

```typescript
/**
 * TelegramAcpBridge — orchestration layer.
 */

import { createBot, startBot, stopBot, type Bot } from "./bot.js";
import { SessionManager } from "./session.js";
import type { TelegramAcpConfig } from "./config.js";

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
      sessionConfig: this.config.session,
      showThoughts: this.config.agent.showThoughts,
      log: this.log,
      onReply: async (userId: string, text: string) => {
        if (this.bot) {
          await this.bot.api.sendMessage(userId, text);
        }
      },
    });

    // Create and start bot
    this.bot = createBot(
      this.config.telegram.botToken,
      this.config,
      this.sessionManager,
    );

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
}
```

- [ ] **Step 2: Commit bridge.ts update**

```bash
git add packages/telegram-acp/src/bridge.ts
git commit -m "refactor: update bridge.ts for new session and bot interfaces"
```

---

### Task 7: Update client.ts logging

**Files:**
- Modify: `packages/telegram-acp/src/client.ts`

- [ ] **Step 1: Update logging format in client.ts**

The existing client.ts already has proper logging. Just update the import path and ensure log format matches spec:

```typescript
// No changes needed to logging format, but verify:
// - [permission] auto-allowed: ${title} ✓ (already correct)
// - [tool] ${title} (${status}) ✓ (already correct)
// - [tool] ${id} → ${status} ✓ (already correct)
// - [thought] truncated to 80 chars ✓ (already correct)
// - [plan] entries ✓ (already correct)
```

No changes needed - existing logging format matches spec.

- [ ] **Step 2: Verify and commit if any changes**

```bash
# No changes needed, skip commit
```

---

### Task 8: Cleanup empty directories and update exports

**Files:**
- Delete: `packages/telegram-acp/src/acp/` directory (should be empty)
- Verify: `packages/telegram-acp/src/index.ts`

- [ ] **Step 1: Remove empty acp directory**

```bash
rmdir packages/telegram-acp/src/acp
```

- [ ] **Step 2: Verify index.ts exports are correct**

```typescript
export { TelegramAcpBridge } from "./bridge.js";
export type { TelegramAcpConfig } from "./config.js";
export type { UserSession } from "./session.js";
export { SessionManager } from "./session.js";
```

- [ ] **Step 3: Update index.ts if needed**

```typescript
export { TelegramAcpBridge } from "./bridge.js";
export type { TelegramAcpConfig } from "./config.js";
export type { UserSession, SessionManagerOpts } from "./session.js";
export { SessionManager } from "./session.js";
export { PRESETS, loadConfig, listPresets } from "./config.js";
```

- [ ] **Step 4: Commit cleanup**

```bash
git add packages/telegram-acp/src/index.ts
git add -u packages/telegram-acp/src/acp/
git commit -m "refactor: cleanup empty directories and update exports"
```

---

### Task 9: Build and verify

- [ ] **Step 1: Build the package**

```bash
cd packages/telegram-acp && pnpm run build
```

Expected: TypeScript compiles without errors.

- [ ] **Step 2: Test CLI agents command**

```bash
node packages/telegram-acp/dist/bin/telegram-acp.js agents
```

Expected output:
```
Available presets:

  claude    Claude Code
           pnpx @agentclientprotocol/claude-agent-acp
  codex     Codex CLI
           npx @zed-industries/codex-acp
  copilot   GitHub Copilot
           npx @github/copilot --acp --yolo
```

- [ ] **Step 3: Test CLI help**

```bash
node packages/telegram-acp/dist/bin/telegram-acp.js --help
```

Expected: Shows usage with only `--preset` and `--config` options.

- [ ] **Step 4: Commit final verification**

```bash
git add -A
git commit -m "chore: verify build and tests pass"
```

---

## Success Criteria Checklist

- [ ] CLI has only 2 options: `--preset` and `--config`
- [ ] CLI utility commands removed: `stop`, `status`, `test`, `whoami`, `daemon`
- [ ] 3 presets: `copilot`, `claude`, `codex`
- [ ] 6 source files in flat `src/` structure (no subdirectories)
- [ ] Each file has single clear responsibility
- [ ] All verbose debug logs removed
- [ ] Build passes: `pnpm run build`
- [ ] `agents` command works and shows 3 presets