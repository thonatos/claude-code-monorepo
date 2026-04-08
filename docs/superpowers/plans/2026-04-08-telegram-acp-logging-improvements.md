# Telegram-ACP Logging Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Telegram messaging and CLI logging to show tool details and thoughts with configurable verbosity.

**Architecture:** Replace multiple tool messages with single streaming summary in Telegram; add detailed CLI logging with thought content and tool information filtered by log level.

**Tech Stack:** TypeScript, ACP SDK, grammy Telegram framework

---

## File Structure

### New Files
- `packages/telegram-acp/src/streaming/tool-tracker.ts` - ToolCallTracker class for managing active tool list
- `packages/telegram-acp/src/utils/logger.ts` - Logger utilities with level filtering and truncation

### Modified Files
- `packages/telegram-acp/src/streaming/state.ts` - Replace toolStreams map with single toolSummaryStream
- `packages/telegram-acp/src/client.ts` - Enhanced logging and tool summary updates
- `packages/telegram-acp/src/config.ts` - Add logging configuration options
- `packages/telegram-acp/src/streaming/types.ts` - Add ToolCallInfo interface

### Test Files
- `packages/telegram-acp/test/streaming/tool-tracker.test.ts` - Unit tests for ToolCallTracker
- `packages/telegram-acp/test/utils/logger.test.ts` - Unit tests for logger utilities

---

## Task 1: Create Logger Utilities

**Files:**
- Create: `packages/telegram-acp/src/utils/logger.ts`
- Create: `packages/telegram-acp/test/utils/logger.test.ts`

- [ ] **Step 1: Write failing test for truncate function**

```typescript
import { describe, it, expect } from 'vitest';
import { truncate } from '../src/utils/logger.ts';

describe('truncate', () => {
  it('should truncate long strings with ellipsis', () => {
    const longText = 'This is a very long string that exceeds the limit';
    const result = truncate(longText, 20);
    expect(result).toBe('This is a very lo...');
  });

  it('should not truncate short strings', () => {
    const shortText = 'Short text';
    const result = truncate(shortText, 20);
    expect(result).toBe('Short text');
  });

  it('should handle empty strings', () => {
    const result = truncate('', 20);
    expect(result).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/utils/logger.test.ts`
Expected: FAIL with "Cannot find module '../src/utils/logger.ts'"

- [ ] **Step 3: Write minimal logger implementation**

```typescript
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export function formatToolParams(params: Record<string, any>): string {
  return JSON.stringify(params, null, 2);
}

export function shouldLog(level: LogLevel, threshold: LogLevel): boolean {
  const levels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
  return levels.indexOf(level) <= levels.indexOf(threshold);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/utils/logger.test.ts`
Expected: PASS

- [ ] **Step 5: Add tests for shouldLog function**

```typescript
import { describe, it, expect } from 'vitest';
import { truncate, shouldLog } from '../src/utils/logger.ts';

describe('shouldLog', () => {
  it('should allow debug when threshold is debug', () => {
    expect(shouldLog('debug', 'debug')).toBe(true);
  });

  it('should block debug when threshold is info', () => {
    expect(shouldLog('debug', 'info')).toBe(false);
  });

  it('should allow info when threshold is info', () => {
    expect(shouldLog('info', 'info')).toBe(true);
  });

  it('should block info when threshold is warn', () => {
    expect(shouldLog('info', 'warn')).toBe(false);
  });

  it('should allow error at all thresholds', () => {
    expect(shouldLog('error', 'info')).toBe(true);
    expect(shouldLog('error', 'warn')).toBe(true);
    expect(shouldLog('error', 'error')).toBe(true);
  });
});
```

- [ ] **Step 6: Run all logger tests**

Run: `npm test -- test/utils/logger.test.ts`
Expected: PASS

- [ ] **Step 7: Commit logger utilities**

```bash
git add packages/telegram-acp/src/utils/logger.ts packages/telegram-acp/test/utils/logger.test.ts
git commit -m "feat(telegram-acp): add logger utilities with truncation and level filtering"
```

---

## Task 2: Create ToolCallTracker Class

**Files:**
- Create: `packages/telegram-acp/src/streaming/types.ts` (update with ToolCallInfo)
- Create: `packages/telegram-acp/src/streaming/tool-tracker.ts`
- Create: `packages/telegram-acp/test/streaming/tool-tracker.test.ts`

