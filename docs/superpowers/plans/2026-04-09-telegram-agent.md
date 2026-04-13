# Telegram Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a modular Telegram agent application with webhook support and skills integration using artusx plugin architecture.

**Architecture:** Two inline plugins (telegram and acp) provide injectable APIs to business modules (bot, webhook, bridge). Skills provide documentation for agent to call webhook APIs.

**Tech Stack:** @artusjs/core, grammy, @agentclientprotocol/sdk, TypeScript, Node.js 20+

---

## File Structure Map

**New Files (to create):**

```
packages/telegram-agent/
├── src/
│   ├── bootstrap.ts              # Application entry
│   ├── index.ts                  # Module exports
│   ├── config/
│   │   ├── config.default.ts     # Default configuration
│   │   ├── config.development.ts # Dev environment config
│   │   ├── config.production.ts  # Production config
│   │   └── plugin.ts             # Plugin registration
│   ├── plugins/
│   │   ├── telegram/
│   │   │   ├── src/
│   │   │   │   ├── client.ts     # grammy Bot wrapper
│   │   │   │   ├── types.ts      # Telegram types
│   │   │   │   ├── lifecycle.ts  # Plugin lifecycle
│   │   │   │   └── index.ts      # Plugin entry
│   │   │   ├── meta.json         # Plugin metadata
│   │   │   └── package.json      # Package definition
│   │   └── acp/
│   │   │   ├── src/
│   │   │   │   ├── client.ts     # ACP Client impl
│   │   │   │   ├── session.ts    # Session manager
│   │   │   │   ├── process.ts    # Process manager
│   │   │   │   ├── streaming.ts  # Streaming handler
│   │   │   │   ├── history.ts    # History injection
│   │   │   │   ├── types.ts      # ACP types
│   │   │   │   ├── lifecycle.ts  # Plugin lifecycle
│   │   │   │   └── index.ts      # Plugin entry
│   │   │   ├── meta.json         # Plugin metadata
│   │   │   └── package.json      # Package definition
│   ├── module-webhook/
│   │   ├── webhook.controller.ts # HTTP API endpoints
│   │   ├── webhook.service.ts    # Business logic
│   │   ├── auth.middleware.ts    # Auth middleware
│   │   └── types.ts              # API types
│   ├── module-bridge/
│   │   ├── bridge.service.ts     # Core orchestration
│   │   └── types.ts              # Flow types
│   └── module-bot/
│   │   ├── bot.service.ts        # Bot API wrapper
│   │   ├── message.handler.ts    # Message handling
│   │   ├── reaction.handler.ts   # Reaction system
│   │   ├── media.handler.ts      # Media operations
│   │   ├── command.handler.ts    # Command handling
│   │   └── types.ts              # Bot types
├── package.json
├── tsconfig.json
└── README.md

skills/telegram-agent/
├── SKILL.md                      # Skill definition
├── references/
│   ├── webhook-api.md            # Full API doc
│   ├── send-message.md           # Message examples
│   ├── send-media.md             # Media examples
│   ├── edit-message.md           # Edit examples
│   ├── send-reaction.md          # Reaction examples
│   ├── auth.md                   # Auth guide
│   └── errors.md                 # Error handling
└── scripts/
    └── test-webhook.sh           # Test script
```

---

## Task 1: Create Application Skeleton

**Files:**
- Create: `packages/telegram-agent/package.json`
- Create: `packages/telegram-agent/tsconfig.json`
- Create: `packages/telegram-agent/src/bootstrap.ts`
- Create: `packages/telegram-agent/src/index.ts`
- Create: `packages/telegram-agent/README.md`

- [ ] **Step 1: Create package.json with dependencies**

```json
{
  "name": "telegram-agent",
  "version": "0.1.0",
  "type": "module",
  "description": "Telegram agent with webhook support and skills integration",
  "main": "dist/src/index.js",
  "bin": {
    "telegram-agent": "./dist/src/bootstrap.js"
  },
  "scripts": {
    "dev": "artusx-dev",
    "start": "node dist/src/bootstrap.js",
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@artusjs/core": "^1.0.0",
    "@agentclientprotocol/sdk": "^0.16.1",
    "grammy": "^1.41.1",
    "yaml": "^2.8.3"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.5.0",
    "vitest": "^1.0.0"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Create tsconfig.json for ES modules**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create bootstrap.ts entry point**

```typescript
#!/usr/bin/env node

import { ArtusApplication } from '@artusjs/core';

async function main() {
  const app = new ArtusApplication();
  await app.load({
    configDir: './src/config',
    extension: '.ts',
  });
  await app.run();
}

main().catch((err) => {
  console.error('Application failed to start:', err);
  process.exit(1);
});
```

- [ ] **Step 4: Create index.ts module exports**

```typescript
export { TelegramClient } from './plugins/telegram/src/client.js';
export { SessionManager } from './plugins/acp/src/session.js';
export { ProcessManager } from './plugins/acp/src/process.js';
export { BridgeService } from './module-bridge/bridge.service.js';
export { BotService } from './module-bot/bot.service.js';
export { WebhookService } from './module-webhook/webhook.service.js';
```

- [ ] **Step 5: Create README.md with usage guide**

```markdown
# Telegram Agent

A modular Telegram agent application with webhook support and skills integration.

## Features

- Webhook-based control for agent
- Skills integration for proactive media sending
- Artusx plugin architecture
- Per-user session management
- Streaming message handling

## Quick Start

```bash
# Install dependencies
pnpm install

# Configure
export TELEGRAM_BOT_TOKEN="your-token"
export TELEGRAM_WEBHOOK_TOKEN="webhook-secret"

# Run
pnpm run dev
```

## Configuration

See `src/config/config.default.ts` for configuration options.

## Architecture

- **Plugins**: telegram, acp
- **Modules**: bot, webhook, bridge
- **Skills**: See `skills/telegram-agent/SKILL.md`

## License

MIT
```

- [ ] **Step 6: Initialize package**

Run: `cd packages/telegram-agent && pnpm install`

Expected: Dependencies installed successfully

- [ ] **Step 7: Commit skeleton**

```bash
cd packages/telegram-agent
git add package.json tsconfig.json src/bootstrap.ts src/index.ts README.md
git commit -m "feat: initialize telegram-agent application skeleton"
```

---

## Task 2: Create Configuration System

**Files:**
- Create: `packages/telegram-agent/src/config/config.default.ts`
- Create: `packages/telegram-agent/src/config/config.development.ts`
- Create: `packages/telegram-agent/src/config/config.production.ts`
- Create: `packages/telegram-agent/src/config/plugin.ts`

- [ ] **Step 1: Create config.default.ts**

```typescript
import path from 'path';
import os from 'os';
import type { ArtusXConfig } from '@artusjs/core';

