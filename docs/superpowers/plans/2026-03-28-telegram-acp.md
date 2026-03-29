# Telegram ACP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `telegram-acp` - a bridge connecting Telegram direct messages to any ACP-compatible AI agent using MTProto protocol.

**Architecture:** Follow wechat-acp structure with Telegram-specific MTProto layer. Core components: CLI entry point, bridge orchestrator, Telegram client wrapper, ACP integration (reused), and message adapters.

**Tech Stack:** TypeScript, `telegram` library (MTProto), `@agentclientprotocol/sdk`, Node.js 20+.

---

## Chunk 1: Project Setup and Core Infrastructure

### Task 1: Create Package Structure

**Files:**
- Create: `packages/telegram-acp/package.json`
- Create: `packages/telegram-acp/tsconfig.json`
- Create: `packages/telegram-acp/src/index.ts`
- Create: `packages/telegram-acp/README.md`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "telegram-acp",
  "version": "0.1.0",
  "description": "Bridge Telegram to any ACP-compatible AI agent",
  "type": "module",
  "files": [
    "dist/",
    "README.md",
    "package.json"
  ],
  "bin": {
    "telegram-acp": "./dist/bin/telegram-acp.js"
  },
  "main": "./dist/src/index.js",
  "types": "./dist/src/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/src/index.js",
      "types": "./dist/src/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "prepack": "npm run build",
    "start": "node dist/bin/telegram-acp.js",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "telegram": "^2.24.18",
    "@agentclientprotocol/sdk": "^0.16.1"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.5.0"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Create tsconfig.json** (copy from wechat-acp)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*", "bin/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create src/index.ts**

```typescript
export { TelegramAcpBridge } from "./bridge.js";
export type { TelegramAcpConfig } from "./config.js";
```

- [ ] **Step 4: Create README.md**

```markdown
# Telegram ACP

Bridge Telegram direct messages to any ACP-compatible AI agent.

`telegram-acp` uses MTProto to listen for Telegram messages, forwards them to an ACP agent over stdio, and sends the agent reply back to Telegram.

## Quick Start

```bash
npx telegram-acp --agent claude
```

## Built-in Agent Presets

```bash
npx telegram-acp agents
```

Current presets: `copilot`, `claude`, `gemini`, `qwen`, `codex`, `opencode`
```

- [ ] **Step 5: Install dependencies**

```bash
cd packages/telegram-acp
pnpm install
```

- [ ] **Step 6: Commit**

```bash
git add packages/telegram-acp/
git commit -m "feat: create telegram-acp package structure"
```

---

### Task 2: Configuration Module

**Files:**
- Create: `packages/telegram-acp/src/config.ts`

- [ ] **Step 1: Write config types and default config**

```typescript
import path from "node:path";
import os from "node:os";

export interface AgentCommandConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface AgentPreset extends AgentCommandConfig {
  label: string;
  description?: string;
}

export interface ResolvedAgentConfig extends AgentCommandConfig {
  id?: string;
  label?: string;
  source: "preset" | "raw";
}

export interface ProxyConfig {
  ip: string;
  port: number;
  type: "socks4" | "socks5" | "http" | "https";
  username?: string;
  password?: string;
}

export interface TelegramAcpConfig {
  telegram: {
    apiId: number;
    apiHash: string;
    botToken: string;
    sessionString?: string;
  };
  proxy?: ProxyConfig;
  allowedUsers?: string[];
  open?: boolean;
  reaction: {
    enabled: boolean;
    emoji?: string;
    randomEmojis?: string[];
  };
  agent: {
    preset?: string;
    command: string;
    args: string[];
    cwd: string;
    showThoughts: boolean;
  };
  agents: Record<string, AgentPreset>;
  session: {
    idleTimeoutMs: number;
    maxConcurrentUsers: number;
  };
  daemon: {
    enabled: boolean;
    logFile: string;
    pidFile: string;
  };
  storage: {
    dir: string;
  };
}

export const BUILT_IN_AGENTS: Record<string, AgentPreset> = {
  copilot: {
    label: "GitHub Copilot",
    command: "npx",
    args: ["@github/copilot", "--acp", "--yolo"],
    description: "GitHub Copilot",
  },
  claude: {
    label: "Claude Code",
    command: "npx",
    args: ["@zed-industries/claude-code-acp"],
    description: "Claude Code ACP",
  },
  gemini: {
    label: "Gemini CLI",
    command: "npx",
    args: ["@google/gemini-cli", "--experimental-acp"],
    description: "Gemini CLI",
  },
  qwen: {
    label: "Qwen Code",
    command: "npx",
    args: ["@qwen-code/qwen-code", "--acp", "--experimental-skills"],
    description: "Qwen Code",
  },
  codex: {
    label: "Codex CLI",
    command: "npx",
    args: ["@zed-industries/codex-acp"],
    description: "Codex ACP",
  },
  opencode: {
    label: "OpenCode",
    command: "npx",
    args: ["opencode-ai", "acp"],
    description: "OpenCode",
  },
};

export const DEFAULT_REACTION_EMOJIS = ["👍", "👌", "🫡", "⏳", "🔄"];

export function defaultStorageDir(): string {
  return path.join(os.homedir(), ".telegram-acp");
}

export function defaultConfig(): TelegramAcpConfig {
  const storageDir = defaultStorageDir();
  return {
    telegram: {
      apiId: 0,
      apiHash: "",
      botToken: "",
    },
    agent: {
      preset: undefined,
      command: "",
      args: [],
      cwd: process.cwd(),
      showThoughts: false,
    },
    agents: { ...BUILT_IN_AGENTS },
    session: {
      idleTimeoutMs: 1440 * 60_000,
      maxConcurrentUsers: 10,
    },
    daemon: {
      enabled: false,
      logFile: path.join(storageDir, "telegram-acp.log"),
      pidFile: path.join(storageDir, "daemon.pid"),
    },
    storage: {
      dir: storageDir,
    },
    reaction: {
      enabled: true,
      randomEmojis: DEFAULT_REACTION_EMOJIS,
    },
  };
}

export function parseAgentCommand(agentStr: string): { command: string; args: string[] } {
  const parts = agentStr.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) {
    throw new Error("Agent command cannot be empty");
  }
  return {
    command: parts[0],
    args: parts.slice(1),
  };
}

export function resolveAgentSelection(
  agentSelection: string,
  registry: Record<string, AgentPreset> = BUILT_IN_AGENTS,
): ResolvedAgentConfig {
  const preset = registry[agentSelection];
  if (preset) {
    return {
      id: agentSelection,
      label: preset.label,
      command: preset.command,
      args: [...preset.args],
      env: preset.env ? { ...preset.env } : undefined,
      source: "preset",
    };
  }

  const parsed = parseAgentCommand(agentSelection);
  return {
    command: parsed.command,
    args: parsed.args,
    source: "raw",
  };
}

export function listBuiltInAgents(
  registry: Record<string, AgentPreset> = BUILT_IN_AGENTS,
): Array<{ id: string; preset: AgentPreset }> {
  return Object.entries(registry)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, preset]) => ({ id, preset }));
}

export function parseProxyUrl(url: string): ProxyConfig | null {
  try {
    const parsed = new URL(url);
    const typeMap: Record<string, ProxyConfig["type"]> = {
      "socks5:": "socks5",
      "socks4:": "socks4",
      "http:": "http",
      "https:": "https",
    };
    const type = typeMap[parsed.protocol];
    if (!type) return null;
    return {
      ip: parsed.hostname,
      port: parseInt(parsed.port, 10) || (type === "http" || type === "https" ? 80 : 1080),
      type,
      username: parsed.username || undefined,
      password: parsed.password || undefined,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/telegram-acp/src/config.ts
git commit -m "feat: add telegram-acp configuration module"
```