- [ ] **Step 1: Update streaming types with ToolCallInfo interface**

Add to `packages/telegram-acp/src/streaming/types.ts`:

```typescript
export interface ToolCallInfo {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  params?: Record<string, any>;
  result?: string;
  timestamp: number;
}

export interface ToolTrackerConfig {
  maxTools: number;
}
```

- [ ] **Step 2: Write failing test for ToolCallTracker**

Create `packages/telegram-acp/test/streaming/tool-tracker.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ToolCallTracker } from '../src/streaming/tool-tracker.ts';
import type { ToolCallInfo } from '../src/streaming/types.ts';

describe('ToolCallTracker', () => {
  it('should add tool and track it', () => {
    const tracker = new ToolCallTracker({ maxTools: 10 });
    const tool: ToolCallInfo = {
      id: 'tool-1',
      title: 'ReadFile',
      status: 'running',
      params: { path: '/src/file.ts' },
      timestamp: Date.now(),
    };
    
    tracker.addOrUpdate(tool);
    expect(tracker.getActiveCount()).toBe(1);
  });

  it('should update existing tool', () => {
    const tracker = new ToolCallTracker({ maxTools: 10 });
    const tool: ToolCallInfo = {
      id: 'tool-1',
      title: 'ReadFile',
      status: 'running',
      timestamp: Date.now(),
    };
    
    tracker.addOrUpdate(tool);
    tracker.addOrUpdate({ ...tool, status: 'completed' });
    
    const formatted = tracker.formatForTelegram();
    expect(formatted).toContain('✅');
    expect(formatted).toContain('ReadFile');
  });

  it('should limit tool count', () => {
    const tracker = new ToolCallTracker({ maxTools: 3 });
    
    for (let i = 0; i < 5; i++) {
      tracker.addOrUpdate({
        id: `tool-${i}`,
        title: `Tool${i}`,
        status: 'running',
        timestamp: Date.now(),
      });
    }
    
    expect(tracker.getActiveCount()).toBe(3);
  });

  it('should format tools for Telegram', () => {
    const tracker = new ToolCallTracker({ maxTools: 10 });
    
    tracker.addOrUpdate({
      id: 'tool-1',
      title: 'ReadFile',
      status: 'running',
      params: { path: '/src/file.ts' },
      timestamp: Date.now(),
    });
    
    tracker.addOrUpdate({
      id: 'tool-2',
      title: 'WriteFile',
      status: 'completed',
      timestamp: Date.now(),
    });
    
    const formatted = tracker.formatForTelegram();
    expect(formatted).toContain('⏳ ReadFile');
    expect(formatted).toContain('✅ WriteFile');
    expect(formatted).toContain('/src/file.ts');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- test/streaming/tool-tracker.test.ts`
Expected: FAIL with "Cannot find module '../src/streaming/tool-tracker.ts'"

- [ ] **Step 4: Write ToolCallTracker implementation**

Create `packages/telegram-acp/src/streaming/tool-tracker.ts`:

```typescript
import type { ToolCallInfo, ToolTrackerConfig } from './types.ts';

const DEFAULT_MAX_TOOLS = 10;

export class ToolCallTracker {
  private tools: Map<string, ToolCallInfo> = new Map();
  private maxTools: number;

  constructor(config?: ToolTrackerConfig) {
    this.maxTools = config?.maxTools ?? DEFAULT_MAX_TOOLS;
  }

  addOrUpdate(info: ToolCallInfo): void {
    this.tools.set(info.id, info);
    
    // Evict oldest if over limit
    if (this.tools.size > this.maxTools) {
      const entries = Array.from(this.tools.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, this.tools.size - this.maxTools);
      for (const [id] of toRemove) {
        this.tools.delete(id);
      }
    }
  }

  formatForTelegram(): string {
    if (this.tools.size === 0) return '';
    
    const lines: string[] = [`🔧 Active Tools (${this.tools.size})`, ''];
    
    const entries = Array.from(this.tools.values());
    entries.sort((a, b) => b.timestamp - a.timestamp); // Most recent first
    
    for (const tool of entries) {
      const icon = this.getStatusIcon(tool.status);
      const params = this.formatParams(tool.params);
      const line = `${icon} ${tool.title}${params}`;
      lines.push(line);
    }
    
    return lines.join('\n');
  }

  getActiveCount(): number {
    return this.tools.size;
  }

  clear(): void {
    this.tools.clear();
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'running': return '⏳';
      case 'completed': return '✅';
      case 'error': return '❌';
      default: return '⏳';
    }
  }

  private formatParams(params?: Record<string, any>): string {
    if (!params) return '';
    
    const keys = Object.keys(params);
    if (keys.length === 0) return '';
    
    // Show first param only for compact display
    const firstKey = keys[0];
    const value = params[firstKey];
    
    if (typeof value === 'string') {
      const truncated = value.length > 50 ? value.substring(0, 47) + '...' : value;
      return `: ${truncated}`;
    }
    
    return `: ${JSON.stringify(value)}`;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- test/streaming/tool-tracker.test.ts`
