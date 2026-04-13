# Telegram Agent Design Specification

## Project Overview

### Goal

Create a new artusx-based application `packages/telegram-agent` to replace the existing `packages/telegram-acp` with a more elegant architecture that supports webhook-based media control and skills integration.

### Key Improvements

1. **Proactive Media Control** - Agent can actively send media via webhook API, no need for regex parsing
2. **More Telegram Features** - Support inline keyboards, message editing, reactions, etc.
3. **Better Performance** - Clean separation of concerns, no streaming regex matching
4. **Skills Integration** - Provide skills for agent to call webhook APIs

### Architecture Principle

- Leverage artusx plugin system for Telegram Bot and ACP capabilities
- Use artusx module organization (Module-based, not MVC)
- Clear separation: Plugins → Modules (bot, webhook, bridge)
- Skills as documentation + examples (not code)

---

## Architecture Design

### Directory Structure

```
packages/telegram-agent/
├── src/
│   ├── bootstrap.ts              # Application entry point
│   ├── index.ts                  # Module exports
│   ├── config/                   # Configuration
│   │   ├── config.default.ts     # Default config
│   │   ├── config.development.ts # Dev environment
│   │   ├── config.production.ts  # Production
│   │   └── plugin.ts             # Plugin config
│   ├── plugins/                  # Inline plugins
│   │   ├── telegram/             # Telegram plugin
│   │   │   ├── src/
│   │   │   │   ├── client.ts     # grammy client
│   │   │   │   ├── types.ts      # Type definitions
│   │   │   │   ├── lifecycle.ts  # Lifecycle hooks
│   │   │   │   └── index.ts      # Plugin entry
│   │   │   ├── meta.json         # Plugin metadata
│   │   │   └── package.json
│   │   └── acp/                  # ACP plugin
│   │   │   ├── src/
│   │   │   │   ├── client.ts     # ACP Client impl
│   │   │   │   ├── session.ts    # Session management
│   │   │   │   ├── process.ts    # Agent process lifecycle
│   │   │   │   ├── types.ts      # Type definitions
│   │   │   │   ├── lifecycle.ts  # Lifecycle hooks
│   │   │   │   └── index.ts      # Plugin entry
│   │   │   ├── meta.json         # Plugin metadata
│   │   │   └── package.json
│   ├── module-webhook/           # Webhook module
│   │   ├── webhook.controller.ts # HTTP API
│   │   ├── webhook.service.ts    # Business logic
│   │   ├── auth.middleware.ts    # Auth middleware
│   │   └── types.ts              # API types
│   ├── module-bridge/            # Bridge module
│   │   ├── bridge.service.ts     # Core orchestration
│   │   ├── flow-manager.ts       # Message flow
│   │   └── types.ts              # Flow types
│   └── module-bot/               # Telegram business module
│   │   ├── bot.service.ts        # Bot API wrapper (uses telegram plugin)
│   │   ├── message.handler.ts    # Message handler
│   │   ├── reaction.handler.ts   # Reaction handler
│   │   ├── media.handler.ts      # Media handler
│   │   ├── command.handler.ts    # Command handler
│   │   └── types.ts              # Type definitions
├── package.json
├── tsconfig.json
├── README.md
└── dist/

skills/
└── telegram-agent/
    ├── SKILL.md                  # Skill definition
    ├── references/
    │   ├── webhook-api.md        # Full API doc
    │   ├── send-message.md       # Send message examples
    │   ├── send-media.md         # Send media examples
    │   ├── edit-message.md       # Edit message examples
    │   ├── send-reaction.md      # Send reaction examples
    │   ├── auth.md               # Authentication
    │   └── errors.md             # Error handling
    └── scripts/                  # Test scripts (optional)
        ├── test-webhook.sh
        └── example-requests/
```

---

## Plugin Design

### 1. Telegram Plugin

**Purpose**: Provide Telegram Bot core capability via grammy

**Responsibilities**:
- Initialize grammy Bot instance
- Manage Bot lifecycle (connect, disconnect)
- Provide injectable client for other modules

**Key Components**:

```typescript
// src/plugins/telegram/src/client.ts
import { Bot } from 'grammy';

export class TelegramClient {
  private bot: Bot;
  
  constructor(token: string) {
    this.bot = new Bot(token);
  }
  
  async start() {
    await this.bot.start();
  }
  
  async stop() {
    await this.bot.stop();
  }
  
  getBot(): Bot {
    return this.bot;
  }
}
```