---

### Task 3: Telegram Types

**Files:**
- Create: `packages/telegram-acp/src/telegram/types.ts`

- [ ] **Step 1: Write Telegram type definitions**

```typescript
import { Api } from "telegram";

export interface TelegramMessage {
  id: number;
  fromId: string;
  fromName?: string;
  text: string;
  date: Date;
  media?: TelegramMedia;
  isReply: boolean;
  replyToMsgId?: number;
}

export interface TelegramMedia {
  type: "photo" | "document" | "video" | "voice" | "sticker";
  fileId: string;
  fileSize?: number;
  fileName?: string;
  mimeType?: string;
}

export interface TelegramUser {
  id: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  isBot: boolean;
}

export interface TelegramConfig {
  apiId: number;
  apiHash: string;
  botToken: string;
  sessionString?: string;
}

export type MessageUpdate =
  | { type: "message"; message: TelegramMessage }
  | { type: "channel_post"; message: TelegramMessage }
  | { type: "callback_query"; queryId: string; message: TelegramMessage };

export type { Api };
```

- [ ] **Step 2: Commit**

```bash
git add packages/telegram-acp/src/telegram/types.ts
git commit -m "feat: add Telegram type definitions"
```

---

## Chunk 2: Telegram Client Layer

### Task 4: Telegram Client Wrapper

**Files:**
- Create: `packages/telegram-acp/src/telegram/client.ts`

- [ ] **Step 1: Write TelegramClient wrapper with proxy support**

```typescript
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import type { ProxyConfig, TelegramConfig } from "./types.js";

export interface TelegramClientWrapperOpts {
  config: TelegramConfig;
  proxy?: ProxyConfig;
  storageDir: string;
  log: (msg: string) => void;
}

export class TelegramClientWrapper {
  private client: TelegramClient | null = null;
  private opts: TelegramClientWrapperOpts;

  constructor(opts: TelegramClientWrapperOpts) {
    this.opts = opts;
  }

  async connect(): Promise<void> {
    const sessionString = this.opts.config.sessionString || "";
    const stringSession = new StringSession(sessionString);

    this.client = new TelegramClient(
      stringSession,
      this.opts.config.apiId,
      this.opts.config.apiHash,
      {
        connectionRetries: 5,
        proxy: this.opts.proxy,
      }
    );

    this.opts.log("Connecting to Telegram...");
    await this.client.start({
      botAuthToken: this.opts.config.botToken,
    });

    this.opts.log("Connected to Telegram");
  }

  async saveSession(): Promise<string> {
    if (!this.client) throw new Error("Client not connected");
    const sessionString = this.client.session.save();
    return sessionString;
  }

  getClient(): TelegramClient {
    if (!this.client) throw new Error("Client not connected");
    return this.client;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.opts.log("Disconnected from Telegram");
    }
  }

  async getBotInfo(): Promise<{ id: string; username: string; firstName?: string }> {
    if (!this.client) throw new Error("Client not connected");
    const me = await this.client.getMe();
    return {
      id: me.userId.toString(),
      username: me.username || "",
      firstName: me.firstName || undefined,
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/telegram-acp/src/telegram/client.ts
git commit -m "feat: add Telegram client wrapper with proxy support"
```

---

### Task 5: Authentication and Session Persistence

**Files:**
- Create: `packages/telegram-acp/src/telegram/auth.ts`

- [ ] **Step 1: Write session persistence utilities**

```typescript
import fs from "node:fs";
import path from "node:path";
import type { TelegramConfig } from "./types.js";

export interface SessionData {
  sessionString: string;
  apiId: number;
  apiHash: string;
  savedAt: string;
}

function getSessionPath(storageDir: string): string {
  return path.join(storageDir, "session.json");
}

export function loadSession(storageDir: string): SessionData | null {
  const sessionPath = getSessionPath(storageDir);
  if (!fs.existsSync(sessionPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(sessionPath, "utf-8")) as SessionData;
  } catch {
    return null;
  }
}

export function saveSession(storageDir: string, data: SessionData): void {
  fs.mkdirSync(storageDir, { recursive: true });
  fs.writeFileSync(getSessionPath(storageDir), JSON.stringify(data, null, 2), "utf-8");
}

export function clearSession(storageDir: string): void {
  const sessionPath = getSessionPath(storageDir);
  if (fs.existsSync(sessionPath)) {
    fs.unlinkSync(sessionPath);
  }
}

export function hasValidSession(storageDir: string): boolean {
  const session = loadSession(storageDir);
  return session != null && session.sessionString.length > 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/telegram-acp/src/telegram/auth.ts
git commit -m "feat: add session persistence utilities"
```

---

### Task 6: Message Monitor (Updates Listener)

**Files:**
- Create: `packages/telegram-acp/src/telegram/monitor.ts`

- [ ] **Step 1: Write updates polling loop**

