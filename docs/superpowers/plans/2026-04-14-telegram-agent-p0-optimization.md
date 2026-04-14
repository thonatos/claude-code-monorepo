# telegram-agent P0 Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add session management, user authentication, and safe process lifecycle to telegram-agent.

**Architecture:** Minimal changes to existing structure - add AuthService for auth checks, AgentProcessManager for process lifecycle, and sessions Map inside BridgeService for multi-user support.

**Tech Stack:** TypeScript, ArtusX DI, grammy, ACP SDK

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types.ts` | Modify | Add `UserSession` type |
| `src/module-auth/auth.service.ts` | Create | User authentication (isAuthorized check) |
| `src/module-bridge/agent-process-manager.ts` | Create | Process spawn/destroy, graceful shutdown, events |
| `src/module-bridge/bridge.service.ts` | Modify | Inject Auth + ProcessManager, add sessions Map |
| `src/module-bot/message.handler.ts` | Modify | Add auth check before processing |

---

### Task 1: Add UserSession Type

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add UserSession interface**

```typescript
// Add to src/types.ts (after WebhookResponse)

export interface UserSession {
  sessionId: string;
  lastActivity: Date;
}
```

- [ ] **Step 2: Run typecheck to verify**

Run: `pnpm --filter telegram-agent run tsc`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/telegram-agent/src/types.ts
git commit -m "feat(telegram-agent): add UserSession type"
```

---

### Task 2: Create AuthService

**Files:**
- Create: `src/module-auth/auth.service.ts`

- [ ] **Step 1: Create AuthService file**

```typescript
// src/module-auth/auth.service.ts
import { ArtusInjectEnum, Inject, Injectable } from "@artusx/core";
import type { AppConfig } from "../types";

@Injectable()
export class AuthService {
  @Inject(ArtusInjectEnum.Config)
  private config!: AppConfig;

  /**
   * Check if user is authorized to use the bot.
   * Empty allowedUsers list = open mode (allow all)
   */
  isAuthorized(userId: string | undefined): boolean {
    const allowedUsers = this.config.allowedUsers ?? [];

    // Open mode: empty list allows all users
    if (allowedUsers.length === 0) return true;

    // No userId = not authorized
    if (!userId) return false;

    // Check if userId is in allowed list
    return allowedUsers.includes(userId);
  }
}
```

- [ ] **Step 2: Run typecheck to verify**

Run: `pnpm --filter telegram-agent run tsc`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/telegram-agent/src/module-auth/auth.service.ts
git commit -m "feat(telegram-agent): add AuthService for user authentication"
```

---

### Task 3: Create AgentProcessManager

**Files:**
- Create: `src/module-bridge/agent-process-manager.ts`

- [ ] **Step 1: Create AgentProcessManager file**

```typescript
// src/module-bridge/agent-process-manager.ts
import { type ChildProcess, spawn } from "node:child_process";
import { Injectable } from "@artusx/core";
import type { TelegramAgentConfig } from "../types";

@Injectable()
export class AgentProcessManager {
  private process: ChildProcess | null = null;
  private readonly SHUTDOWN_TIMEOUT_MS = 5000;

  private exitCallbacks: Array<(code: number, signal: string) => void> = [];
  private errorCallbacks: Array<(err: Error) => void> = [];

  /**
   * Check if process is currently running
   */
  get isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  /**
   * Get process PID
   */
  get pid(): number | null {
    return this.process?.pid ?? null;
  }