Expected: PASS

- [ ] **Step 6: Commit ToolCallTracker**

```bash
git add packages/telegram-acp/src/streaming/types.ts packages/telegram-acp/src/streaming/tool-tracker.ts packages/telegram-acp/test/streaming/tool-tracker.test.ts
git commit -m "feat(telegram-acp): add ToolCallTracker for managing tool summary"
```

---

## Task 3: Update Configuration

**Files:**
- Modify: `packages/telegram-acp/src/config.ts`

- [ ] **Step 1: Add logging configuration to TelegramAcpConfig**

In `packages/telegram-acp/src/config.ts`, add to the config interface:

```typescript
export interface TelegramAcpConfig {
  telegram: {
    botToken: string;
  };
  agent: AgentConfig;
  session?: SessionConfig;
  history?: HistoryConfig;
  proxy?: string;
  allowedUsers?: string[];
  open?: boolean;
  reaction?: ReactionConfig;
  log?: (msg: string) => void;
  // Add new logging config
  logging?: {
    level?: 'error' | 'warn' | 'info' | 'debug';
    maxToolHistory?: number;
  };
}

export const DEFAULT_LOGGING_CONFIG = {
  level: 'info' as LogLevel,
  maxToolHistory: 10,
};
```

- [ ] **Step 2: Update loadConfig to read environment variables**

In the `loadConfig` function, add:

```typescript
export function loadConfig(configFile?: string, preset?: string): TelegramAcpConfig {
  // ... existing code
  
  // Add environment variable overrides
  const envLogLevel = process.env.TELEGRAM_ACP_LOG_LEVEL as LogLevel;
  const envMaxTools = process.env.TELEGRAM_ACP_MAX_TOOLS;
  
  config.logging = {
    level: envLogLevel || config.logging?.level || DEFAULT_LOGGING_CONFIG.level,
    maxToolHistory: envMaxTools ? parseInt(envMaxTools, 10) : config.logging?.maxToolHistory || DEFAULT_LOGGING_CONFIG.maxToolHistory,
  };
  
  return config;
}
```

- [ ] **Step 3: Verify config compiles**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 4: Commit configuration changes**

```bash
git add packages/telegram-acp/src/config.ts
git commit -m "feat(telegram-acp): add logging configuration with env var support"
```

---

## Task 4: Update StreamingMessageState

**Files:**
- Modify: `packages/telegram-acp/src/streaming/state.ts`

- [ ] **Step 1: Import ToolCallTracker in state.ts**

Add import at top of `packages/telegram-acp/src/streaming/state.ts`:

```typescript
import { ToolCallTracker } from './tool-tracker.ts';
import type { ToolCallInfo } from './types.ts';
```

- [ ] **Step 2: Replace toolStreams with toolTracker and single stream**

In the `StreamingMessageState` class, replace:

```typescript
// Old:
private toolStreams: Map<string, MessageStream> = new Map();

// New:
private toolTracker: ToolCallTracker;
private toolSummaryStream: MessageStream | null = null;
```

Update constructor:

```typescript
constructor(
  private readonly callbacks: MessageCallbacks,
  private readonly config: StreamingConfig = DEFAULT_STREAMING_CONFIG,
  private readonly maxToolHistory: number = 10
) {
  this.thoughtStream = new MessageStream('thought', callbacks, config, formatThought);
  this.textStream = new MessageStream('text', callbacks, config, markdownToHtml);
  this.toolTracker = new ToolCallTracker({ maxTools: this.maxToolHistory });
}
```