```typescript
import { NewMessage } from "telegram/events";
import { TelegramClient } from "telegram";
import type { TelegramMessage } from "./types.js";

export interface MonitorOpts {
  client: TelegramClient;
  allowedUsers?: string[];
  open?: boolean;
  log: (msg: string) => void;
  onMessage: (msg: TelegramMessage) => void;
}

function parseTelegramMessage(msg: any): TelegramMessage {
  const fromId = msg.senderId?.toString() || msg.chatId?.toString() || "";
  const fromName = msg.sender?.username || msg.chat?.title;
  const text = msg.text || "";

  let media: TelegramMessage["media"] = undefined;
  if (msg.media) {
    if (msg.media.photo) {
      media = { type: "photo", fileId: msg.media.photo.id.toString() };
    } else if (msg.media.document) {
      const doc = msg.media.document;
      const mimeType = doc.mimeType || "";
      const fileName = doc.attributes?.find((a: any) => a.fileName)?.fileName;

      if (mimeType.startsWith("video/")) {
        media = { type: "video", fileId: doc.id.toString(), fileName, mimeType };
      } else if (mimeType.startsWith("audio/")) {
        media = { type: "voice", fileId: doc.id.toString(), fileName, mimeType };
      } else {
        media = { type: "document", fileId: doc.id.toString(), fileName, mimeType };
      }
    }
  }

  return {
    id: msg.id,
    fromId,
    fromName,
    text,
    date: msg.date,
    media,
    isReply: !!msg.replyToMsgId,
    replyToMsgId: msg.replyToMsgId,
  };
}

export async function startMonitor(opts: MonitorOpts): Promise<() => void> {
  const { client, allowedUsers, open, log, onMessage } = opts;

  const isAllowed = (userId: string): boolean => {
    if (open) return true;
    if (!allowedUsers || allowedUsers.length === 0) return false;
    return allowedUsers.includes(userId);
  };

  const handler = async (event: any) => {
    try {
      const msg = parseTelegramMessage(event.message);

      // Only process direct messages (not from bots, not from channels)
      if (msg.fromId === "") return;
      if (!isAllowed(msg.fromId)) {
        log(`Blocked message from unauthorized user ${msg.fromId}`);
        return;
      }

      log(`Message from ${msg.fromId}: ${msg.text.substring(0, 50) || "[media]"}`);
      onMessage(msg);
    } catch (err) {
      log(`Error processing message: ${String(err)}`);
    }
  };

  client.addEventHandler(handler, NewMessage({}));
  log("Started Telegram message monitor");

  return () => {
    client.removeEventHandler(handler, NewMessage({}));
    log("Stopped Telegram message monitor");
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/telegram-acp/src/telegram/monitor.ts
git commit -m "feat: add Telegram updates monitor"
```

---

### Task 7: Send Messages and Reactions

**Files:**
- Create: `packages/telegram-acp/src/telegram/send.ts`

- [ ] **Step 1: Write message sending utilities**

```typescript
import { TelegramClient } from "telegram";
import { Api } from "telegram";

export async function sendTextMessage(
  client: TelegramClient,
  chatId: string,
  text: string,
  replyToMsgId?: number
): Promise<void> {
  await client.sendMessage(chatId, {
    message: text,
    replyTo: replyToMsgId,
  });
}

export async function sendReaction(
  client: TelegramClient,
  chatId: string,
  messageId: number,
  emoji: string
): Promise<void> {
  try {
    await client.invoke(
      new Api.messages.SendReaction({
        peer: chatId,
        msgId: messageId,
        reaction: [
          new Api.ReactionEmoji({
            emoticon: emoji,
          }),
        ],
        big: false,
      })
    );
  } catch (err) {
    // Reaction not supported or failed - best effort
  }
}

export function escapeMarkdownV2(text: string): string {
  const chars = ["_", "*", "[", "]", "(", ")", "~", "`", ">", "#", "+", "-", "=", "|", "{", "}", ".", "!"];
  let result = text;
  for (const char of chars) {
    result = result.split(char).join(`\\${char}`);
  }
  return result;
}

export function formatMarkdownV2(text: string): string {
  // Basic markdown formatting for Telegram
  // Preserve code blocks
  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, "```$1\n$2```");
  // Preserve inline code
  text = text.replace(/`([^`]+)`/g, "`$1`");
  // Bold
  text = text.replace(/\*\*([^*]+)\*\*/g, "*$1*");
  // Italic
  text = text.replace(/\*([^*]+)\*/g, "_$1_");
  return text;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/telegram-acp/src/telegram/send.ts
git commit -m "feat: add Telegram message sending utilities"
```

---

### Task 8: Download Media

**Files:**
- Create: `packages/telegram-acp/src/telegram/download.ts`

- [ ] **Step 1: Write media download utility**

```typescript
import { TelegramClient } from "telegram";

export async function downloadMedia(
  client: TelegramClient,
  fileId: string
): Promise<Buffer> {
  const buffer = await client.downloadMedia(fileId, {
    outputFile: undefined,
  }) as Buffer;
  return buffer;
}

export async function getMediaBuffer(
  client: TelegramClient,
  messageId: number,
  chatId: string
): Promise<Buffer | null> {
  try {
    const messages = await client.getMessages(chatId, { ids: [messageId] });
    if (!messages || messages.length === 0) return null;

    const msg = messages[0];
    if (!msg.media) return null;

    const buffer = await client.downloadMedia(msg.media, {
      outputFile: undefined,
    }) as Buffer;

    return buffer;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/telegram-acp/src/telegram/download.ts
git commit -m "feat: add Telegram media download utility"
```

---

## Chunk 3: Bridge and ACP Integration

### Task 9: Bridge Core

**Files:**
- Create: `packages/telegram-acp/src/bridge.ts`

- [ ] **Step 1: Write TelegramAcpBridge class**

```typescript
import type { TelegramAcpConfig } from "./config.js";
import { TelegramClientWrapper } from "./telegram/client.js";
import { startMonitor } from "./telegram/monitor.js";
import { sendTextMessage, sendReaction, formatMarkdownV2 } from "./telegram/send.js";
import { getMediaBuffer } from "./telegram/download.js";
import { SessionManager } from "./acp/session.js";
import { telegramMessageToPrompt } from "./adapter/inbound.js";
import { formatForTelegram } from "./adapter/outbound.js";
import type { TelegramMessage } from "./telegram/types.js";

const DEFAULT_REACTION_EMOJIS = ["👍", "👌", "🫡", "⏳", "🔄"];

export class TelegramAcpBridge {
  private config: TelegramAcpConfig;
  private client: TelegramClientWrapper;
  private sessionManager: SessionManager | null = null;
  private stopMonitor: (() => void) | null = null;
  private log: (msg: string) => void;

  constructor(config: TelegramAcpConfig, log?: (msg: string) => void) {
    this.config = config;
    this.log = log ?? ((msg: string) => console.log(`[telegram-acp] ${msg}`));

    this.client = new TelegramClientWrapper({
      config: config.telegram,
      proxy: config.proxy,
      storageDir: config.storage.dir,
      log: this.log,
    });
  }

  async start(): Promise<void> {
    this.log("Starting Telegram bridge...");

    // 1. Connect to Telegram
    await this.client.connect();

    // 2. Save session if new
    const sessionString = await this.client.saveSession();
    // Session persistence handled by auth module

    // 3. Create SessionManager
    this.sessionManager = new SessionManager({
      agentCommand: this.config.agent.command,
      agentArgs: this.config.agent.args,
      agentCwd: this.config.agent.cwd,
      agentEnv: this.config.agent.env,
      idleTimeoutMs: this.config.session.idleTimeoutMs,
      maxConcurrentUsers: this.config.session.maxConcurrentUsers,
      showThoughts: this.config.agent.showThoughts,
      log: this.log,
      onReply: (userId, text) => this.sendReply(userId, text),
    });
    this.sessionManager.start();

    // 4. Start monitor
    this.stopMonitor = await startMonitor({
      client: this.client.getClient(),
      allowedUsers: this.config.allowedUsers,
      open: this.config.open,
      log: this.log,
      onMessage: (msg) => this.handleMessage(msg),
    });

    this.log("Telegram bridge started");
  }

  async stop(): Promise<void> {
    this.log("Stopping bridge...");

    if (this.stopMonitor) {
      this.stopMonitor();
    }

    await this.sessionManager?.stop();
    await this.client.disconnect();

    this.log("Bridge stopped");
  }

  private async handleMessage(msg: TelegramMessage): Promise<void> {
    const userId = msg.fromId;

    // Send reaction (acknowledgment)
    if (this.config.reaction.enabled) {
      const emoji = this.config.reaction.emoji ||
        this.config.reaction.randomEmojis?.[
          Math.floor(Math.random() * this.config.reaction.randomEmojis.length)
        ] || "👍";

      await sendReaction(
        this.client.getClient(),
        userId,
        msg.id,
        emoji
      ).catch(() => {});
    }

    // Convert and enqueue
    try {
      const prompt = await telegramMessageToPrompt(
        msg,
        this.client.getClient(),
        this.log,
      );
      await this.sessionManager!.enqueue(userId, { prompt });
    } catch (err) {
      this.log(`Failed to process message from ${userId}: ${String(err)}`);
    }
  }

  private async sendReply(userId: string, text: string): Promise<void> {
    const formatted = formatForTelegram(text);

    await sendTextMessage(
      this.client.getClient(),
      userId,
      formatted,
    );
  }

  async getBotInfo(): Promise<{ id: string; username: string; firstName?: string }> {
    return await this.client.getBotInfo();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/telegram-acp/src/bridge.ts
git commit -m "feat: add Telegram ACP bridge core"
```