  /**
   * Spawn agent process
   */
  spawn(config: TelegramAgentConfig["agent"], logger?: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void }): ChildProcess {
    this.process = spawn(config.command, config.args, {
      cwd: config.cwd || process.cwd(),
      env: { ...process.env, ...config.env },
      stdio: ["pipe", "pipe", "inherit"],
    });

    // Listen to key events
    this.process.on("spawn", () => {
      logger?.info("[process] Agent spawned");
    });

    this.process.on("exit", (code, signal) => {
      logger?.info(`[process] Agent exited (code: ${code}, signal: ${signal})`);
      this.exitCallbacks.forEach((cb) => cb(code ?? 0, signal ?? "unknown"));
      this.process = null;
    });

    this.process.on("error", (err) => {
      logger?.error(`[process] Agent error: ${err.message}`);
      this.errorCallbacks.forEach((cb) => cb(err));
    });

    return this.process;
  }

  /**
   * Gracefully shutdown the process
   * SIGTERM -> wait 5s -> SIGKILL if still running
   */
  async gracefulShutdown(logger?: { warn: (msg: string) => void }): Promise<void> {
    if (!this.process || this.process.killed) return;

    // Send SIGTERM
    this.process.kill("SIGTERM");

    // Wait for exit (max 5s)
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (this.process && !this.process.killed) {
          logger?.warn("[process] Force killing with SIGKILL");
          this.process.kill("SIGKILL");
        }
        resolve();
      }, this.SHUTDOWN_TIMEOUT_MS);

      this.process?.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });

    this.process = null;
  }

  /**
   * Force kill the process immediately
   */
  kill(): void {
    if (this.process && !this.process.killed) {
      this.process.kill("SIGKILL");
      this.process = null;
    }
  }

  /**
   * Register callback for process exit
   */
  onExit(callback: (code: number, signal: string) => void): void {
    this.exitCallbacks.push(callback);
  }

  /**
   * Register callback for process error
   */
  onError(callback: (err: Error) => void): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * Get stdin stream (for writing to agent)
   */
  get stdin(): NodeJS.WritableStream | null {
    return this.process?.stdin ?? null;
  }

  /**
   * Get stdout stream (for reading from agent)
   */
  get stdout(): NodeJS.ReadableStream | null {
    return this.process?.stdout ?? null;
  }
}
```

- [ ] **Step 2: Run typecheck to verify**

Run: `pnpm --filter telegram-agent run tsc`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/telegram-agent/src/module-bridge/agent-process-manager.ts
git commit -m "feat(telegram-agent): add AgentProcessManager for safe process lifecycle"
```

---

### Task 4: Update BridgeService - Inject Dependencies

**Files:**
- Modify: `src/module-bridge/bridge.service.ts`

- [ ] **Step 1: Add imports and inject AuthService + AgentProcessManager**

Replace imports at top of file:

```typescript
// Replace imports in src/module-bridge/bridge.service.ts
import { type ChildProcess } from "node:child_process";
import { Readable, Writable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";
import { ArtusInjectEnum, Inject, Injectable } from "@artusx/core";
import type { ArtusApplication } from "@artusx/core";
import { BotService } from "../module-bot/bot.service";
import { MediaHandler } from "../module-bot/media.handler";
import { AuthService } from "../module-auth/auth.service";
import { AgentProcessManager } from "./agent-process-manager";
import { type ACPClient, InjectEnum as ACPInjectEnum } from "../plugins/acp";
import type { WebhookRequest, UserSession, AppConfig } from "../types";
```

- [ ] **Step 2: Add new injections and sessions Map**

Replace class properties section (lines 10-27):

```typescript
@Injectable()
export class BridgeService {
  @Inject(ArtusInjectEnum.Application)
  app!: ArtusApplication;

  @Inject(ArtusInjectEnum.Config)
  config!: AppConfig;

  @Inject(BotService)
  botService!: BotService;

  @Inject(MediaHandler)
  mediaHandler!: MediaHandler;

  @Inject(ACPInjectEnum.ACPClient)
  acpClient!: ACPClient;

  @Inject(AuthService)
  authService!: AuthService;

  @Inject(AgentProcessManager)
  processManager!: AgentProcessManager;

  // Session management
  private sessions: Map<string, UserSession> = new Map();
  private connections: Map<string, acp.ClientSideConnection> = new Map();
  private readonly MAX_CONCURRENT_USERS: number;

  constructor() {
    // Will be set from config after injection
    this.MAX_CONCURRENT_USERS = 10;
  }

  private get logger() {
    return {
      info: (msg: string) => console.log(msg),
      warn: (msg: string) => console.warn(msg),
      error: (msg: string) => console.error(msg),
    };
  }
}
```

