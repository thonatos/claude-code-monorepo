# Telegram Agent Session Persistence Design

## Overview

Add local file-based session storage to telegram-agent for state recovery after restart, referencing telegram-acp's FileStorage implementation.

## Scope

- Session metadata + message history persistence
- Session restoration on startup
- Command integration for history management

## Architecture

### File Structure

```
src/
├── types.ts                      # Extended: add storage types
└── module-bridge/
    ├── bridge.service.ts         # Modified: integrate SessionService
    └── session.service.ts        # NEW: session persistence logic
```

### Storage Path

```
~/.telegram-agent/sessions/<userId>/<sessionId>.json
```

### Types (types.ts)

```typescript
export type SessionStatus = 'active' | 'inactive' | 'terminated';

export interface StoredMessage {
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
}

export interface StoredSession {
  userId: string;
  sessionId: string;
  createdAt: number;
  lastActivity: number;
  status: SessionStatus;
  messages: StoredMessage[];
}
```

## Components

### SessionService

**Responsibility**: Session persistence and recovery.

**Public API**:

```typescript
@Injectable()
export class SessionService {
  // Save session to file
  save(session: StoredSession): Promise<void>;
  
  // Load specific session
  load(userId: string, sessionId: string): Promise<StoredSession | null>;
  
  // Find most recent restorable session (status !== 'terminated')
  loadRestorable(userId: string): Promise<StoredSession | null>;
  
  // List all sessions for user
  list(userId: string): Promise<StoredSession[]>;
  
  // Record message to current session
  recordMessage(userId: string, sessionId: string, message: StoredMessage): Promise<void>;
  
  // Update session status
  updateStatus(userId: string, sessionId: string, status: SessionStatus): Promise<void>;
  
  // Clear message history
  clearHistory(userId: string, sessionId: string): Promise<void>;
  
  // Cleanup on shutdown
  stop(): void;
}
```

**Implementation Details**:

- JSON file storage with atomic write (write to temp, then rename)
- Batch flush for message recording (optional optimization)
- History limits: maxMessages (default 100), maxDays (default 7)
- Auto-create storage directory on first write

### BridgeService Integration

**Modified Methods**:

1. `ensureConnection(userId)`:
   - Before creating new session, call `sessionService.loadRestorable(userId)`
   - If found, restore session with existing sessionId
   - History messages stored but NOT replayed to agent (agent maintains its own context)
   - If not found, create new session and save

2. `handleUserMessage(userId, message)`:
   - After sending prompt, call `sessionService.recordMessage(userId, sessionId, { role: 'user', content })`

3. Agent response handling (via ACPClient callbacks):
   - On message flush, call `sessionService.recordMessage(userId, sessionId, { role: 'agent', content })`

4. `closeUserSession(userId)`:
   - Call `sessionService.updateStatus(userId, sessionId, 'inactive')`

5. `close()` (shutdown):
   - Call `sessionService.stop()` for final flush

### Command Integration

**Modified Commands**:

| Command | Changes |
|---------|---------|
| `/start` | Check `loadRestorable()`, show restore status |
| `/status` | Add: createdAt, message count, storage path |
| `/restart` | `updateStatus('terminated')` + create new session |
| `/clear` | Add `clearHistory()` call |

**New Commands** (Phase 2 - optional, not in initial implementation):

| Command | Function |
|---------|----------|
| `/history` | Show recent message summary (last 10) |
| `/sessions` | List all stored sessions for user |

Initial implementation focuses on persistence + modified commands only.

## Data Flow

### Session Restoration Flow

```
User sends message /start
    ↓
BridgeService.ensureConnection(userId)
    ↓
SessionService.loadRestorable(userId)
    ↓ (found)
SessionService.load(userId, sessionId)
    ↓
BridgeService creates connection with existing sessionId
    ↓
Update status to 'active', continue conversation

Note: History messages are stored but not sent to agent on restore.
Agent maintains its own context independently.
```

### Message Recording Flow

```
User sends message
    ↓
BridgeService.handleUserMessage()
    ↓
ACPClient sends prompt to agent
    ↓
SessionService.recordMessage({ role: 'user', content })
    ↓
Agent responds
    ↓
ACPClient onMessageFlush callback
    ↓
SessionService.recordMessage({ role: 'agent', content })
```

## Configuration

Add to `config.default.ts`:

```typescript
session: {
  storageDir: '~/.telegram-agent/sessions',  // Resolved via os.homedir()
  maxConcurrentUsers: 10,
}

history: {
  maxMessages: 100,  // Limit stored messages
  maxDays: 7,        // Limit by age
}
```

## Error Handling

- File read/write errors: Log and continue (don't block user)
- Corrupted JSON: Log error, treat as no session
- Missing directory: Auto-create with recursive mkdir
- Concurrent writes: Use atomic rename pattern

## Testing

1. Manual test: Restart app, verify session restored
2. Manual test: `/restart` creates new session, old marked terminated
3. Manual test: `/clear` removes message history
4. Verify storage files in `~/.telegram-agent/sessions/`

## Migration Notes

This is a simplified reimplementation of telegram-acp's FileStorage:
- Removed batch flush optimization (can add later if needed)
- Removed process state tracking (agent process not persisted)
- Focused on message history + session metadata