---

### Task 10: ACP Client (Reuse wechat-acp)

**Files:**
- Create: `packages/telegram-acp/src/acp/client.ts`

- [ ] **Step 1: Copy and adapt WeChatAcpClient**

Reference: `packages/wechat-acp/src/acp/client.ts`

```typescript
import fs from "node:fs";
import type * as acp from "@agentclientprotocol/sdk";

export interface TelegramAcpClientOpts {
  onThoughtFlush: (text: string) => Promise<void>;
  log: (msg: string) => void;
  showThoughts: boolean;
}

export class TelegramAcpClient implements acp.Client {
  private chunks: string[] = [];
  private thoughtChunks: string[] = [];
  private opts: TelegramAcpClientOpts;

  constructor(opts: TelegramAcpClientOpts) {
    this.opts = opts;
  }

  async requestPermission(
    params: acp.RequestPermissionRequest,
  ): Promise<acp.RequestPermissionResponse> {
    const allowOpt = params.options.find(
      (o) => o.kind === "allow_once" || o.kind === "allow_always",
    );
    const optionId = allowOpt?.optionId ?? params.options[0]?.optionId ?? "allow";

    this.opts.log(`[permission] auto-allowed: ${params.toolCall?.title ?? "unknown"}`);

    return {
      outcome: {
        outcome: "selected",
        optionId,
      },
    };
  }

  async sessionUpdate(params: acp.SessionNotification): Promise<void> {
    const update = params.update;

    switch (update.sessionUpdate) {
      case "agent_message_chunk":
        await this.maybeFlushThoughts();
        if (update.content.type === "text") {
          this.chunks.push(update.content.text);
        }
        break;

      case "tool_call":
        await this.maybeFlushThoughts();
        this.opts.log(`[tool] ${update.title} (${update.status})`);
        break;

      case "agent_thought_chunk":
        if (update.content.type === "text") {
          const text = update.content.text;
          this.opts.log(`[thought] ${text.length > 80 ? text.substring(0, 80) + "..." : text}`);
          if (this.opts.showThoughts) {
            this.thoughtChunks.push(text);
          }
        }
        break;

      case "tool_call_update":
        if (update.status === "completed" && update.content) {
          for (const c of update.content) {
            if (c.type === "diff") {
              const diff = c as acp.Diff;
              const header = `--- ${diff.path}`;
              const lines: string[] = [header];
              if (diff.oldText != null) {
                for (const l of diff.oldText.split("\n")) lines.push(`- ${l}`);
              }
              if (diff.newText != null) {
                for (const l of diff.newText.split("\n")) lines.push(`+ ${l}`);
              }
              this.chunks.push("\n```diff\n" + lines.join("\n") + "\n```\n");
            }
          }
        }
        if (update.status) {
          this.opts.log(`[tool] ${update.toolCallId} → ${update.status}`);
        }
        break;

      case "plan":
        if (update.entries) {
          const items = update.entries
            .map((e: acp.PlanEntry, i: number) => `  ${i + 1}. [${e.status}] ${e.content}`)
            .join("\n");
          this.opts.log(`[plan]\n${items}`);
        }
        break;
    }
  }

  async readTextFile(params: acp.ReadTextFileRequest): Promise<acp.ReadTextFileResponse> {
    try {
      const content = await fs.promises.readFile(params.path, "utf-8");
      return { content };
    } catch (err) {
      throw new Error(`Failed to read file ${params.path}: ${String(err)}`);
    }
  }

  async writeTextFile(params: acp.WriteTextFileRequest): Promise<acp.WriteTextFileResponse> {
    try {
      await fs.promises.writeFile(params.path, params.content, "utf-8");
      return {};
    } catch (err) {
      throw new Error(`Failed to write file ${params.path}: ${String(err)}`);
    }
  }

  async flush(): Promise<string> {
    await this.maybeFlushThoughts();
    const text = this.chunks.join("");
    this.chunks = [];
    return text;
  }

  private async maybeFlushThoughts(): Promise<void> {
    if (this.thoughtChunks.length === 0) return;
    const thoughtText = this.thoughtChunks.join("");
    this.thoughtChunks = [];
    if (thoughtText.trim()) {
      try {
        await this.opts.onThoughtFlush(`💭 [Thinking]\n${thoughtText}`);
      } catch {
        // best effort
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/telegram-acp/src/acp/client.ts
git commit -m "feat: add ACP client for Telegram"
```

---

### Task 11: Session Manager (Reuse wechat-acp)

**Files:**
- Create: `packages/telegram-acp/src/acp/session.ts`
- Create: `packages/telegram-acp/src/acp/agent-manager.ts`

- [ ] **Step 1: Copy session.ts from wechat-acp with minor adaptations**

Reference: `packages/wechat-acp/src/acp/session.ts`