- [ ] **Step 3: Run typecheck to verify**

Run: `pnpm --filter telegram-agent run tsc`
Expected: No errors

- [ ] **Step 4: Commit intermediate changes**

```bash
git add packages/telegram-agent/src/module-bridge/bridge.service.ts
git commit -m "feat(telegram-agent): inject AuthService and AgentProcessManager into BridgeService"
```

---

### Task 5: Update BridgeService - Add Session Methods

**Files:**
- Modify: `src/module-bridge/bridge.service.ts`

- [ ] **Step 1: Add session management methods**

Add after constructor (before ensureConnection):

```typescript
  /**
   * Ensure user session exists, create if needed
   */
  private async ensureUserSession(userId: string): Promise<UserSession> {
    const existing = this.sessions.get(userId);
    if (existing) {
      existing.lastActivity = new Date();
      return existing;
    }

    // Check concurrent limit
    const maxUsers = this.config.session?.maxConcurrentUsers ?? this.MAX_CONCURRENT_USERS;
    if (this.sessions.size >= maxUsers) {
      throw new Error(`Maximum concurrent users (${maxUsers}) reached`);
    }

    // Create new session
    const session: UserSession = {
      sessionId: `${userId}-${Date.now()}`,
      lastActivity: new Date(),
    };
    this.sessions.set(userId, session);
    this.logger.info(`[bridge] Created session for user ${userId}`);
    return session;
  }

  /**
   * Close user session and cleanup resources
   */
  async closeUserSession(userId: string): Promise<void> {
    const connection = this.connections.get(userId);
    if (connection) {
      // Session will be closed by ACP connection cleanup
      this.connections.delete(userId);
    }
    this.sessions.delete(userId);
    this.logger.info(`[bridge] Closed session for user ${userId}`);
  }
```

- [ ] **Step 2: Run typecheck to verify**

Run: `pnpm --filter telegram-agent run tsc`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/telegram-agent/src/module-bridge/bridge.service.ts
git commit -m "feat(telegram-agent): add session management methods to BridgeService"
```

---

### Task 6: Update BridgeService - Refactor ensureConnection

**Files:**
- Modify: `src/module-bridge/bridge.service.ts`

- [ ] **Step 1: Refactor ensureConnection to use ProcessManager**

Replace ensureConnection method (lines 29-105):

```typescript
  async ensureConnection(userId: string): Promise<void> {
    // Check for existing connection
    if (this.connections.has(userId)) return;

    const session = await this.ensureUserSession(userId);
    const agentConfig = this.config.agent;

    this.logger.info(`[bridge] Initializing connection for user ${userId}`);

    // Initialize client callbacks
    this.acpClient.init({
      sendMessage: async (text: string) => {
        return await this.botService.sendMessage(userId, text);
      },
      editMessage: async (msgId: number, text: string) => {
        await this.botService.editMessage(userId, msgId, text);
      },
      removeReaction: async (msgId: number) => {
        await this.botService.removeReaction(userId, msgId);
      },
      sendTyping: async () => {
        await this.botService.sendTyping(userId);
      },
      onMediaUpload: async (path: string, type: "image" | "audio") => {
        if (type === "image") {
          await this.mediaHandler.uploadPhoto(userId, path);
        } else {
          await this.mediaHandler.uploadAudio(userId, path);
        }
      },
      showThoughts: agentConfig.showThoughts,
    });

    // Spawn agent process using ProcessManager
    const agentProcess = this.processManager.spawn(agentConfig, this.logger);

    // Verify streams exist
    if (!agentProcess.stdin || !agentProcess.stdout) {
      throw new Error("Failed to create agent process streams");
    }

    // Create streams
    const input = Writable.toWeb(agentProcess.stdin);
    const output = Readable.toWeb(agentProcess.stdout);

    // Create the connection
    const stream = acp.ndJsonStream(input, output);
    const connection = new acp.ClientSideConnection((_agent) => this.acpClient, stream);

    // Initialize
    const initResult = await connection.initialize({
      protocolVersion: acp.PROTOCOL_VERSION,
      clientCapabilities: {
        fs: {
          readTextFile: true,
          writeTextFile: true,
        },
      },
    });

    this.logger.info(`[bridge] Connected to agent (protocol v${initResult.protocolVersion})`);

    // Create session
    const sessionResult = await connection.newSession({
      cwd: agentConfig.cwd || process.cwd(),
      mcpServers: [],
    });

    session.sessionId = sessionResult.sessionId;
    this.connections.set(userId, connection);
  }