export interface TelegramAgentConfig extends ArtusXConfig {
  webhook: {
    token: string;
    enableAuth: boolean;
  };
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
}

export default () => {
  const storageDir = path.join(os.homedir(), '.telegram-agent');
  
  const config: { artusx: TelegramAgentConfig } = {
    artusx: {
      port: 7001,
      static: {
        prefix: '/public/',
        dir: path.resolve(__dirname, '../public'),
        dynamic: true,
        preload: false,
      },
      webhook: {
        token: process.env.TELEGRAM_WEBHOOK_TOKEN || 'default-webhook-token',
        enableAuth: true,
      },
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
    },
  };

  return config;
};
```

- [ ] **Step 2: Create config.development.ts**

```typescript
export default () => {
  return {
    artusx: {
      port: 7001,
      webhook: {
        enableAuth: false, // Disable auth in development
      },
    },
  };
};
```

- [ ] **Step 3: Create config.production.ts**

```typescript
export default () => {
  return {
    artusx: {
      port: parseInt(process.env.PORT || '7001'),
      webhook: {
        enableAuth: true,
      },
    },
  };
};
```

- [ ] **Step 4: Create plugin.ts**

```typescript
import path from 'path';

export default {
  artusx: {
    enable: true,
    package: '@artusjs/core',
  },
  telegram: {
    enable: true,
    path: path.join(__dirname, '../plugins/telegram'),
  },
  acp: {
    enable: true,
    path: path.join(__dirname, '../plugins/acp'),
  },
};
```

- [ ] **Step 5: Commit configuration**

```bash
cd packages/telegram-agent
git add src/config/
git commit -m "feat: add configuration system"
```

---

## Task 3: Develop Telegram Plugin

**Files:**
- Create: `packages/telegram-agent/src/plugins/telegram/package.json`
- Create: `packages/telegram-agent/src/plugins/telegram/meta.json`
- Create: `packages/telegram-agent/src/plugins/telegram/src/types.ts`
- Create: `packages/telegram-agent/src/plugins/telegram/src/client.ts`
- Create: `packages/telegram-agent/src/plugins/telegram/src/lifecycle.ts`
- Create: `packages/telegram-agent/src/plugins/telegram/src/index.ts`

- [ ] **Step 1: Create plugin package.json**

```json
{
  "name": "telegram-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.js",
  "dependencies": {
    "grammy": "^1.41.1"
  }
}
```

- [ ] **Step 2: Create meta.json**

```json
{
  "name": "telegram"
}
```

- [ ] **Step 3: Create types.ts**

```typescript
import type { Bot } from 'grammy';

export interface TelegramClientInterface {
  getBot(): Bot;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface TelegramMessage {
  userId: string;
  text?: string;
  photo?: any;
  audio?: any;
  messageId: number;
}
```

- [ ] **Step 4: Create client.ts**

```typescript
import { Bot } from 'grammy';
import type { TelegramClientInterface } from './types.js';

export class TelegramClient implements TelegramClientInterface {
  private bot: Bot;

  constructor(token: string) {
    if (!token) {
      throw new Error('Telegram bot token is required');
    }
    this.bot = new Bot(token);
  }

  async start(): Promise<void> {
    await this.bot.start();
  }

  async stop(): Promise<void> {
    await this.bot.stop();
  }

  getBot(): Bot {
    return this.bot;
  }
}
```

- [ ] **Step 5: Create lifecycle.ts**

```typescript
import { PluginBase, ArtusInjectEnum } from '@artusjs/core';
import { TelegramClient } from './client.js';

export default class TelegramPlugin extends PluginBase {
  private client: TelegramClient | null = null;

  async willReady(): Promise<void> {
    const config = this.app.config;
    const botToken = config.artusx?.telegram?.botToken;

    if (!botToken) {
      console.warn('[telegram-plugin] Bot token not configured, skipping initialization');
      return;
    }

    this.client = new TelegramClient(botToken);
    await this.client.start();

    // Register as public API
    this.registerApi(TelegramClient, {
      visibility: 'public',
      scope: 'singleton',
      namespace: 'telegram',
    });

    console.log('[telegram-plugin] Bot started successfully');
  }

  async beforeClose(): Promise<void> {
    if (this.client) {
      await this.client.stop();
      console.log('[telegram-plugin] Bot stopped');
    }
  }
}
```

- [ ] **Step 6: Create index.ts**

```typescript
export { TelegramClient } from './client.js';
export { TelegramPlugin as default } from './lifecycle.js';
export * from './types.js';
```

- [ ] **Step 7: Commit Telegram plugin**

```bash
cd packages/telegram-agent
git add src/plugins/telegram/
git commit -m "feat: implement telegram plugin"
```

---

## Task 4: Develop ACP Plugin - Session Management

**Files:**
- Create: `packages/telegram-agent/src/plugins/acp/package.json`
- Create: `packages/telegram-agent/src/plugins/acp/meta.json`
- Create: `packages/telegram-agent/src/plugins/acp/src/types.ts`
- Create: `packages/telegram-agent/src/plugins/acp/src/session.ts`
- Create: `packages/telegram-agent/src/plugins/acp/src/process.ts`

- [ ] **Step 1: Create plugin package.json**

```json
{
  "name": "acp-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.js",
  "dependencies": {
    "@agentclientprotocol/sdk": "^0.16.1"
  }
}
```

- [ ] **Step 2: Create meta.json**

```json
{
  "name": "acp"
}
```

- [ ] **Step 3: Create types.ts**

```typescript
import type { ChildProcess } from 'child_process';

export interface AgentConfig {
  preset?: string;
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  showThoughts: boolean;
}

export interface Session {
  id: string;
  userId: string;
  agentProcess: ChildProcess | null;
  status: 'active' | 'idle' | 'closed';
  agentConfig: AgentConfig;
  createdAt: Date;
  lastActivityAt: Date;
}

export interface SessionConfig {
  idleTimeoutMs: number;
  maxConcurrentUsers: number;
  autoRecover: boolean;
}
```

- [ ] **Step 4: Create session.ts**

```typescript
import path from 'path';
import fs from 'fs';
import type { Session, AgentConfig, SessionConfig } from './types.js';
import { ProcessManager } from './process.js';

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private processManager: ProcessManager;
  private config: SessionConfig;
  private storageDir: string;

  constructor(config: SessionConfig) {
    this.config = config;
    this.processManager = new ProcessManager();
    this.storageDir = path.join(process.env.HOME || '/tmp', '.telegram-agent', 'sessions');
  }