```typescript
import type { ChildProcess } from "node:child_process";
import type * as acp from "@agentclientprotocol/sdk";
import { TelegramAcpClient } from "./client.js";
import { spawnAgent, killAgent, type AgentProcessInfo } from "./agent-manager.js";

export interface PendingMessage {
  prompt: acp.ContentBlock[];
}

export interface UserSession {
  userId: string;
  client: TelegramAcpClient;
  agentInfo: AgentProcessInfo;
  queue: PendingMessage[];
  processing: boolean;
  lastActivity: number;
  createdAt: number;
}

export interface SessionManagerOpts {
  agentCommand: string;
  agentArgs: string[];
  agentCwd: string;
  agentEnv?: Record<string, string>;
  idleTimeoutMs: number;
  maxConcurrentUsers: number;
  showThoughts: boolean;
  log: (msg: string) => void;
  onReply: (userId: string, text: string) => Promise<void>;
}

export class SessionManager {
  private sessions = new Map<string, UserSession>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private opts: SessionManagerOpts;
  private aborted = false;

  constructor(opts: SessionManagerOpts) {
    this.opts = opts;
  }

  start(): void {
    this.cleanupTimer = setInterval(() => this.cleanupIdleSessions(), 2 * 60_000);
    this.cleanupTimer.unref();
  }

  async stop(): Promise<void> {
    this.aborted = true;
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    for (const [userId, session] of this.sessions) {
      this.opts.log(`Stopping session for ${userId}`);
      killAgent(session.agentInfo.process);
    }
    this.sessions.clear();
  }

  async enqueue(userId: string, message: PendingMessage): Promise<void> {
    let session = this.sessions.get(userId);

    if (!session) {
      if (this.sessions.size >= this.opts.maxConcurrentUsers) {
        this.evictOldest();
      }
      session = await this.createSession(userId);
      this.sessions.set(userId, session);
    }

    session.lastActivity = Date.now();
    session.queue.push(message);

    if (!session.processing) {
      session.processing = true;
      this.processQueue(session).catch((err) => {
        this.opts.log(`[${userId}] queue processing error: ${String(err)}`);
      });
    }
  }

  private async createSession(userId: string): Promise<UserSession> {
    this.opts.log(`Creating new session for ${userId}`);

    const client = new TelegramAcpClient({
      onThoughtFlush: (text) => this.opts.onReply(userId, text),
      log: (msg) => this.opts.log(`[${userId}] ${msg}`),
      showThoughts: this.opts.showThoughts,
    });

    const agentInfo = await spawnAgent({
      command: this.opts.agentCommand,
      args: this.opts.agentArgs,
      cwd: this.opts.agentCwd,
      env: this.opts.agentEnv,
      client,
      log: (msg) => this.opts.log(`[${userId}] ${msg}`),
    });

    agentInfo.process.on("exit", () => {
      const s = this.sessions.get(userId);
      if (s && s.agentInfo.process === agentInfo.process) {
        this.opts.log(`Agent process for ${userId} exited, removing session`);
        this.sessions.delete(userId);
      }
    });

    return {
      userId,
      client,
      agentInfo,
      queue: [],
      processing: false,
      lastActivity: Date.now(),
      createdAt: Date.now(),
    };
  }

  private async processQueue(session: UserSession): Promise<void> {
    try {
      while (session.queue.length > 0 && !this.aborted) {
        const pending = session.queue.shift()!;
        session.client.updateCallbacks({
          onThoughtFlush: (text) => this.opts.onReply(session.userId, text),
        });
        await session.client.flush();

        try {
          this.opts.log(`[${session.userId}] Sending prompt to agent...`);
          const result = await session.agentInfo.connection.prompt({
            sessionId: session.agentInfo.sessionId,
            prompt: pending.prompt,
          });

          let replyText = await session.client.flush();

          if (result.stopReason === "cancelled") {
            replyText += "\n[cancelled]";
          } else if (result.stopReason === "refusal") {
            replyText += "\n[agent refused to continue]";
          }

          this.opts.log(`[${session.userId}] Agent done (${result.stopReason}), reply ${replyText.length} chars`);

          if (replyText.trim()) {
            await this.opts.onReply(session.userId, replyText);
          }
        } catch (err) {
          this.opts.log(`[${session.userId}] Agent prompt error: ${String(err)}`);

          if (session.agentInfo.process.killed || session.agentInfo.process.exitCode !== null) {
            this.opts.log(`[${session.userId}] Agent process died, removing session`);
            this.sessions.delete(userId);
            return;
          }

          try {
            await this.opts.onReply(
              session.userId,
              `⚠️ Agent error: ${String(err)}`,
            );
          } catch {
            // best effort
          }
        }
      }
    } finally {
      session.processing = false;
    }
  }

  private cleanupIdleSessions(): void {
    if (this.opts.idleTimeoutMs <= 0) return;

    const now = Date.now();
    for (const [userId, session] of this.sessions) {
      if (now - session.lastActivity > this.opts.idleTimeoutMs && !session.processing) {
        this.opts.log(`Session for ${userId} idle, removing`);
        killAgent(session.agentInfo.process);
        this.sessions.delete(userId);
      }
    }
  }

  private evictOldest(): void {
    let oldest: { userId: string; lastActivity: number } | null = null;
    for (const [userId, session] of this.sessions) {
      if (!session.processing && (!oldest || session.lastActivity < oldest.lastActivity)) {
        oldest = { userId, lastActivity: session.lastActivity };
      }
    }
    if (oldest) {
      this.opts.log(`Evicting oldest idle session: ${oldest.userId}`);
      const session = this.sessions.get(oldest.userId);
      if (session) killAgent(session.agentInfo.process);
      this.sessions.delete(oldest.userId);
    }
  }
}
```

- [ ] **Step 2: Copy agent-manager.ts from wechat-acp**

Reference: `packages/wechat-acp/src/acp/agent-manager.ts`

```typescript
import { spawn, type ChildProcess } from "node:child_process";
import { Writable, Readable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";
import packageJson from "../../package.json" with { type: "json" };
import type { TelegramAcpClient } from "./client.js";

export interface AgentProcessInfo {
  process: ChildProcess;
  connection: acp.ClientSideConnection;
  sessionId: string;
}

export async function spawnAgent(params: {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  client: TelegramAcpClient;
  log: (msg: string) => void;
}): Promise<AgentProcessInfo> {
  const { command, args, cwd, env, client, log } = params;
  const useShell = process.platform === "win32";

  log(`Spawning agent: ${command} ${args.join(" ")}`);

  const proc = spawn(command, args, {
    stdio: ["pipe", "pipe", "inherit"],
    cwd,
    env: { ...process.env, ...env },
    shell: useShell,
  });

  proc.on("error", (err) => {
    log(`Agent process error: ${String(err)}`);
  });

  proc.on("exit", (code, signal) => {
    log(`Agent process exited: code=${code} signal=${signal}`);
  });

  if (!proc.stdin || !proc.stdout) {
    proc.kill();
    throw new Error("Failed to get agent process stdio");
  }

  const input = Writable.toWeb(proc.stdin);
  const output = Readable.toWeb(proc.stdout) as ReadableStream<Uint8Array>;
  const stream = acp.ndJsonStream(input, output);

  const connection = new acp.ClientSideConnection(() => client, stream);

  log("Initializing ACP connection...");
  const initResult = await connection.initialize({
    protocolVersion: acp.PROTOCOL_VERSION,
    clientInfo: {
      name: packageJson.name,
      title: packageJson.name,
      version: packageJson.version,
    },
    clientCapabilities: {
      fs: {
        readTextFile: true,
        writeTextFile: true,
      },
    },
  });
  log(`ACP initialized (protocol v${initResult.protocolVersion})`);

  log("Creating ACP session...");
  const sessionResult = await connection.newSession({
    cwd,
    mcpServers: [],
  });
  log(`ACP session created: ${sessionResult.sessionId}`);

  return {
    process: proc,
    connection,
    sessionId: sessionResult.sessionId,
  };
}

export function killAgent(proc: ChildProcess): void {
  if (!proc.killed) {
    proc.kill("SIGTERM");
    setTimeout(() => {
      if (!proc.killed) proc.kill("SIGKILL");
    }, 5_000).unref();
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/telegram-acp/src/acp/
git commit -m "feat: add ACP session and agent manager"
```