```typescript
// src/plugins/telegram/src/lifecycle.ts
import { PluginBase } from '@artusjs/core';
import { TelegramClient } from './client';

export default class TelegramPlugin extends PluginBase {
  private client: TelegramClient;
  
  async willReady() {
    const config = this.app.config;
    this.client = new TelegramClient(config.telegram.botToken);
    await this.client.start();
    
    // Register as injectable (public API)
    this.registerApi(TelegramClient, {
      visibility: 'public',
      scope: 'singleton',
      namespace: 'telegram'
    });
  }
  
  async beforeClose() {
    await this.client.stop();
  }
}
```

**Plugin Metadata**:

```json
// src/plugins/telegram/meta.json
{
  "name": "telegram"
}
```

---

### 2. ACP Plugin

**Purpose**: Manage ACP agent processes and communication

**Responsibilities**:
- Manage agent process lifecycle (spawn, communication, cleanup)
- Handle per-user sessions
- Implement ACP Client interface
- Manage streaming messages and history

**Key Components**:

```typescript
// src/plugins/acp/src/client.ts
import type * as acp from '@agentclientprotocol/sdk';

export class ACPClient implements acp.Client {
  // Implement acp.Client interface
  // Handle permission requests, session updates, file operations
  
  async requestPermission(params: acp.RequestPermissionRequest): Promise<acp.RequestPermissionResponse> {
    // Auto-allow logic
  }
  
  async sessionUpdate(params: acp.SessionNotification): Promise<void> {
    // Handle streaming updates
  }
  
  async flush(): Promise<string> {
    // Finalize message stream
  }
}
```

```typescript
// src/plugins/acp/src/session.ts
export interface Session {
  id: string;
  userId: string;
  agentProcess: ChildProcess;
  client: ACPClient;
  status: 'active' | 'idle' | 'closed';
  agentConfig: AgentConfig;
  createdAt: Date;
  lastActivityAt: Date;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  
  async create(userId: string, agentConfig: AgentConfig): Promise<Session> {
    // Create new session with agent process
  }
  
  async restore(userId: string): Promise<Session | null> {
    // Restore from persisted state
  }
  
  async destroy(userId: string): Promise<void> {
    // Cleanup session and process
  }
  
  get(userId: string): Session | undefined {
    return this.sessions.get(userId);
  }
}
```

```typescript
// src/plugins/acp/src/process.ts
import { spawn } from 'child_process';

export class ProcessManager {
  async spawnAgent(config: AgentConfig): Promise<ChildProcess> {
    const process = spawn(config.command, config.args, {
      cwd: config.cwd,
      env: config.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    return process;
  }
  
  async killProcess(process: ChildProcess): Promise<void> {
    process.kill('SIGTERM');
  }
}
```

```typescript
// src/plugins/acp/src/lifecycle.ts
import { PluginBase } from '@artusjs/core';
import { SessionManager } from './session';
import { ProcessManager } from './process';
import { ACPClient } from './client';

export default class ACPPlugin extends PluginBase {
  private sessionManager: SessionManager;
  private processManager: ProcessManager;
  
  async willReady() {
    this.sessionManager = new SessionManager();
    this.processManager = new ProcessManager();
    
    // Register as injectable (public API)
    this.registerApi(SessionManager, {
      visibility: 'public',
      scope: 'singleton',
      namespace: 'acp'
    });
    
    this.registerApi(ProcessManager, {
      visibility: 'public',
      scope: 'singleton',
      namespace: 'acp'
    });
  }
  
  async beforeClose() {
    // Cleanup all sessions
    for (const [userId, session] of this.sessionManager.sessions) {
      await this.sessionManager.destroy(userId);
    }
  }
}
```

**Plugin Metadata**:

```json
// src/plugins/acp/meta.json
{
  "name": "acp"
}
```

---

## Module Design

### 1. Module-Bot (Telegram Business Module)

**Purpose**: Telegram-specific business logic

**Key Services**:

