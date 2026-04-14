# telegram-agent P0 Optimization Design

## Overview

Fix core issues identified in architecture analysis:
1. Session management - support multi-user concurrent access
2. User authentication - reject unauthorized users
3. Process management - graceful shutdown and lifecycle events

## Goals

- Enable multi-user session isolation
- Add user authentication before message processing
- Ensure safe process lifecycle (no zombie processes)
- Minimize changes to existing structure

## Non-Goals

- Complete dependency refactoring (P1)
- Type safety improvements (P1)
- Log system unification (P1)
- MediaHandler completion (P2)

---

## 1. Session Management

### Implementation

Add session tracking inside `BridgeService` (no new module):

```typescript
// BridgeService new properties
private sessions: Map<string, UserSession> = new Map();
private readonly MAX_CONCURRENT_USERS = 10;

// UserSession type
interface UserSession {
  sessionId: string;
  lastActivity: Date;
}

// New methods
async ensureUserSession(userId: string): Promise<UserSession>
async closeUserSession(userId: string): Promise<void>
```

### Behavior

- Each user gets independent session, no shared ACP connection
- Reject new users when exceeding MAX_CONCURRENT_USERS limit
- Session created on first message, reused on subsequent messages
- `lastActivity` updated on each message for future idle timeout feature

---

## 2. User Authentication

### Configuration Extension

```yaml
# ~/.telegram-agent/config.yaml
telegram:
  botToken: "..."

agent:
  preset: claude

# New auth section
auth:
  allowedUsers:
    - "123456"
    - "789012"
  open: false              # true = allow all users
```

### Auth Flow

```
User message → Check auth.open / auth.allowedUsers
              ↓
         open=true → Allow
              ↓
         open=false → Check userId ∈ allowedUsers
              ↓
         Auth pass → Create/reuse session
         Auth fail → Reject with "未授权用户"
```

### Implementation Location

Add auth check at beginning of `MessageHandler.handle()`:

```typescript
async handle(ctx: Context): Promise<void> {
  const userId = ctx.from?.id?.toString();

  // Auth check
  if (!this.authService.isAuthorized(userId)) {
    await ctx.reply("⛔ 未授权用户，请联系管理员");
    return;
  }

  // Normal flow...
}
```

### New AuthService

File: `src/module-auth/auth.service.ts`

```typescript
@Injectable()
export class AuthService {
  private allowedUsers: Set<string>;
  private open: boolean;

  isAuthorized(userId: string | undefined): boolean {
    if (this.open) return true;
    if (!userId) return false;
    return this.allowedUsers.has(userId);
  }
}
```

---

## 3. Process Management

### New AgentProcessManager

File: `src/module-bridge/agent-process-manager.ts`

Responsibilities:
- Process spawn and destroy
- Graceful shutdown (SIGTERM → 5s wait → SIGKILL)
- exit/spawn/error event listeners
- Process state tracking

### Interface

```typescript
@Injectable()
export class AgentProcessManager {
  private process: ChildProcess | null = null;
  private readonly SHUTDOWN_TIMEOUT_MS = 5000;

  // State
  get isRunning(): boolean;
  get pid(): number | null;

  // Lifecycle
  spawn(config: AgentConfig): ChildProcess;
  async gracefulShutdown(): Promise<void>;
  kill(): void;

  // Event callbacks (set by BridgeService)
  onExit(callback: (code: number, signal: string) => void): void;
  onError(callback: (err: Error) => void): void;
}
```

### gracefulShutdown Implementation

```typescript
async gracefulShutdown(): Promise<void> {
  if (!this.process || this.process.killed) return;

  // 1. Send SIGTERM
  this.process.kill('SIGTERM');

  // 2. Wait for exit (max 5s)
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      if (this.process && !this.process.killed) {
        this.logger.warn('[process] Force killing with SIGKILL');
        this.process.kill('SIGKILL');
      }
      resolve();
    }, this.SHUTDOWN_TIMEOUT_MS);

    this.process?.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });

  this.process = null;
}
```

### Event Listeners (registered on spawn)

```typescript
spawn(config: AgentConfig): ChildProcess {
  this.process = spawn(config.command, config.args, {
    cwd: config.cwd,
    stdio: ['pipe', 'pipe', 'inherit'],
  });

  // Listen to key events
  this.process.on('spawn', () => this.logger.info('[process] Agent spawned'));
  this.process.on('exit', (code, signal) => 
    this.exitCallbacks.forEach(cb => cb(code ?? 0, signal ?? 'unknown')));
  this.process.on('error', (err) => 
    this.errorCallbacks.forEach(cb => cb(err)));

  return this.process;
}
```

---

## 4. File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/types.ts` | Modify | Add `UserSession`, `AuthConfig` types |
| `src/config/config.default.ts` | Modify | Add auth config loading |
| `src/module-auth/auth.service.ts` | Create | User authentication service |
| `src/module-bridge/agent-process-manager.ts` | Create | Process lifecycle manager |
| `src/module-bridge/bridge.service.ts` | Modify | Add sessions Map, inject Auth + ProcessManager |
| `src/module-bot/message.handler.ts` | Modify | Add auth check before processing |

---

## 5. Dependency Graph

```
MessageHandler
  ├── AuthService (new)
  ├── BridgeService
  │     ├── AgentProcessManager (new)
  │     ├── BotService
  │     ├── MediaHandler
  │     └── ACPClient
```

---

## 6. Success Criteria

1. Multiple users can connect simultaneously (up to MAX_CONCURRENT_USERS)
2. Unauthorized users receive rejection message, no ACP session created
3. Agent process shuts down gracefully on app close, no zombie processes
4. Process exit/error events logged appropriately
5. Existing webhook API continues to work