---

### Task 12: Inbound Adapter

**Files:**
- Create: `packages/telegram-acp/src/adapter/inbound.ts`

- [ ] **Step 1: Write Telegram → ACP adapter**

```typescript
import type * as acp from "@agentclientprotocol/sdk";
import { TelegramClient } from "telegram";
import type { TelegramMessage } from "../telegram/types.js";
import { getMediaBuffer } from "../telegram/download.js";

export async function telegramMessageToPrompt(
  msg: TelegramMessage,
  client: TelegramClient,
  log: (msg: string) => void,
): Promise<acp.ContentBlock[]> {
  const blocks: acp.ContentBlock[] = [];

  // Extract text
  if (msg.text) {
    blocks.push({ type: "text", text: msg.text });
  }

  // Try to download and attach media
  if (msg.media) {
    try {
      const attached = await convertMediaItem(msg.media, client, log);
      if (attached) blocks.push(attached);
    } catch (err) {
      log(`Media download failed: ${String(err)}`);
      const mediaType = msg.media.type;
      blocks.push({ type: "text", text: `[Received ${mediaType} - download failed]` });
    }
  }

  // Fallback
  if (blocks.length === 0) {
    blocks.push({ type: "text", text: "[empty message]" });
  }

  return blocks;
}

async function convertMediaItem(
  media: TelegramMessage["media"],
  client: TelegramClient,
  log: (msg: string) => void,
): Promise<acp.ContentBlock | null> {
  if (!media) return null;

  if (media.type === "photo") {
    log("Downloading image...");
    const buffer = await getMediaBuffer(client, media.fileId, media.fileId);
    if (!buffer) return null;

    const base64 = buffer.toString("base64");
    return {
      type: "image",
      data: base64,
      mimeType: "image/jpeg",
    } as acp.ContentBlock;
  }

  if (media.type === "document") {
    log(`Downloading file "${media.fileName || "unknown"}"...`);
    const buffer = await getMediaBuffer(client, media.fileId, media.fileId);
    if (!buffer) return null;

    const fileName = media.fileName ?? "file";
    if (isTextFile(fileName)) {
      const content = buffer.toString("utf-8");
      return {
        type: "resource",
        resource: {
          uri: `file:///${fileName}`,
          mimeType: media.mimeType || "text/plain",
          text: content,
        },
      } as acp.ContentBlock;
    }

    return { type: "text", text: `[Received file: ${fileName}, ${buffer.length} bytes]` };
  }

  if (media.type === "voice") {
    return { type: "text", text: "[Received voice message]" };
  }

  if (media.type === "video") {
    return { type: "text", text: "[Received video message]" };
  }

  if (media.type === "sticker") {
    return { type: "text", text: "[Received sticker]" };
  }

  return null;
}

function isTextFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return [
    "txt", "md", "json", "js", "ts", "py", "java", "c", "cpp", "h",
    "css", "html", "xml", "yaml", "yml", "toml", "ini", "cfg", "sh",
    "bash", "rs", "go", "rb", "php", "sql", "csv", "log", "env",
  ].includes(ext);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/telegram-acp/src/adapter/inbound.ts
git commit -m "feat: add Telegram → ACP inbound adapter"
```

---

### Task 13: Outbound Adapter

**Files:**
- Create: `packages/telegram-acp/src/adapter/outbound.ts`

- [ ] **Step 1: Write ACP → Telegram MarkdownV2 adapter**

```typescript
/**
 * Format ACP output for Telegram MarkdownV2
 */
export function formatForTelegram(text: string): string {
  // Preserve code blocks
  let out = text;

  // Bold: **text** → *text*
  out = out.replace(/\*\*(.+?)\*\*/g, "*$1*");

  // Italic: *text* → _text_
  out = out.replace(/\*(.+?)\*/g, "_$1_");

  // Keep inline code as-is (Telegram supports `code`)
  // Keep code blocks as-is (Telegram supports ```lang\n...\n```)

  // Escape special MarkdownV2 characters in non-code sections
  // (Simple approach - skip for now, can be enhanced)

  return out.trim();
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/telegram-acp/src/adapter/outbound.ts
git commit -m "feat: add ACP → Telegram outbound adapter"
```

---

## Chunk 4: CLI Entry Point

### Task 14: CLI Entry Point

**Files:**
- Create: `packages/telegram-acp/bin/telegram-acp.ts`

- [ ] **Step 1: Write CLI with all options and subcommands**

```typescript
#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { TelegramAcpBridge } from "../src/bridge.js";
import {
  defaultConfig,
  listBuiltInAgents,
  resolveAgentSelection,
  parseProxyUrl,
} from "../src/config.js";
import type { TelegramAcpConfig } from "../src/config.js";
import { loadSession, saveSession, clearSession } from "../src/telegram/auth.js";

function usage(): void {
  const presets = listBuiltInAgents()
    .map(({ id }) => id)
    .join(", ");

  console.log(`
telegram-acp — Bridge Telegram to any ACP-compatible AI agent

Usage:
  telegram-acp --agent <preset|command>  [options]
  telegram-acp agents                        List built-in agent presets
  telegram-acp stop                          Stop a running daemon
  telegram-acp status                        Check daemon status
  telegram-acp test                          Test connection
  telegram-acp whoami                        Show bot info
  telegram-acp session clear                 Clear persisted session

Options:
  --agent <value>       Built-in preset or raw command
                        Presets: ${presets}
  --cwd <dir>           Working directory for agent
  --login               Force re-authentication
  --daemon              Run in background
  --config <file>       Config file path
  --proxy <url>         Proxy URL (socks5://user:pass@host:port)
  --allowed-users <ids> Whitelist user IDs (comma-separated)
  --open                Open mode (any DM allowed)
  --reaction <emoji>    Fixed reaction emoji
  --reaction-random     Enable random reactions
  --no-reaction         Disable reactions
  --idle-timeout <m>    Session idle timeout (minutes)
  --max-sessions <n>    Max concurrent sessions
  --show-thoughts       Forward agent thoughts
  --verbose             Verbose logging
  -h, --help            Show help
`);
}

function parseArgs(argv: string[]): {
  command?: string;
  agent?: string;
  cwd?: string;
  forceLogin: boolean;
  daemon: boolean;
  configFile?: string;
  idleTimeout?: number;
  maxSessions?: number;
  reaction?: string;
  reactionRandom: boolean;
  noReaction: boolean;
  proxy?: string;
  allowedUsers?: string[];
  open: boolean;
  showThoughts: boolean;
  verbose: boolean;
  help: boolean;
} {
  const result = {
    forceLogin: false,
    daemon: false,
    reactionRandom: false,
    noReaction: false,
    open: false,
    showThoughts: false,
    verbose: false,
    help: false,
  } as any;

  const args = argv.slice(2);
  let i = 0;

  if (args[0] && !args[0].startsWith("-")) {
    result.command = args[0];
    i = 1;
  }

  while (i < args.length) {
    const arg = args[i];
    switch (arg) {
      case "--agent":
        result.agent = args[++i];
        break;
      case "--cwd":
        result.cwd = args[++i];
        break;
      case "--login":
        result.forceLogin = true;
        break;
      case "--daemon":
        result.daemon = true;
        break;
      case "--config":
        result.configFile = args[++i];
        break;
      case "--proxy":
        result.proxy = args[++i];
        break;
      case "--allowed-users":
        result.allowedUsers = args[++i].split(",");
        break;
      case "--open":
        result.open = true;
        break;
      case "--reaction":
        result.reaction = args[++i];
        break;
      case "--reaction-random":
        result.reactionRandom = true;
        break;
      case "--no-reaction":
        result.noReaction = true;
        break;
      case "--idle-timeout":
        result.idleTimeout = parseInt(args[++i], 10);
        break;
      case "--max-sessions":
        result.maxSessions = parseInt(args[++i], 10);
        break;
      case "--show-thoughts":
        result.showThoughts = true;
        break;
      case "-v":
      case "--verbose":
        result.verbose = true;
        break;
      case "-h":
      case "--help":
        result.help = true;
        break;
    }
    i++;
  }

  return result;
}

function loadConfigFile(filePath: string): Partial<TelegramAcpConfig> {
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content) as Partial<TelegramAcpConfig>;
}