- [ ] **Step 3: Replace updateToolCall with updateToolSummary**

Replace the old `updateToolCall` and `editToolCall` methods:

```typescript
async updateToolSummary(toolInfo: ToolCallInfo): Promise<void> {
  if (this.thoughtStream.hasContent()) {
    await this.finalizeThought();
  }

  this.toolTracker.addOrUpdate(toolInfo);
  
  const formatted = this.toolTracker.formatForTelegram();
  
  if (!this.toolSummaryStream) {
    this.toolSummaryStream = new MessageStream(
      'tool',
      this.callbacks,
      this.config,
      () => formatted
    );
    const msgId = await this.callbacks.sendMessage(formatted, 'HTML');
    this.toolSummaryStream.setMessageId(msgId);
  } else {
    await this.callbacks.editMessage(
      this.toolSummaryStream.getMessageId()!,
      formatted,
      'HTML'
    );
  }
  
  await this.maybeSendTyping();
}
```

- [ ] **Step 4: Update reset method**

```typescript
reset(): void {
  this.thoughtStream.reset();
  this.textStream.reset();
  this.toolTracker.clear();
  this.toolSummaryStream = null;
}
```

- [ ] **Step 5: Remove finalizeAll tool stream handling**

The `finalizeAll` method should not finalize tool streams (they update in real-time):

```typescript
async finalizeAll(): Promise<string> {
  await this.finalizeThought();
  
  // Tool summary stays visible, don't finalize
  // Just clear the tracker for next session
  this.toolTracker.clear();
  this.toolSummaryStream = null;
  
  return await this.finalizeText();
}
```

- [ ] **Step 6: Verify state compiles**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 7: Commit state changes**

```bash
git add packages/telegram-acp/src/streaming/state.ts
git commit -m "feat(telegram-acp): replace multiple tool streams with single summary"
```

---

## Task 5: Update TelegramAcpClient Logging

**Files:**
- Modify: `packages/telegram-acp/src/client.ts`

- [ ] **Step 1: Import logger utilities**

Add at top of `packages/telegram-acp/src/client.ts`:

```typescript
import { truncate, shouldLog, type LogLevel } from './utils/logger.ts';
import type { ToolCallInfo } from './streaming/types.ts';
```

- [ ] **Step 2: Add logLevel property to client**

Update constructor and options:

```typescript
export interface TelegramAcpClientOpts {
  sendTyping?: () => Promise<void>;
  onThoughtFlush: (text: string) => Promise<void>;
  log: (msg: string) => void;
  showThoughts: boolean;
  sendMessage: (text: string, parseMode?: 'HTML') => Promise<number>;
  editMessage: (msgId: number, text: string, parseMode?: 'HTML') => Promise<number>;
  logLevel?: LogLevel;
}

export class TelegramAcpClient implements acp.Client {
  private opts: TelegramAcpClientOpts;
  private streamingState: StreamingMessageState;
  private chunks: string[] = [];
  private logLevel: LogLevel;

  constructor(opts: TelegramAcpClientOpts) {
    this.opts = opts;
    this.logLevel = opts.logLevel || 'info';
    // ... rest of constructor
  }
```

- [ ] **Step 3: Enhance handleThoughtChunk with logging**

```typescript
private async handleThoughtChunk(update: any): Promise<void> {
  if (update.content.type === "text") {
    const thought = update.content.text;
    
    // Always log thoughts to CLI (default info level)
    if (shouldLog('info', this.logLevel)) {
      this.opts.log(`[thought] ${truncate(thought, 100)}...`);
    }
    
    // Telegram thoughts only if showThoughts enabled
    if (this.opts.showThoughts) {
      await this.streamingState.appendThought(thought);
    }
  }
}
```

- [ ] **Step 4: Enhance handleToolCall with logging**

```typescript
private async handleToolCall(update: any): Promise<void> {
  const toolInfo: ToolCallInfo = {
    id: update.toolCallId,
    title: update.title,
    status: update.status || 'running',
    params: this.extractToolParams(update),
    timestamp: Date.now(),
  };
  
  // CLI logging
  if (shouldLog('info', this.logLevel)) {
    this.opts.log(`[tool] ${update.title} (${update.status || 'running'})`);
  }
  
  if (shouldLog('debug', this.logLevel) && toolInfo.params) {
    this.opts.log(`  params: ${JSON.stringify(toolInfo.params, null, 2)}`);
  }
  
  // Update Telegram summary
  await this.streamingState.updateToolSummary(toolInfo);
}
```