```typescript
// src/module-bot/bot.service.ts
import { Injectable, Inject } from '@artusjs/core';
import { TelegramClient } from '../plugins/telegram/src/client';

@Injectable()
export class BotService {
  @Inject()
  telegramClient: TelegramClient;
  
  async sendMessage(userId: string, text: string, parseMode?: 'HTML' | 'Markdown') {
    const bot = this.telegramClient.getBot();
    return bot.api.sendMessage(userId, text, { parse_mode: parseMode });
  }
  
  async sendPhoto(userId: string, filePath: string) {
    const bot = this.telegramClient.getBot();
    return bot.api.sendPhoto(userId, { source: filePath });
  }
  
  async sendReaction(userId: string, messageId: number, emoji: string) {
    // Implementation
  }
  
  async downloadMedia(fileId: string): Promise<string> {
    // Download and return local path
  }
  
  // ... other methods
}
```

```typescript
// src/module-bot/message.handler.ts
import { Injectable, Inject } from '@artusjs/core';
import { BridgeService } from '../module-bridge/bridge.service';

@Injectable()
export class MessageHandler {
  @Inject()
  bridgeService: BridgeService;
  
  async handleUserMessage(ctx: Context) {
    const userId = ctx.from?.id.toString();
    const message = ctx.message;
    
    if (!userId) return;
    
    await this.bridgeService.handleUserMessage(userId, message);
  }
}
```

**Handlers**:
- `MessageHandler` - Handle user messages → forward to Bridge
- `ReactionHandler` - Manage reaction system (migrate from existing)
- `MediaHandler` - Handle media download/upload (migrate from existing)
- `CommandHandler` - Handle commands (/start, /restart, etc.)

---

### 2. Module-Webhook (Webhook Module)

**Purpose**: Provide HTTP API for skills to call

**API Design**:

```typescript
// src/module-webhook/webhook.controller.ts
import { Controller, POST, Body, StatusCode } from '@artusjs/core';
import type { ArtusXContext } from '@artusjs/core';
import { WebhookService } from './webhook.service';
import { AuthMiddleware } from './auth.middleware';

@Controller('/api/telegram')
@MW([AuthMiddleware])
export class WebhookController {
  @Inject()
  webhookService: WebhookService;
  
  @POST('/send-message')
  @StatusCode(200)
  async sendMessage(ctx: ArtusXContext) {
    const { userId, text, parseMode } = ctx.request.body;
    const result = await this.webhookService.sendMessage(userId, text, parseMode);
    return result;
  }
  
  @POST('/send-media')
  @StatusCode(200)
  async sendMedia(ctx: ArtusXContext) {
    const { userId, filePath, type } = ctx.request.body;
    const result = await this.webhookService.sendMedia(userId, filePath, type);
    return result;
  }
  
  @POST('/edit-message')
  @StatusCode(200)
  async editMessage(ctx: ArtusXContext) {
    const { userId, messageId, text, parseMode } = ctx.request.body;
    const result = await this.webhookService.editMessage(userId, messageId, text, parseMode);
    return result;
  }
  
  @POST('/send-reaction')
  @StatusCode(200)
  async sendReaction(ctx: ArtusXContext) {
    const { userId, messageId, emoji } = ctx.request.body;
    const result = await this.webhookService.sendReaction(userId, messageId, emoji);
    return result;
  }
  
  @POST('/get-user-info')
  @StatusCode(200)
  async getUserInfo(ctx: ArtusXContext) {
    const { userId } = ctx.request.body;
    const result = await this.webhookService.getUserInfo(userId);
    return result;
  }
}
```

**Webhook Service**:

```typescript
// src/module-webhook/webhook.service.ts
import { Injectable, Inject } from '@artusjs/core';
import { BotService } from '../module-bot/bot.service';

@Injectable()
export class WebhookService {
  @Inject()
  botService: BotService;
  
  async sendMessage(userId: string, text: string, parseMode?: string) {
    return this.botService.sendMessage(userId, text, parseMode);
  }
  
  async sendMedia(userId: string, filePath: string, type: 'image' | 'audio') {
    if (type === 'image') {
      return this.botService.sendPhoto(userId, filePath);
    } else {
      return this.botService.sendAudio(userId, filePath);
    }
  }
  
  // ... other methods
}
```

**Authentication Middleware**:

```typescript
// src/module-webhook/auth.middleware.ts
import { Middleware } from '@artusjs/core';
import type { ArtusXContext, ArtusXNext } from '@artusjs/core';

@Middleware()
export class AuthMiddleware {
  async use(ctx: ArtusXContext, next: ArtusXNext) {
    const token = ctx.headers['authorization']?.replace('Bearer ', '');
    const configToken = ctx.app.config.webhook?.token;
    
    if (!token || token !== configToken) {
      ctx.status = 401;
      ctx.body = { error: 'Unauthorized' };
      return;
    }
    
    await next();
  }
}
```