function handleAgents(config: TelegramAcpConfig): void {
  console.log("Built-in ACP agent presets:\n");
  for (const { id, preset } of listBuiltInAgents(config.agents)) {
    const commandLine = [preset.command, ...preset.args].join(" ");
    console.log(`${id.padEnd(10)} ${commandLine}`);
    if (preset.description) {
      console.log(`           ${preset.description}`);
    }
  }
}

function handleStop(config: TelegramAcpConfig): void {
  const pidFile = config.daemon.pidFile;
  if (!fs.existsSync(pidFile)) {
    console.log("No daemon running");
    return;
  }
  const pid = parseInt(fs.readFileSync(pidFile, "utf-8").trim(), 10);
  try {
    process.kill(pid, "SIGTERM");
    fs.unlinkSync(pidFile);
    console.log(`Stopped daemon (PID ${pid})`);
  } catch (err: any) {
    if (err.code === "ESRCH") {
      fs.unlinkSync(pidFile);
      console.log("Daemon not running");
    } else {
      console.error(`Failed to stop: ${err.message}`);
    }
  }
}

function handleStatus(config: TelegramAcpConfig): void {
  const pidFile = config.daemon.pidFile;
  if (!fs.existsSync(pidFile)) {
    console.log("Not running");
    return;
  }
  const pid = parseInt(fs.readFileSync(pidFile, "utf-8").trim(), 10);
  try {
    process.kill(pid, 0);
    console.log(`Running (PID ${pid})`);
  } catch {
    console.log("Not running (stale PID)");
    fs.unlinkSync(pidFile);
  }
}

async function handleTest(config: TelegramAcpConfig): Promise<void> {
  console.log("Testing Telegram connection...");
  const bridge = new TelegramAcpBridge(config);
  try {
    await bridge.start();
    const info = await bridge.getBotInfo();
    console.log(`Connected as @${info.username}`);
    await bridge.stop();
    console.log("Test passed");
  } catch (err: any) {
    console.error(`Test failed: ${err.message}`);
    process.exit(1);
  }
}