- [ ] **Step 5: Enhance handleToolCallUpdate with logging**

```typescript
private async handleToolCallUpdate(update: any): Promise<void> {
  const toolInfo: ToolCallInfo = {
    id: update.toolCallId,
    title: update.title || 'Tool',
    status: update.status || 'completed',
    result: this.extractToolResult(update.content),
    timestamp: Date.now(),
  };
  
  // CLI logging
  if (shouldLog('info', this.logLevel)) {
    this.opts.log(`[tool] ${toolInfo.title} → ${toolInfo.status}`);
  }
  
  if (shouldLog('info', this.logLevel) && toolInfo.result) {
    const preview = shouldLog('debug', this.logLevel) 
      ? toolInfo.result 
      : truncate(toolInfo.result, 200);
    this.opts.log(`  result: ${preview}`);
  }
  
  // Update Telegram summary
  await this.streamingState.updateToolSummary(toolInfo);
}
```

- [ ] **Step 6: Add helper methods for extracting tool data**

```typescript
private extractToolParams(update: any): Record<string, any> | undefined {
  // Extract relevant params based on tool type
  if (update.input) {
    // Show path for file operations, command for terminal
    if (update.title === 'ReadFile' || update.title === 'WriteFile') {
      return { path: update.input.path };
    }
    if (update.title === 'Terminal') {
      return { command: update.input.command };
    }
    return update.input;
  }
  return undefined;
}

private extractToolResult(content: any[] | null): string | undefined {
  if (!content) return undefined;
  
  for (const c of content) {
    if (c.type === 'text') {
      return c.text;
    }
  }
  
  return undefined;
}
```

- [ ] **Step 7: Verify client compiles**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 8: Commit client logging changes**

```bash
git add packages/telegram-acp/src/client.ts
git commit -m "feat(telegram-acp): add detailed CLI logging for thoughts and tools"
```

---

## Task 6: Pass Configuration Through

**Files:**
- Modify: `packages/telegram-acp/src/bridge.ts`
- Modify: `packages/telegram-acp/src/session/index.ts` (or relevant session file)

- [ ] **Step 1: Update bridge to pass logLevel and maxToolHistory**

In `packages/telegram-acp/src/bridge.ts`, update the session manager creation:

```typescript
async start(): Promise<void> {
  this.log("[telegram-acp] Starting...");

  // Get logging config
  const logLevel = this.config.logging?.level || 'info';
  const maxToolHistory = this.config.logging?.maxToolHistory || 10;

  this.sessionManager = new SessionManager({
    // ... existing options
    logLevel,
    maxToolHistory,
    // ... rest
  });
```

- [ ] **Step 2: Update SessionManager to accept new options**

In the session manager file, update the options interface and pass to client:

```typescript
interface SessionManagerOpts {
  // ... existing fields
  logLevel?: LogLevel;
  maxToolHistory?: number;
}

// When creating TelegramAcpClient:
const client = new TelegramAcpClient({
  // ... existing options
  logLevel: opts.logLevel,
});
```

- [ ] **Step 3: Update StreamingMessageState instantiation**

Pass `maxToolHistory` when creating `StreamingMessageState`:

```typescript
this.streamingState = new StreamingMessageState(
  callbacks,
  DEFAULT_STREAMING_CONFIG,
  opts.maxToolHistory || 10
);
```

- [ ] **Step 4: Verify full chain compiles**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 5: Commit configuration passing**

```bash
git add packages/telegram-acp/src/bridge.ts packages/telegram-acp/src/session/index.ts
git commit -m "feat(telegram-acp): pass logging config through session chain"
```

---

## Task 7: Update Tests for New Behavior

**Files:**
- Modify: `packages/telegram-acp/test/streaming/state.test.ts`
- Modify: `packages/telegram-acp/test/client.test.ts`

- [ ] **Step 1: Update state.test.ts for tool summary**

Replace tests that check multiple tool streams:

```typescript
describe('StreamingMessageState tool summary', () => {
  it('should update single tool summary message', async () => {
    const callbacks = createMockCallbacks();
    const state = new StreamingMessageState(callbacks, DEFAULT_STREAMING_CONFIG, 10);
    
    await state.updateToolSummary({
      id: 'tool-1',
      title: 'ReadFile',
      status: 'running',
      timestamp: Date.now(),
    });
    
    expect(callbacks.sendMessage).toHaveBeenCalledTimes(1);
    expect(callbacks.sendMessage).toHaveBeenCalledWith(
      expect.stringContaining('ReadFile'),
      'HTML'
    );
  });

  it('should edit existing summary for subsequent tools', async () => {
    const callbacks = createMockCallbacks();
    callbacks.sendMessage.mockResolvedValue(123);
    const state = new StreamingMessageState(callbacks, DEFAULT_STREAMING_CONFIG, 10);
    
    await state.updateToolSummary({
      id: 'tool-1',
      title: 'ReadFile',
      status: 'running',
      timestamp: Date.now(),
    });
    
    await state.updateToolSummary({
      id: 'tool-2',
      title: 'WriteFile',
      status: 'completed',
      timestamp: Date.now(),
    });
    
    expect(callbacks.sendMessage).toHaveBeenCalledTimes(1);
    expect(callbacks.editMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('WriteFile'),
      'HTML'
    );
  });
});
```

- [ ] **Step 2: Update client.test.ts for logging**

Add tests for new logging behavior:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { TelegramAcpClient } from '../src/client.ts';

describe('TelegramAcpClient logging', () => {
  it('should log thoughts at info level', async () => {
    const log = vi.fn();
    const client = new TelegramAcpClient({
      log,
      logLevel: 'info',
      // ... other required options
    });
    
    await client.sessionUpdate({
      update: {
        sessionUpdate: 'agent_thought_chunk',
        content: { type: 'text', text: 'Analyzing the code structure' },
      },
    });
    
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('[thought]')
    );
  });

  it('should not log thoughts at warn level', async () => {
    const log = vi.fn();
    const client = new TelegramAcpClient({
      log,
      logLevel: 'warn',
      // ... other options
    });
    
    await client.sessionUpdate({
      update: {
        sessionUpdate: 'agent_thought_chunk',
        content: { type: 'text', text: 'Analyzing' },
      },
    });
    
    expect(log).not.toHaveBeenCalled();
  });

  it('should log tool params at debug level', async () => {
    const log = vi.fn();
    const client = new TelegramAcpClient({
      log,
      logLevel: 'debug',
      // ... other options
    });
    
    await client.sessionUpdate({
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: 'tool-1',
        title: 'ReadFile',
        status: 'running',
        input: { path: '/src/file.ts' },
      },
    });
    
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('params')
    );
  });
});
```

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Commit test updates**

```bash
git add packages/telegram-acp/test/streaming/state.test.ts packages/telegram-acp/test/client.test.ts
git commit -m "test(telegram-acp): update tests for tool summary and logging"
```

---

## Task 8: Build and Final Verification

- [ ] **Step 1: Build the project**

Run: `npm run build`
Expected: Successful build with no errors

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Manual smoke test (optional)**

Run the CLI with verbose logging:
```bash
TELEGRAM_ACP_LOG_LEVEL=debug npm start
```

Expected: See detailed logs including thoughts, tool params, and results

- [ ] **Step 4: Final commit**

```bash
git add packages/telegram-acp/dist/
git commit -m "build(telegram-acp): rebuild with logging improvements"
```

---

## Self-Review Checklist

After writing plan, verify:

**1. Spec Coverage:**
- ✅ Single consolidated tool message in Telegram → Task 4
- ✅ CLI logs show thought content → Task 5
- ✅ CLI logs show tool names (not IDs) → Task 5
- ✅ Default mode shows truncated params/results → Task 5
- ✅ Debug mode shows full details → Task 5
- ✅ Configurable via env vars → Task 3
- ✅ All tests pass → Task 8

**2. Placeholder Scan:**
- No TBD/TODO found
- No "implement later" phrases
- No "similar to Task N" shortcuts
- All code steps include actual code

**3. Type Consistency:**
- `ToolCallInfo` interface defined in Task 2, used consistently in Tasks 4-5
- `LogLevel` type defined in Task 1, used consistently
- Method names: `updateToolSummary` used consistently (not `updateToolCall`)