---

### 3. Module-Bridge (Bridge Module)

**Purpose**: Orchestrate message flow between plugins and modules

**Core Service**:

```typescript
// src/module-bridge/bridge.service.ts
import { Injectable, Inject } from '@artusjs/core';
import { BotService } from '../module-bot/bot.service';
import { SessionManager } from '../plugins/acp/src/session';
import { ProcessManager } from '../plugins/acp/src/process';

@Injectable()
export class BridgeService {
  @Inject()
  botService: BotService;
  
  @Inject()
  sessionManager: SessionManager;
  
  @Inject()
  processManager: ProcessManager;
  
  // User Message → Agent
  async handleUserMessage(userId: string, message: Message) {
    const text = message.text;
    
    // Check for media
    if (message.photo) {
      const filePath = await this.botService.downloadMedia(message.photo);
      const prompt = `User sent image: ${filePath}`;
      await this.sendPromptToAgent(userId, prompt);
    } else if (text) {
      await this.sendPromptToAgent(userId, text);
    }
    
    // Show reaction
    await this.botService.sendReaction(userId, '👀');
  }
  
  // Agent Output → Telegram
  async handleAgentOutput(userId: string, output: Buffer) {
    const data = JSON.parse(output.toString());
    
    // Handle different types: text, media, reaction
    if (data.type === 'text') {
      await this.botService.sendMessage(userId, data.text);
    } else if (data.type === 'media') {
      await this.botService.sendMedia(userId, data.path, data.mediaType);
    }
  }
  
  // Webhook Request → Telegram
  async handleWebhookRequest(userId: string, request: WebhookRequest) {
    switch (request.action) {
      case 'send-message':
        return this.botService.sendMessage(userId, request.text, request.parseMode);
      case 'send-media':
        return this.botService.sendMedia(userId, request.filePath, request.type);
      // ... other actions
    }
  }
  
  private async sendPromptToAgent(userId: string, prompt: string) {
    const session = this.sessionManager.get(userId);
    if (!session) {
      // Create new session
      const agentConfig = this.app.config.agent;
      session = await this.sessionManager.create(userId, agentConfig);
    }
    
    session.agentProcess.stdin.write(JSON.stringify({ prompt }) + '\n');
  }
}
```

---

## Data Flow

### Message Flow Diagram

```
User Message Flow:
Telegram User → Bot → MessageHandler → BridgeService → ACP Plugin (SessionManager) → Agent Process

Agent Reply Flow:
Agent Process → ACP Plugin (ACPClient) → BridgeService → BotService → Telegram User

Webhook Flow:
Skill Call → WebhookController → WebhookService → BotService → Telegram User
```

### State Management

**Session State** (in ACP Plugin):

```typescript
interface Session {
  id: string;
  userId: string;
  agentProcess: ChildProcess;
  client: ACPClient;
  status: 'active' | 'idle' | 'closed';
  agentConfig: AgentConfig;
  createdAt: Date;
  lastActivityAt: Date;
}
```

**Storage Location**: `~/.telegram-agent/sessions/{userId}/{sessionId}.json`

**Migration**: Preserve existing session logic from `telegram-acp`

---

## Configuration

### Application Configuration

```typescript
// config/config.default.ts
import path from 'path';
import { ArtusXConfig } from '@artusx/core';

export default () => {
  const artusx: ArtusXConfig = {
    port: 7001,
    // webhook config
    webhook: {
      token: process.env.TELEGRAM_WEBHOOK_TOKEN || 'default-token',
      enableAuth: true,
    },
    // telegram config
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    },
    // agent config
    agent: {
      preset: 'claude',
      command: 'pnpx',
      args: ['@agentclientprotocol/claude-agent-acp'],
      cwd: process.cwd(),
      env: {},
      showThoughts: false,
    },
    // session config
    session: {
      idleTimeoutMs: 24 * 60 * 60 * 1000, // 24 hours
      maxConcurrentUsers: 10,
      autoRecover: true,
    },
  };

  return { artusx };
};
```

### Plugin Configuration