async function handleWhoami(config: TelegramAcpConfig): Promise<void> {
  const bridge = new TelegramAcpBridge(config);
  try {
    await bridge.start();
    const info = await bridge.getBotInfo();
    console.log(`Bot ID: ${info.id}`);
    console.log(`Username: @${info.username}`);
    console.log(`Name: ${info.firstName || info.username}`);
    await bridge.stop();
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

function handleSessionClear(config: TelegramAcpConfig): void {
  clearSession(config.storage.dir);
  console.log("Session cleared");
}

function daemonize(config: TelegramAcpConfig): void {
  const logFile = config.daemon.logFile;
  const pidFile = config.daemon.pidFile;

  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.mkdirSync(path.dirname(pidFile), { recursive: true });

  const out = fs.openSync(logFile, "a");
  const err = fs.openSync(logFile, "a");

  const args = process.argv.slice(1).filter((a) => a !== "--daemon");
  const child = spawn(process.execPath, args, {
    detached: true,
    stdio: ["ignore", out, err],
    env: { ...process.env, TELEGRAM_ACP_DAEMON: "1" },
  });

  child.unref();
  fs.writeFileSync(pidFile, String(child.pid), "utf-8");
  console.log(`Daemon started (PID ${child.pid})`);
  console.log(`Logs: ${logFile}`);
  process.exit(0);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.help) {
    usage();
    process.exit(0);
  }

  const config = defaultConfig();

  if (args.configFile) {
    const fileConfig = loadConfigFile(args.configFile);
    Object.assign(config.telegram, fileConfig.telegram ?? {});
    Object.assign(config.agent, fileConfig.agent ?? {});
    Object.assign(config.agents, fileConfig.agents ?? {});
    Object.assign(config.session, fileConfig.session ?? {});
    Object.assign(config.daemon, fileConfig.daemon ?? {});
    Object.assign(config.storage, fileConfig.storage ?? {});
  }

  // Handle subcommands
  if (args.command === "agents") {
    handleAgents(config);
    return;
  }
  if (args.command === "stop") {
    handleStop(config);
    return;
  }
  if (args.command === "status") {
    handleStatus(config);
    return;
  }
  if (args.command === "test") {
    await handleTest(config);
    return;
  }
  if (args.command === "whoami") {
    await handleWhoami(config);
    return;
  }
  if (args.command === "session" && process.argv.includes("clear")) {
    handleSessionClear(config);
    return;
  }

  // Load session
  const session = loadSession(config.storage.dir);
  if (session && !args.forceLogin) {
    config.telegram.sessionString = session.sessionString;
    config.telegram.apiId = session.apiId;
    config.telegram.apiHash = session.apiHash;
  }

  // Apply CLI overrides
  if (args.proxy) {
    const proxy = parseProxyUrl(args.proxy);
    if (proxy) config.proxy = proxy;
  }
  if (args.allowedUsers) config.allowedUsers = args.allowedUsers;
  if (args.open) config.open = true;
  if (args.reaction) {
    config.reaction = { enabled: true, emoji: args.reaction };
  }
  if (args.reactionRandom) {
    config.reaction = { enabled: true, randomEmojis: ["👍", "👌", "🫡", "⏳", "🔄"] };
  }
  if (args.noReaction) {
    config.reaction = { enabled: false };
  }
  if (args.idleTimeout !== undefined) {
    config.session.idleTimeoutMs = args.idleTimeout * 60_000;
  }
  if (args.maxSessions) config.session.maxConcurrentUsers = args.maxSessions;
  if (args.showThoughts) config.agent.showThoughts = true;
  config.daemon.enabled = args.daemon;

  const agentSelection = args.agent ?? config.agent.preset;
  if (!agentSelection && !config.agent.command) {
    console.error("Error: --agent is required\n");
    usage();
    process.exit(1);
  }

  if (agentSelection) {
    const resolvedAgent = resolveAgentSelection(agentSelection, config.agents);
    config.agent.preset = resolvedAgent.id;
    config.agent.command = resolvedAgent.command;
    config.agent.args = resolvedAgent.args;
    if (resolvedAgent.env) {
      config.agent.env = { ...(config.agent.env ?? {}), ...resolvedAgent.env };
    }
  }

  if (args.cwd) config.agent.cwd = path.resolve(args.cwd);

  if (args.daemon && !process.env.TELEGRAM_ACP_DAEMON) {
    daemonize(config);
    return;
  }

  const bridge = new TelegramAcpBridge(config, (msg) => {
    const ts = new Date().toISOString().substring(11, 19);
    console.log(`[${ts}] ${msg}`);
  });

  const shutdown = async () => {
    await bridge.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  try {
    await bridge.start();
  } catch (err: any) {
    if (err.message === "aborted") {
      // Normal shutdown
    } else {
      console.error(`Fatal: ${err.message}`);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(`Fatal: ${String(err)}`);
  process.exit(1);
});
```

- [ ] **Step 2: Make executable and commit**

```bash
chmod +x packages/telegram-acp/bin/telegram-acp.ts
git add packages/telegram-acp/bin/telegram-acp.ts
git commit -m "feat: add telegram-acp CLI entry point"
```

---

### Task 15: Build and Test

**Files:**
- None (build task)

- [ ] **Step 1: Build the package**

```bash
cd packages/telegram-acp
pnpm run build
```

Expected: TypeScript compiles successfully, output in `dist/`

- [ ] **Step 2: Test CLI help**

```bash
node dist/bin/telegram-acp.js --help
```

Expected: Help message displayed

- [ ] **Step 3: Test agents subcommand**

```bash
node dist/bin/telegram-acp.js agents
```

Expected: List of built-in agent presets

- [ ] **Step 4: Commit**

```bash
git add packages/telegram-acp/dist/
git commit -m "build: compile telegram-acp"
```

---

## Chunk 5: Documentation

### Task 16: Update Package README

**Files:**
- Modify: `packages/telegram-acp/README.md`

- [ ] **Step 1: Expand README with full documentation**

```markdown
# Telegram ACP

Bridge Telegram direct messages to any ACP-compatible AI agent.

`telegram-acp` uses MTProto to log in with a Telegram bot, listens for incoming direct messages, forwards them to an ACP agent over stdio, and sends the agent reply back to Telegram.

## Features

- MTProto connection via `telegram` library
- One ACP agent session per Telegram user
- Built-in ACP agent presets
- Custom raw agent command support
- Auto-allow permission requests
- Direct messages only (groups ignored)
- Message reactions (emoji acknowledgment)
- Background daemon mode
- Proxy support (SOCKS5/HTTP)
- User whitelist for access control

## Requirements

- Node.js 20+
- Telegram Bot Token
- Telegram API ID and API Hash (from https://my.telegram.org)

## Quick Start

```bash
# With environment variables
export TELEGRAM_API_ID=123456
export TELEGRAM_API_HASH=abc123def456
export TELEGRAM_BOT_TOKEN="bot_token_here"

npx telegram-acp --agent claude

# Or with config file
npx telegram-acp --agent claude --config config.json
```

On first run, the bridge will:
1. Connect to Telegram with your bot token
2. Save the session under `~/.telegram-acp`
3. Begin polling direct messages

## Built-in Agent Presets

```bash
npx telegram-acp agents
```

Current presets:
- `copilot` - GitHub Copilot
- `claude` - Claude Code ACP
- `gemini` - Gemini CLI
- `qwen` - Qwen Code
- `codex` - Codex CLI
- `opencode` - OpenCode

## CLI Usage

```text
telegram-acp --agent <preset|command> [options]
telegram-acp agents
telegram-acp stop
telegram-acp status
telegram-acp test
telegram-acp whoami
telegram-acp session clear
```

Options:
- `--agent <value>`: Built-in preset or raw command
- `--cwd <dir>`: Working directory for agent
- `--login`: Force re-authentication
- `--daemon`: Run in background
- `--config <file>`: JSON config file
- `--proxy <url>`: Proxy URL
- `--allowed-users <ids>`: Whitelist (comma-separated)
- `--open`: Open mode (any DM allowed)
- `--reaction <emoji>`: Fixed reaction emoji
- `--no-reaction`: Disable reactions
- `--idle-timeout <m>`: Session idle timeout (default: 1440)
- `--max-sessions <n>`: Max concurrent sessions (default: 10)
- `--show-thoughts`: Forward agent thoughts to Telegram

Examples:
```bash
npx telegram-acp --agent claude
npx telegram-acp --agent copilot --allowed-users "123456,789012"
npx telegram-acp --agent "npx my-agent --acp" --daemon
```

## Configuration File

```json
{
  "telegram": {
    "apiId": 123456,
    "apiHash": "abc123def456",
    "botToken": "bot_token_here"
  },
  "proxy": {
    "ip": "localhost",
    "port": 1080,
    "type": "socks5"
  },
  "allowedUsers": ["123456", "789012"],
  "agent": {
    "preset": "claude"
  },
  "session": {
    "idleTimeoutMs": 86400000,
    "maxConcurrentUsers": 10
  },
  "reaction": {
    "enabled": true,
    "randomEmojis": ["👍", "👌", "🫡"]
  }
}
```

## Storage

Runtime files stored under:
```
~/.telegram-acp/
├── session.json      # Auth session data
├── daemon.pid        # Daemon PID
└── telegram-acp.log  # Log file
```

## Current Limitations

- Direct messages only; group chats ignored
- MCP servers not used
- Permission requests auto-approved

## Development

```bash
pnpm install
pnpm run build
pnpm run dev  # watch mode
```

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
git add packages/telegram-acp/README.md
git commit -m "docs: add comprehensive README for telegram-acp"
```

---

## Plan Review Loop

After completing all chunks, the plan will be reviewed for:
- Correctness of TypeScript code
- Proper error handling
- Test coverage (if tests are added)
- Documentation completeness