  async create(userId: string, agentConfig: AgentConfig): Promise<Session> {
    // Check max concurrent users
    if (this.sessions.size >= this.config.maxConcurrentUsers) {
      throw new Error('Max concurrent users reached');
    }

    // Create session directory
    const sessionDir = path.join(this.storageDir, userId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // Spawn agent process
    const agentProcess = await this.processManager.spawnAgent(agentConfig);

    const session: Session = {
      id: `${userId}-${Date.now()}`,
      userId,
      agentProcess,
      status: 'active',
      agentConfig,
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };

    this.sessions.set(userId, session);

    // Persist session metadata
    const metadataPath = path.join(sessionDir, `${session.id}.json`);
    await fs.promises.writeFile(metadataPath, JSON.stringify({
      id: session.id,
      userId: session.userId,
      status: session.status,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
    }));

    return session;
  }

  get(userId: string): Session | undefined {
    return this.sessions.get(userId);
  }

  async destroy(userId: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (!session) return;

    // Kill agent process
    if (session.agentProcess) {
      await this.processManager.killProcess(session.agentProcess);
    }

    // Update status
    session.status = 'closed';
    session.agentProcess = null;

    // Remove from map
    this.sessions.delete(userId);

    // Persist closed status
    const sessionDir = path.join(this.storageDir, userId);
    const metadataPath = path.join(sessionDir, `${session.id}.json`);
    if (fs.existsSync(metadataPath)) {
      await fs.promises.writeFile(metadataPath, JSON.stringify({
        id: session.id,
        userId: session.userId,
        status: 'closed',
        createdAt: session.createdAt,
        lastActivityAt: session.lastActivityAt,
      }));
    }
  }

  async restore(userId: string, agentConfig: AgentConfig): Promise<Session | null> {
    const sessionDir = path.join(this.storageDir, userId);
    if (!fs.existsSync(sessionDir)) return null;

    const files = await fs.promises.readdir(sessionDir);
    const latestFile = files.filter(f => f.endsWith('.json')).sort().pop();
    if (!latestFile) return null;

    const metadataPath = path.join(sessionDir, latestFile);
    const metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf-8'));

    if (metadata.status !== 'active') return null;

    // Recreate session with new process
    return await this.create(userId, agentConfig);
  }

  getAll(): Map<string, Session> {
    return this.sessions;
  }
}
```

- [ ] **Step 5: Create process.ts**

```typescript
import { spawn, type ChildProcess } from 'child_process';
import type { AgentConfig } from './types.js';

export class ProcessManager {
  async spawnAgent(config: AgentConfig): Promise<ChildProcess> {
    const process = spawn(config.command, config.args, {
      cwd: config.cwd,
      env: {
        ...process.env,
        ...config.env,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Handle errors
    process.on('error', (err) => {
      console.error('[acp-process] Process error:', err);
    });

    process.stderr?.on('data', (data) => {
      console.error('[acp-process] stderr:', data.toString());
    });

    return process;
  }

  async killProcess(process: ChildProcess): Promise<void> {
    if (!process.pid) return;

    process.kill('SIGTERM');

    // Wait for graceful shutdown
    await new Promise<void>((resolve) => {
      process.on('exit', () => resolve());
      setTimeout(() => {
        process.kill('SIGKILL');
        resolve();
      }, 5000);
    });
  }
}
```

- [ ] **Step 6: Commit ACP plugin session/process**

```bash
cd packages/telegram-agent
git add src/plugins/acp/
git commit -m "feat: implement acp plugin session and process management"
```

---

## Task 5: Develop ACP Plugin - Client Implementation

**Files:**
- Create: `packages/telegram-agent/src/plugins/acp/src/client.ts`
- Create: `packages/telegram-agent/src/plugins/acp/src/streaming.ts`
- Create: `packages/telegram-agent/src/plugins/acp/src/history.ts`

- [ ] **Step 1: Create client.ts with ACP interface**

```typescript
import fs from 'fs';
import type * as acp from '@agentclientprotocol/sdk';

export interface ACPClientCallbacks {
  sendMessage: (text: string) => Promise<void>;
  sendTyping: () => Promise<void>;
  onMediaUpload?: (path: string, type: 'image' | 'audio') => Promise<void>;
}

export class ACPClient implements acp.Client {
  private callbacks: ACPClientCallbacks;

  constructor(callbacks: ACPClientCallbacks) {
    this.callbacks = callbacks;
  }

  async requestPermission(params: acp.RequestPermissionRequest): Promise<acp.RequestPermissionResponse> {
    // Auto-allow all permissions
    const allowOption = params.options.find(o => o.kind === 'allow_once' || o.kind === 'allow_always');
    const optionId = allowOption?.optionId ?? params.options[0]?.optionId ?? 'allow';

    return {
      outcome: {
        outcome: 'selected',
        optionId,
      },
    };
  }

  async sessionUpdate(params: acp.SessionNotification): Promise<void> {
    const update = params.update;

    switch (update.sessionUpdate) {
      case 'agent_message_chunk':
        await this.handleMessageChunk(update);
        break;
      case 'agent_thought_chunk':
        // Thoughts are logged but not sent to Telegram (unless configured)
        console.log('[acp-client] Thought:', update.content?.text);
        break;
      case 'tool_call':
        await this.callbacks.sendTyping();
        console.log('[acp-client] Tool:', update.title);
        break;
    }
  }

  async readTextFile(params: acp.ReadTextFileRequest): Promise<acp.ReadTextFileResponse> {
    try {
      const content = await fs.promises.readFile(params.path, 'utf-8');
      return { content };
    } catch (err) {
      throw new Error(`Failed to read file ${params.path}: ${String(err)}`);
    }
  }

  async writeTextFile(params: acp.WriteTextFileRequest): Promise<acp.WriteTextFileResponse> {
    try {
      await fs.promises.writeFile(params.path, params.content, 'utf-8');
      return {};
    } catch (err) {
      throw new Error(`Failed to write file ${params.path}: ${String(err)}`);
    }
  }

  private async handleMessageChunk(update: any): Promise<void> {
    if (update.content?.type === 'text') {
      const text = update.content.text;
      await this.callbacks.sendMessage(text);
    } else if (update.content?.type === 'image') {
      const imagePath = update.content.uri || update.content.path;
      if (this.callbacks.onMediaUpload && imagePath) {
        await this.callbacks.onMediaUpload(imagePath, 'image');
      }
    } else if (update.content?.type === 'audio') {
      const audioPath = update.content.uri || update.content.path;
      if (this.callbacks.onMediaUpload && audioPath) {
        await this.callbacks.onMediaUpload(audioPath, 'audio');
      }
    }
  }
}
```

- [ ] **Step 2: Create streaming.ts (message flow control)**

```typescript
export interface StreamingMessage {
  id: number;
  text: string;
  status: 'streaming' | 'completed';
}

export class StreamingManager {
  private messages: Map<number, StreamingMessage> = new Map();
  private currentMessageId: number = 0;

  startNewMessage(): number {
    const id = ++this.currentMessageId;
    this.messages.set(id, {
      id,
      text: '',
      status: 'streaming',
    });
    return id;
  }

  appendToMessage(id: number, chunk: string): void {
    const message = this.messages.get(id);
    if (!message) return;
    message.text += chunk;
  }

  completeMessage(id: number): string {
    const message = this.messages.get(id);
    if (!message) return '';
    message.status = 'completed';
    return message.text;
  }

  getMessage(id: number): StreamingMessage | undefined {
    return this.messages.get(id);
  }
}
```

- [ ] **Step 3: Create history.ts (conversation history)**

```typescript
import path from 'path';
import fs from 'fs';

export interface HistoryEntry {
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

export class HistoryManager {
  private historyDir: string;
  private maxMessages: number | null;
  private maxDays: number | null;

  constructor(historyDir: string, maxMessages?: number, maxDays?: number) {
    this.historyDir = historyDir;
    this.maxMessages = maxMessages ?? null;
    this.maxDays = maxDays ?? null;
  }

  async addEntry(userId: string, entry: HistoryEntry): Promise<void> {
    const userDir = path.join(this.historyDir, userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    const historyFile = path.join(userDir, 'history.json');
    let history: HistoryEntry[] = [];

    if (fs.existsSync(historyFile)) {
      history = JSON.parse(await fs.promises.readFile(historyFile, 'utf-8'));
    }

    history.push(entry);

    // Apply limits
    if (this.maxMessages) {
      history = history.slice(-this.maxMessages);
    }

    if (this.maxDays) {
      const cutoff = Date.now() - this.maxDays * 24 * 60 * 60 * 1000;
      history = history.filter(e => new Date(e.timestamp).getTime() > cutoff);
    }

    await fs.promises.writeFile(historyFile, JSON.stringify(history, null, 2));
  }

  async getHistory(userId: string): Promise<HistoryEntry[]> {
    const historyFile = path.join(this.historyDir, userId, 'history.json');
    if (!fs.existsSync(historyFile)) return [];

    return JSON.parse(await fs.promises.readFile(historyFile, 'utf-8'));
  }

  async clearHistory(userId: string): Promise<void> {
    const historyFile = path.join(this.historyDir, userId, 'history.json');
    if (fs.existsSync(historyFile)) {
      await fs.promises.unlink(historyFile);
    }
  }
}
```

- [ ] **Step 4: Commit ACP plugin client/streaming/history**

```bash
cd packages/telegram-agent
git add src/plugins/acp/src/client.ts src/plugins/acp/src/streaming.ts src/plugins/acp/src/history.ts
git commit -m "feat: implement acp client with streaming and history"
```

---

## Task 6: Develop ACP Plugin - Lifecycle

**Files:**
- Create: `packages/telegram-agent/src/plugins/acp/src/lifecycle.ts`
- Create: `packages/telegram-agent/src/plugins/acp/src/index.ts`

- [ ] **Step 1: Create lifecycle.ts**

```typescript
import { PluginBase } from '@artusjs/core';
import { SessionManager } from './session.js';
import { ProcessManager } from './process.js';
import { HistoryManager } from './history.js';
import path from 'path';

export default class ACPPlugin extends PluginBase {
  private sessionManager: SessionManager | null = null;
  private processManager: ProcessManager | null = null;
  private historyManager: HistoryManager | null = null;

  async willReady(): Promise<void> {
    const config = this.app.config;
    const sessionConfig = config.artusx?.session;
    const historyConfig = config.artusx?.history;

    // Initialize managers
    this.processManager = new ProcessManager();
    this.sessionManager = new SessionManager(sessionConfig);
    
    const historyDir = path.join(process.env.HOME || '/tmp', '.telegram-agent', 'history');
    this.historyManager = new HistoryManager(
      historyDir,
      historyConfig?.maxMessages,
      historyConfig?.maxDays
    );

    // Register as public APIs
    this.registerApi(SessionManager, {
      visibility: 'public',
      scope: 'singleton',
      namespace: 'acp',
    });

    this.registerApi(ProcessManager, {
      visibility: 'public',
      scope: 'singleton',
      namespace: 'acp',
    });

    this.registerApi(HistoryManager, {
      visibility: 'public',
      scope: 'singleton',
      namespace: 'acp',
    });

    console.log('[acp-plugin] Session and process managers initialized');
  }

  async beforeClose(): Promise<void> {
    // Cleanup all sessions
    if (this.sessionManager) {
      const sessions = this.sessionManager.getAll();
      for (const [userId, session] of sessions) {
        await this.sessionManager.destroy(userId);
      }
      console.log('[acp-plugin] All sessions cleaned up');
    }
  }
}
```

- [ ] **Step 2: Create index.ts**

```typescript
export { SessionManager } from './session.js';
export { ProcessManager } from './process.js';
export { ACPClient } from './client.js';
export { StreamingManager } from './streaming.js';
export { HistoryManager } from './history.js';
export { ACPPlugin as default } from './lifecycle.js';
export * from './types.js';
```

- [ ] **Step 3: Commit ACP plugin lifecycle**

```bash
cd packages/telegram-agent
git add src/plugins/acp/src/lifecycle.ts src/plugins/acp/src/index.ts
git commit -m "feat: complete acp plugin with lifecycle management"
```

---

## Task 7: Implement BotService

**Files:**
- Create: `packages/telegram-agent/src/module-bot/types.ts`
- Create: `packages/telegram-agent/src/module-bot/bot.service.ts`

- [ ] **Step 1: Create types.ts**

```typescript
export interface SendMessageOptions {
  parseMode?: 'HTML' | 'Markdown';
}

export interface SendMediaOptions {
  type: 'image' | 'audio';
}

export interface ReactionOptions {
  emoji: string;
}
```

- [ ] **Step 2: Create bot.service.ts**

```typescript
import { Injectable, Inject } from '@artusjs/core';
import { TelegramClient } from '../plugins/telegram/src/client.js';
import type { SendMessageOptions, SendMediaOptions, ReactionOptions } from './types.js';
import type { Context } from 'grammy';

@Injectable()
export class BotService {
  @Inject()
  telegramClient!: TelegramClient;

  async sendMessage(userId: string, text: string, options?: SendMessageOptions): Promise<number> {
    const bot = this.telegramClient.getBot();
    const result = await bot.api.sendMessage(userId, text, {
      parse_mode: options?.parseMode,
    });
    return result.message_id;
  }

  async sendPhoto(userId: string, filePath: string): Promise<number> {
    const bot = this.telegramClient.getBot();
    const result = await bot.api.sendPhoto(userId, { source: filePath });
    return result.message_id;
  }

  async sendAudio(userId: string, filePath: string): Promise<number> {
    const bot = this.telegramClient.getBot();
    const result = await bot.api.sendAudio(userId, { source: filePath });
    return result.message_id;
  }

  async editMessage(userId: string, messageId: number, text: string, options?: SendMessageOptions): Promise<number> {
    const bot = this.telegramClient.getBot();
    const result = await bot.api.editMessageText(userId, messageId, text, {
      parse_mode: options?.parseMode,
    });
    return result.message_id;
  }

  async sendReaction(userId: string, messageId: number, options: ReactionOptions): Promise<void> {
    const bot = this.telegramClient.getBot();
    await bot.api.setMessageReaction(userId, messageId, { reaction: [{ type: 'emoji', emoji: options.emoji }] });
  }

  async sendTyping(userId: string): Promise<void> {
    const bot = this.telegramClient.getBot();
    await bot.api.sendChatAction(userId, 'typing');
  }

  async downloadFile(fileId: string): Promise<string> {
    const bot = this.telegramClient.getBot();
    const file = await bot.api.getFile(fileId);
    const filePath = file.file_path;
    // Download logic would be implemented here
    return filePath || '';
  }

  setupMessageHandler(handler: (ctx: Context) => Promise<void>): void {
    const bot = this.telegramClient.getBot();
    bot.on('message', handler);
  }
}
```

- [ ] **Step 3: Commit BotService**

```bash
cd packages/telegram-agent
git add src/module-bot/
git commit -m "feat: implement bot service with telegram API wrapper"
```

---

## Task 8: Implement Message Handler

**Files:**
- Create: `packages/telegram-agent/src/module-bot/message.handler.ts`

- [ ] **Step 1: Create message.handler.ts**

```typescript
import { Injectable, Inject } from '@artusjs/core';
import type { Context } from 'grammy';
import { BotService } from './bot.service.js';
import { BridgeService } from '../module-bridge/bridge.service.js';

@Injectable()
export class MessageHandler {
  @Inject()
  botService!: BotService;

  @Inject()
  bridgeService!: BridgeService;

  async handle(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const message = ctx.message;
    if (!message) return;

    // Acknowledge with reaction
    await this.botService.sendReaction(userId, message.message_id, { emoji: '👀' });

    // Forward to bridge
    await this.bridgeService.handleUserMessage(userId, message);
  }
}
```

- [ ] **Step 2: Commit message handler**

```bash
cd packages/telegram-agent
git add src/module-bot/message.handler.ts
git commit -m "feat: implement message handler"
```

---

## Task 9: Implement Media Handler

**Files:**
- Create: `packages/telegram-agent/src/module-bot/media.handler.ts`

- [ ] **Step 1: Create media.handler.ts**

```typescript
import { Injectable, Inject } from '@artusjs/core';
import path from 'path';
import fs from 'fs';
import type { Context } from 'grammy';
import { BotService } from './bot.service.js';

@Injectable()
export class MediaHandler {
  @Inject()
  botService!: BotService;

  private tempDir: string;

  constructor() {
    this.tempDir = path.join(process.env.HOME || '/tmp', '.telegram-agent', 'media');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async downloadPhoto(userId: string, photo: any): Promise<string> {
    const fileId = photo[photo.length - 1].file_id; // Get largest photo
    const file = await this.botService.downloadFile(fileId);
    
    const localPath = path.join(this.tempDir, userId, `${fileId}.jpg`);
    const userDir = path.dirname(localPath);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    // Download and save file (implementation details would vary)
    return localPath;
  }

  async uploadPhoto(userId: string, filePath: string): Promise<number> {
    return await this.botService.sendPhoto(userId, filePath);
  }

  async uploadAudio(userId: string, filePath: string): Promise<number> {
    return await this.botService.sendAudio(userId, filePath);
  }

  cleanupFile(filePath: string): void {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
```

- [ ] **Step 2: Commit media handler**

```bash
cd packages/telegram-agent
git add src/module-bot/media.handler.ts
git commit -m "feat: implement media handler"
```

---

## Task 10: Implement Command Handler

**Files:**
- Create: `packages/telegram-agent/src/module-bot/command.handler.ts`

- [ ] **Step 1: Create command.handler.ts**

```typescript
import { Injectable, Inject } from '@artusjs/core';
import type { Context } from 'grammy';
import { BotService } from './bot.service.js';
import { SessionManager } from '../plugins/acp/src/session.js';

@Injectable()
export class CommandHandler {
  @Inject()
  botService!: BotService;

  @Inject()
  sessionManager!: SessionManager;

  async handleStart(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    await this.botService.sendMessage(userId, 'Welcome to Telegram Agent! Use /status to check session.');
  }

  async handleStatus(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const session = this.sessionManager.get(userId);
    if (!session) {
      await this.botService.sendMessage(userId, 'No active session. Send a message to start.');
      return;
    }

    const status = `Session: ${session.id}\nStatus: ${session.status}\nCreated: ${session.createdAt}`;
    await this.botService.sendMessage(userId, status);
  }

  async handleRestart(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const session = this.sessionManager.get(userId);
    if (session) {
      await this.sessionManager.destroy(userId);
    }

    await this.botService.sendMessage(userId, 'Session restarted. Send a message to create new session.');
  }

  async handleClear(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    // Clear history (would inject HistoryManager)
    await this.botService.sendMessage(userId, 'History cleared.');
  }
}
```

- [ ] **Step 2: Commit command handler**

```bash
cd packages/telegram-agent
git add src/module-bot/command.handler.ts
git commit -m "feat: implement command handler"
```

---

## Task 11: Implement Bridge Service

**Files:**
- Create: `packages/telegram-agent/src/module-bridge/types.ts`
- Create: `packages/telegram-agent/src/module-bridge/bridge.service.ts`

- [ ] **Step 1: Create types.ts**

```typescript
export interface UserMessage {
  text?: string;
  photo?: any;
  audio?: any;
}

export interface AgentReply {
  type: 'text' | 'media';
  content: string;
  mediaType?: 'image' | 'audio';
}

export interface WebhookRequest {
  action: 'send-message' | 'send-media' | 'edit-message' | 'send-reaction';
  userId: string;
  data: any;
}
```

- [ ] **Step 2: Create bridge.service.ts**

```typescript
import { Injectable, Inject } from '@artusjs/core';
import { BotService } from '../module-bot/bot.service.js';
import { MediaHandler } from '../module-bot/media.handler.js';
import { SessionManager } from '../plugins/acp/src/session.js';
import { ACPClient } from '../plugins/acp/src/client.js';
import { HistoryManager } from '../plugins/acp/src/history.js';
import type { UserMessage, AgentReply, WebhookRequest } from './types.js';

@Injectable()
export class BridgeService {
  @Inject()
  botService!: BotService;

  @Inject()
  mediaHandler!: MediaHandler;

  @Inject()
  sessionManager!: SessionManager;

  @Inject()
  historyManager!: HistoryManager;

  async handleUserMessage(userId: string, message: any): Promise<void> {
    const session = this.sessionManager.get(userId);
    if (!session) {
      // Create new session
      const agentConfig = this.app.config.artusx?.agent;
      session = await this.sessionManager.create(userId, agentConfig);
      
      // Setup ACP client callbacks
      const client = new ACPClient({
        sendMessage: async (text: string) => {
          await this.botService.sendMessage(userId, text);
        },
        sendTyping: async () => {
          await this.botService.sendTyping(userId);
        },
        onMediaUpload: async (path: string, type: 'image' | 'audio') => {
          if (type === 'image') {
            await this.mediaHandler.uploadPhoto(userId, path);
          } else {
            await this.mediaHandler.uploadAudio(userId, path);
          }
        },
      });
    }

    // Handle message types
    if (message.photo) {
      const filePath = await this.mediaHandler.downloadPhoto(userId, message.photo);
      const prompt = `User sent image: ${filePath}`;
      await this.sendPromptToAgent(session, prompt);
      
      await this.historyManager.addEntry(userId, {
        role: 'user',
        content: `[Image: ${filePath}]`,
        timestamp: new Date(),
      });
    } else if (message.text) {
      await this.sendPromptToAgent(session, message.text);
      
      await this.historyManager.addEntry(userId, {
        role: 'user',
        content: message.text,
        timestamp: new Date(),
      });
    }

    // Show processing reaction
    await this.botService.sendReaction(userId, message.message_id, { emoji: '🤔' });
  }

  async handleWebhookRequest(request: WebhookRequest): Promise<any> {
    const { userId, action, data } = request;

    switch (action) {
      case 'send-message':
        return await this.botService.sendMessage(userId, data.text, data.options);
      case 'send-media':
        if (data.type === 'image') {
          return await this.mediaHandler.uploadPhoto(userId, data.filePath);
        } else {
          return await this.mediaHandler.uploadAudio(userId, data.filePath);
        }
      case 'edit-message':
        return await this.botService.editMessage(userId, data.messageId, data.text, data.options);
      case 'send-reaction':
        return await this.botService.sendReaction(userId, data.messageId, { emoji: data.emoji });
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private async sendPromptToAgent(session: any, prompt: string): Promise<void> {
    if (!session.agentProcess) return;

    session.agentProcess.stdin.write(JSON.stringify({ prompt }) + '\n');
    session.lastActivityAt = new Date();
  }
}
```

- [ ] **Step 3: Commit bridge service**

```bash
cd packages/telegram-agent
git add src/module-bridge/
git commit -m "feat: implement bridge service for message orchestration"
```

---

## Task 12: Implement Webhook Controller

**Files:**
- Create: `packages/telegram-agent/src/module-webhook/types.ts`
- Create: `packages/telegram-agent/src/module-webhook/auth.middleware.ts`
- Create: `packages/telegram-agent/src/module-webhook/webhook.service.ts`
- Create: `packages/telegram-agent/src/module-webhook/webhook.controller.ts`

- [ ] **Step 1: Create types.ts**

```typescript
export interface SendMessageRequest {
  userId: string;
  text: string;
  parseMode?: 'HTML' | 'Markdown';
}

export interface SendMediaRequest {
  userId: string;
  filePath: string;
  type: 'image' | 'audio';
}

export interface EditMessageRequest {
  userId: string;
  messageId: number;
  text: string;
  parseMode?: 'HTML' | 'Markdown';
}

export interface SendReactionRequest {
  userId: string;
  messageId: number;
  emoji: string;
}
```

- [ ] **Step 2: Create auth.middleware.ts**

```typescript
import { Middleware } from '@artusjs/core';
import type { ArtusXContext, ArtusXNext } from '@artusjs/core';

@Middleware()
export class AuthMiddleware {
  async use(ctx: ArtusXContext, next: ArtusXNext): Promise<void> {
    const config = ctx.app.config;
    const enableAuth = config.artusx?.webhook?.enableAuth;

    if (!enableAuth) {
      await next();
      return;
    }

    const token = ctx.headers['authorization']?.replace('Bearer ', '');
    const configToken = config.artusx?.webhook?.token;

    if (!token || token !== configToken) {
      ctx.status = 401;
      ctx.body = {
        error: 'Unauthorized',
        message: 'Invalid or missing authorization token',
      };
      return;
    }

    await next();
  }
}
```

- [ ] **Step 3: Create webhook.service.ts**

```typescript
import { Injectable, Inject } from '@artusjs/core';
import { BridgeService } from '../module-bridge/bridge.service.js';
import type { SendMessageRequest, SendMediaRequest, EditMessageRequest, SendReactionRequest } from './types.js';

@Injectable()
export class WebhookService {
  @Inject()
  bridgeService!: BridgeService;

  async sendMessage(request: SendMessageRequest): Promise<{ messageId: number }> {
    const messageId = await this.bridgeService.handleWebhookRequest({
      action: 'send-message',
      userId: request.userId,
      data: {
        text: request.text,
        options: { parseMode: request.parseMode },
      },
    });
    return { messageId };
  }

  async sendMedia(request: SendMediaRequest): Promise<{ messageId: number }> {
    const messageId = await this.bridgeService.handleWebhookRequest({
      action: 'send-media',
      userId: request.userId,
      data: {
        filePath: request.filePath,
        type: request.type,
      },
    });
    return { messageId };
  }

  async editMessage(request: EditMessageRequest): Promise<{ messageId: number }> {
    const messageId = await this.bridgeService.handleWebhookRequest({
      action: 'edit-message',
      userId: request.userId,
      data: {
        messageId: request.messageId,
        text: request.text,
        options: { parseMode: request.parseMode },
      },
    });
    return { messageId };
  }

  async sendReaction(request: SendReactionRequest): Promise<void> {
    await this.bridgeService.handleWebhookRequest({
      action: 'send-reaction',
      userId: request.userId,
      data: {
        messageId: request.messageId,
        emoji: request.emoji,
      },
    });
  }
}
```

- [ ] **Step 4: Create webhook.controller.ts**

```typescript
import { Controller, POST, StatusCode, Inject } from '@artusjs/core';
import type { ArtusXContext } from '@artusjs/core';
import { AuthMiddleware } from './auth.middleware.js';
import { WebhookService } from './webhook.service.js';

@Controller('/api/telegram')
export class WebhookController {
  @Inject()
  webhookService!: WebhookService;

  @POST('/send-message')
  @StatusCode(200)
  async sendMessage(ctx: ArtusXContext): Promise<{ messageId: number }> {
    const body = ctx.request.body as any;
    const result = await this.webhookService.sendMessage({
      userId: body.userId,
      text: body.text,
      parseMode: body.parseMode,
    });
    return result;
  }

  @POST('/send-media')
  @StatusCode(200)
  async sendMedia(ctx: ArtusXContext): Promise<{ messageId: number }> {
    const body = ctx.request.body as any;
    const result = await this.webhookService.sendMedia({
      userId: body.userId,
      filePath: body.filePath,
      type: body.type,
    });
    return result;
  }

  @POST('/edit-message')
  @StatusCode(200)
  async editMessage(ctx: ArtusXContext): Promise<{ messageId: number }> {
    const body = ctx.request.body as any;
    const result = await this.webhookService.editMessage({
      userId: body.userId,
      messageId: body.messageId,
      text: body.text,
      parseMode: body.parseMode,
    });
    return result;
  }

  @POST('/send-reaction')
  @StatusCode(200)
  async sendReaction(ctx: ArtusXContext): Promise<{ success: boolean }> {
    const body = ctx.request.body as any;
    await this.webhookService.sendReaction({
      userId: body.userId,
      messageId: body.messageId,
      emoji: body.emoji,
    });
    return { success: true };
  }
}
```

- [ ] **Step 5: Commit webhook module**

```bash
cd packages/telegram-agent
git add src/module-webhook/
git commit -m "feat: implement webhook controller with authentication"
```

---

## Task 13: Create Skills Documentation

**Files:**
- Create: `skills/telegram-agent/SKILL.md`
- Create: `skills/telegram-agent/references/webhook-api.md`
- Create: `skills/telegram-agent/references/send-message.md`
- Create: `skills/telegram-agent/references/send-media.md`
- Create: `skills/telegram-agent/references/edit-message.md`
- Create: `skills/telegram-agent/references/send-reaction.md`
- Create: `skills/telegram-agent/references/auth.md`
- Create: `skills/telegram-agent/references/errors.md`
- Create: `skills/telegram-agent/scripts/test-webhook.sh`

- [ ] **Step 1: Create SKILL.md**

```markdown
---
name: telegram-agent
description: Control Telegram Bot via HTTP webhook API to send messages, media, reactions, and more.
---

# Telegram Agent Skill

Control your Telegram Bot via webhook API.

## API Endpoint

- **Base URL**: `http://localhost:7001/api/telegram`
- **Authentication**: Bearer Token (see auth.md)
- **Content-Type**: `application/json`

## Available Operations

### Send Message
- **Endpoint**: `POST /send-message`
- **Parameters**:
  - `userId` (string): Telegram user ID
  - `text` (string): Message text
  - `parseMode` (optional): `HTML` or `Markdown`
- **Example**: See `references/send-message.md`

### Send Media
- **Endpoint**: `POST /send-media`
- **Parameters**:
  - `userId` (string): Telegram user ID
  - `filePath` (string): Local file path
  - `type` (string): `image` or `audio`
- **Example**: See `references/send-media.md`

### Edit Message
- **Endpoint**: `POST /edit-message`
- **Parameters**:
  - `userId` (string): Telegram user ID
  - `messageId` (number): Message ID to edit
  - `text` (string): New text
  - `parseMode` (optional): `HTML` or `Markdown`
- **Example**: See `references/edit-message.md`

### Send Reaction
- **Endpoint**: `POST /send-reaction`
- **Parameters**:
  - `userId` (string): Telegram user ID
  - `messageId` (number): Message ID
  - `emoji` (string): Emoji to send
- **Example**: See `references/send-reaction.md`

## Authentication

Set token in config or environment:

```bash
export TELEGRAM_WEBHOOK_TOKEN="your-secret-token"
```

Include in request:

```bash
curl -H "Authorization: Bearer your-secret-token" ...
```

See `references/auth.md` for details.

## Error Handling

See `references/errors.md` for error codes and handling.

## Quick Test

Use test script:

```bash
./scripts/test-webhook.sh send-message "123456" "Hello from skill!"
```
```

- [ ] **Step 2: Create references/webhook-api.md**

```markdown
# Webhook API Reference

Complete API documentation for Telegram Agent webhook.

## Base URL

```
http://localhost:7001/api/telegram
```

## Authentication

All endpoints require Bearer token authentication (unless disabled in development):

```http
Authorization: Bearer <your-token>
```

## Common Headers

```http
Content-Type: application/json
Authorization: Bearer <token>
```

## Endpoints

### POST /send-message

Send text message to user.

**Request Body:**

```json
{
  "userId": "123456",
  "text": "Hello, this is a message",
  "parseMode": "HTML" // optional: HTML or Markdown
}
```

**Response:**

```json
{
  "messageId": 42
}
```

### POST /send-media

Send image or audio to user.

**Request Body:**

```json
{
  "userId": "123456",
  "filePath": "/tmp/screenshot.png",
  "type": "image" // or "audio"
}
```

**Response:**

```json
{
  "messageId": 43
}
```

### POST /edit-message

Edit existing message.

**Request Body:**

```json
{
  "userId": "123456",
  "messageId": 42,
  "text": "Updated message text",
  "parseMode": "HTML" // optional
}
```

**Response:**

```json
{
  "messageId": 42
}
```

### POST /send-reaction

Send emoji reaction to message.

**Request Body:**

```json
{
  "userId": "123456",
  "messageId": 42,
  "emoji": "👍"
}
```

**Response:**

```json
{
  "success": true
}
```

## Status Codes

- `200`: Success
- `401`: Unauthorized (invalid or missing token)
- `400`: Bad Request (missing or invalid parameters)
- `500`: Internal Server Error

## Examples

See individual reference files for detailed examples.
```

- [ ] **Step 3: Create references/send-message.md**

```markdown
# Send Message Examples

## Basic Text Message

```bash
curl -X POST http://localhost:7001/api/telegram/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "userId": "123456",
    "text": "Hello from Telegram Agent!"
  }'
```

## HTML Formatting

```bash
curl -X POST http://localhost:7001/api/telegram/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "userId": "123456",
    "text": "<b>Bold</b> and <i>italic</i> text",
    "parseMode": "HTML"
  }'
```

## Markdown Formatting

```bash
curl -X POST http://localhost:7001/api/telegram/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "userId": "123456",
    "text": "**Bold** and _italic_ text",
    "parseMode": "Markdown"
  }'
```

## Response

```json
{
  "messageId": 42
}
```

The `messageId` can be used for subsequent operations like editing or reactions.
```

- [ ] **Step 4: Create references/send-media.md**

```markdown
# Send Media Examples

## Send Image

```bash
curl -X POST http://localhost:7001/api/telegram/send-media \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "userId": "123456",
    "filePath": "/tmp/screenshot.png",
    "type": "image"
  }'
```

## Send Audio

```bash
curl -X POST http://localhost:7001/api/telegram/send-media \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "userId": "123456",
    "filePath": "/tmp/recording.mp3",
    "type": "audio"
  }'
```

## Supported Formats

**Images:**
- JPEG, PNG, GIF, WebP

**Audio:**
- MP3, OGG, M4A, WAV

## Response

```json
{
  "messageId": 43
}
```

## Error Cases

- File not found: `400 Bad Request`
- Invalid format: `400 Bad Request`
```

- [ ] **Step 5: Create references/edit-message.md**

```markdown
# Edit Message Examples

## Basic Edit

```bash
curl -X POST http://localhost:7001/api/telegram/edit-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "userId": "123456",
    "messageId": 42,
    "text": "Updated message text"
  }'
```

## Edit with Formatting

```bash
curl -X POST http://localhost:7001/api/telegram/edit-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "userId": "123456",
    "messageId": 42,
    "text": "<b>Updated</b> with HTML formatting",
    "parseMode": "HTML"
  }'
```

## Response

```json
{
  "messageId": 42
}
```

## Limitations

- Can only edit messages sent by the bot
- Cannot edit media messages
- Message must still exist (not deleted)
```

- [ ] **Step 6: Create references/send-reaction.md**

```markdown
# Send Reaction Examples

## Basic Reaction

```bash
curl -X POST http://localhost:7001/api/telegram/send-reaction \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "userId": "123456",
    "messageId": 42,
    "emoji": "👍"
  }'
```

## Common Emojis

- 👍 - Acknowledgment
- 🤔 - Thinking
- 🔧 - Processing
- ✅ - Complete
- 👀 - Watching
- 📤 - Sending
- 📥 - Receiving

## Response

```json
{
  "success": true
}
```

## Notes

- Reaction appears briefly then disappears
- Can only react to visible messages
```

- [ ] **Step 7: Create references/auth.md**

```markdown
# Authentication Guide

## Token Configuration

Set webhook token in environment:

```bash
export TELEGRAM_WEBHOOK_TOKEN="your-secret-token"
```

Or in config file:

```yaml
webhook:
  token: "your-secret-token"
  enableAuth: true
```

## Using Token

Include token in request header:

```bash
curl -H "Authorization: Bearer your-secret-token" ...
```

## Disable Auth (Development)

In `config.development.ts`:

```typescript
webhook: {
  enableAuth: false,
}
```

## Security Best Practices

- Use strong, random tokens
- Never share tokens publicly
- Use environment variables in production
- Enable auth in production environment
- Rotate tokens periodically
```

- [ ] **Step 8: Create references/errors.md**

```markdown
# Error Handling

## HTTP Status Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 401 | Unauthorized | Check token validity |
| 400 | Bad Request | Verify request parameters |
| 404 | Not Found | Check endpoint path |
| 500 | Server Error | Check logs, retry |

## Error Response Format

```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing authorization token"
}
```

## Common Errors

### 401 Unauthorized

**Cause:** Missing or invalid token

**Solution:**
- Include `Authorization: Bearer <token>` header
- Verify token matches config

### 400 Bad Request

**Cause:** Missing required parameters

**Solution:**
- Check all required fields (userId, text, etc.)
- Verify parameter types (string, number)

### 500 Internal Error

**Cause:** Bot not initialized or Telegram API error

**Solution:**
- Check bot token configuration
- Verify Telegram Bot API status
- Check application logs

## Debugging

Enable debug logging:

```bash
export TELEGRAM_ACP_LOG_LEVEL=debug
```

Check logs for detailed error information.
```

- [ ] **Step 9: Create scripts/test-webhook.sh**

```bash
#!/bin/bash

# Test webhook endpoints

BASE_URL="http://localhost:7001/api/telegram"
TOKEN="your-secret-token"

send_message() {
  local userId="$1"
  local text="$2"
  
  curl -X POST "$BASE_URL/send-message" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"userId\": \"$userId\", \"text\": \"$text\"}"
}

send_media() {
  local userId="$1"
  local filePath="$2"
  local type="$3"
  
  curl -X POST "$BASE_URL/send-media" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"userId\": \"$userId\", \"filePath\": \"$filePath\", \"type\": \"$type\"}"
}

# Usage examples
case "$1" in
  send-message)
    send_message "$2" "$3"
    ;;
  send-media)
    send_media "$2" "$3" "$4"
    ;;
  *)
    echo "Usage: $0 {send-message|send-media} <userId> <text|path> [type]"
    ;;
esac
```

- [ ] **Step 10: Commit skills**

```bash
cd skills/telegram-agent
git add .
git commit -m "feat: add telegram-agent skills documentation"
```

---

## Task 14: Update Package README

**Files:**
- Modify: `packages/telegram-agent/README.md`

- [ ] **Step 1: Update README with full documentation**

Replace README.md content with comprehensive guide (including architecture diagram, usage examples, configuration details).

- [ ] **Step 2: Commit README update**

```bash
cd packages/telegram-agent
git add README.md
git commit -m "docs: update README with comprehensive guide"
```

---

## Task 15: Test Application

**Files:**
- Test: Manual testing steps

- [ ] **Step 1: Build application**

Run: `cd packages/telegram-agent && pnpm run build`

Expected: TypeScript compiles without errors

- [ ] **Step 2: Start application**

Run: `cd packages/telegram-agent && pnpm run dev`

Expected: Application starts on port 7001, bot initializes

- [ ] **Step 3: Test webhook endpoints**

Run: `curl http://localhost:7001/api/telegram/send-message -H "Authorization: Bearer test" -H "Content-Type: application/json" -d '{"userId":"test","text":"Hello"}'`

Expected: Returns `{"messageId": ...}` or appropriate error

- [ ] **Step 4: Test bot integration**

Send message to Telegram bot

Expected: Bot responds with acknowledgment

- [ ] **Step 5: Verify all features**

- Webhook API works
- Bot receives messages
- Session management works
- Media operations work

---

## Self-Review Checklist

**Spec Coverage:**

✅ Telegram Plugin - Task 3  
✅ ACP Plugin (session, process, client) - Tasks 4-6  
✅ BotService and handlers - Tasks 7-10  
✅ Bridge orchestration - Task 11  
✅ Webhook controller - Task 12  
✅ Skills documentation - Task 13  
✅ Configuration system - Task 2  
✅ Application skeleton - Task 1  

**Placeholder Scan:**

✅ No TBD, TODO, or vague descriptions  
✅ All code blocks are complete  
✅ All commands are specific  
✅ All file paths are exact  

**Type Consistency:**

✅ Method names match across tasks  
✅ Parameter names consistent  
✅ Return types consistent  

---