```typescript
// config/plugin.ts
import path from 'path';

export default {
  artusx: {
    enable: true,
    package: '@artusx/core',
  },
  telegram: {
    enable: true,
    path: path.join(__dirname, '../src/plugins/telegram'),
  },
  acp: {
    enable: true,
    path: path.join(__dirname, '../src/plugins/acp'),
  },
};
```

---

## Skills Design

### SKILL.md

```markdown
---
name: telegram-agent
description: Control Telegram Bot via HTTP webhook API to send messages, media, reactions, and more.
---

# Telegram Agent Skill

Control your Telegram Bot via webhook API.

## API Endpoint

- **Base URL**: `http://localhost:7001/api/telegram`
- **Authentication**: Bearer Token
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
  - `userId` (string): Telegram user user ID
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

### Get User Info
- **Endpoint**: `POST /get-user-info`
- **Parameters**:
  - `userId` (string): Telegram user ID
- **Example**: See `references/get-user-info.md`

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
```

### Reference Files

**webhook-api.md** - Full API documentation with all endpoints  
**send-message.md** - Example requests for sending text  
**send-media.md** - Example requests for sending images/audio  
**edit-message.md** - Example requests for editing messages  
**send-reaction.md** - Example requests for reactions  
**auth.md** - Authentication details and security best practices  
**errors.md** - Error codes, common issues, troubleshooting  

---

## Implementation Details

### Dependencies

**Package.json**:

```json
{
  "name": "telegram-agent",
  "version": "0.1.0",
  "type": "module",
  "dependencies": {
    "@artusjs/core": "^1.0.0",
    "@agentclientprotocol/sdk": "^0.16.1",
    "grammy": "^1.41.1",
    "yaml": "^2.8.3"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.5.0"
  },
  "scripts": {
    "dev": "artusx-dev",
    "start": "node dist/bootstrap.js",
    "build": "tsc"
  }
}
```

### Lifecycle Hooks

**bootstrap.ts**:

```typescript
import { ArtusApplication } from '@artusjs/core';

async function main() {
  const app = new ArtusApplication();
  await app.load();
  await app.run();
}

main().catch(console.error);
```

### Error Handling

- Webhook: Return JSON error with code and message
- ACP: Log errors, attempt recovery
- Bot: Graceful degradation, no crash

### Testing Strategy

**Test Types**:
- Unit tests: Plugins and services (mock dependencies)
- Integration tests: Module interactions
- E2E tests: Full flow (user → agent → webhook)

**Test Framework**: Jest or Vitest (as per project preference)

---

## Migration Checklist

### From telegram-acp to telegram-agent

**Core Features**:
- ✅ ACP agent communication (in ACP Plugin)
- ✅ Session management (in ACP Plugin)
- ✅ Streaming message handling (in ACP Plugin)
- ✅ Media download/upload (in BotService)
- ✅ Reaction system (in BotService)
- ✅ Command handling (/start, /restart) (in CommandHandler)
- ✅ History injection (in ACP Plugin)
- ✅ Permission auto-approval (in ACP Plugin)

**New Features**:
- ✅ Webhook API
- ✅ Skills integration
- ✅ Artusx plugin architecture (Telegram + ACP plugins)
- ✅ Better module organization

**Migration Steps**:
1. Create artusx application structure
2. Develop Telegram plugin
3. Develop ACP plugin (port session/acp logic)
4. Implement BotService and handlers
5. Implement Webhook controller
6. Setup Bridge orchestration
7. Create skills documentation
8. Test and validate
9. Update README

---

## Future Extensions

### Potential Enhancements

- Multiple agent presets support
- Inline keyboard support
- Group chat support
- MCP server mode (optional)
- Database storage (optional)
- Rate limiting
- Metrics/monitoring

---

## Open Questions

1. **Session Storage**: Keep file-based or migrate to database?
   - Recommendation: Keep file-based for simplicity

2. **Webhook Port**: Use same port (7001) or separate?
   - Recommendation: Same port, different path (/api/telegram)

3. **Skills Format**: Documentation-only or include test scripts?
   - Recommendation: Both (documentation + optional test scripts)

---

## Conclusion

This design leverages artusx's plugin architecture to create a clean, modular Telegram agent application with two core plugins (Telegram and ACP) that provide injectable APIs to business modules. The architecture separates concerns clearly (plugins → modules → bridge), making it easy to maintain and extend.

**Next Steps**:
1. Review and approve this specification
2. Create implementation plan
3. Begin development