```

- [ ] **Step 2: Run typecheck to verify**

Run: `pnpm --filter telegram-agent run tsc`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/telegram-agent/src/module-bridge/bridge.service.ts
git commit -m "refactor(telegram-agent): use AgentProcessManager in BridgeService"
```

---

### Task 7: Update BridgeService - Refactor close Method

**Files:**
- Modify: `src/module-bridge/bridge.service.ts`

- [ ] **Step 1: Refactor close method to use graceful shutdown**

Replace close method (lines 166-175):

```typescript
  async close(): Promise<void> {
    this.logger.info("[bridge] Closing all connections...");

    // Close all user sessions
    for (const userId of this.sessions.keys()) {
      await this.closeUserSession(userId);
    }

    // Graceful shutdown of agent process
    await this.processManager.gracefulShutdown(this.logger);

    this.sessions.clear();
    this.connections.clear();
    this.acpClient.reset();

    this.logger.info("[bridge] All connections closed");
  }
```

- [ ] **Step 2: Run typecheck to verify**

Run: `pnpm --filter telegram-agent run tsc`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/telegram-agent/src/module-bridge/bridge.service.ts
git commit -m "refactor(telegram-agent): use graceful shutdown in BridgeService.close()"
```

---

### Task 8: Update MessageHandler - Add Auth Check

**Files:**
- Modify: `src/module-bot/message.handler.ts`

- [ ] **Step 1: Add AuthService injection and auth check**

Replace entire file:

```typescript
// src/module-bot/message.handler.ts
import { Inject, Injectable, ScopeEnum } from "@artusx/core";
import type { Context } from "grammy";
import { AuthService } from "../module-auth/auth.service";
import { BridgeService } from "../module-bridge/bridge.service";
import { BotService } from "./bot.service";

@Injectable({
  scope: ScopeEnum.TRANSIENT,
})
export class MessageHandler {
  @Inject(AuthService)
  authService!: AuthService;

  @Inject(BotService)
  botService!: BotService;

  @Inject(BridgeService)
  bridgeService!: BridgeService;

  async handle(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    // Auth check
    if (!this.authService.isAuthorized(userId)) {
      await ctx.reply("⛔ 未授权用户，请联系管理员");
      return;
    }

    const message = ctx.message;
    if (!message) return;

    await this.botService.sendReaction(userId, message.message_id);
    await this.bridgeService.handleUserMessage(userId, message);
  }
}
```

- [ ] **Step 2: Run typecheck to verify**

Run: `pnpm --filter telegram-agent run tsc`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/telegram-agent/src/module-bot/message.handler.ts
git commit -m "feat(telegram-agent): add auth check in MessageHandler"
```

---

### Task 9: Final Verification and Build

- [ ] **Step 1: Run lint check**

Run: `pnpm --filter telegram-agent run lint`
Expected: No errors (warnings acceptable for `any` types in existing code)

- [ ] **Step 2: Run full build**

Run: `pnpm --filter telegram-agent run build`
Expected: Successful compilation

- [ ] **Step 3: Push all changes**

```bash
git push origin main
```

---

## Success Criteria Verification

1. ✅ Multiple users can connect (sessions Map + maxConcurrentUsers limit)
2. ✅ Unauthorized users rejected with message (AuthService.isAuthorized check)
3. ✅ Graceful process shutdown (AgentProcessManager.gracefulShutdown)
4. ✅ Process events logged (spawn/exit/error callbacks)
5. ✅ Webhook API unchanged (handleWebhookRequest untouched)