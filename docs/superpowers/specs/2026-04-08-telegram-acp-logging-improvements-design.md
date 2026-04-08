# Telegram-ACP Logging and Messaging Improvements

## Overview

Improve the logging and messaging system in telegram-acp to provide:
1. Consolidated, streaming tool call updates in Telegram (single message with edits)
2. Detailed CLI logs with thought content and full tool information

## Problem Statement

### Current Issues

**Issue 1: Telegram Message Spam**
- Every tool call creates a separate message
- Users see many "✅ 🔧 Tool" messages without context
- Example: `[15:20:49] [1344500783] [tool] toolu_tool-a981e7a7... → completed`
- No visibility into what the tool is actually doing

**Issue 2: CLI Logs Lack Detail**
- Log shows only tool IDs, not names or parameters
- No visibility into agent thoughts
- Example: `[tool] toolu_tool-a981e7a7... → completed`
- Cannot debug or understand agent behavior

## Design Goals

1. **Reduce Telegram noise**: Consolidate tool updates into a single streaming message
2. **Improve CLI observability**: Show complete information for debugging
3. **Maintain backward compatibility**: Optional feature flags for gradual rollout
4. **Performance**: Efficient message updates with rate limiting

## Architecture

### Component Changes

#### 1. ToolCallTracker (New)

**File**: `src/streaming/tool-tracker.ts`

**Purpose**: Manage active tool calls with size limits and formatting

**Interface**:
```typescript
interface ToolCallInfo {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  params?: Record<string, any>;
  result?: string;
  timestamp: number;
}

class ToolCallTracker {
  private tools: Map<string, ToolCallInfo> = new Map();
  private maxTools: number;

  addOrUpdate(info: ToolCallInfo): void;
  formatForTelegram(): string;
  getActiveCount(): number;
  clear(): void;
}
```

**Behavior**:
- Keep maximum 10 most recent tools (configurable)
- FIFO eviction when limit exceeded
- Format as compact list for Telegram

#### 2. StreamingMessageState (Modified)

**File**: `src/streaming/state.ts`

**Changes**:
- Replace `toolStreams: Map<string, MessageStream>` with single `toolSummaryStream: MessageStream`
- Add `ToolCallTracker` instance
- Modify `updateToolCall()` to update tracker and single message
- Remove `editToolCall()`, merge functionality into `updateToolCall()`

**New Flow**:
```
Tool call event
  → ToolCallTracker.addOrUpdate()
  → Format summary
  → Update single message (editOrCreate)
```

#### 3. TelegramAcpClient (Modified)

**File**: `src/client.ts`

**Changes to handleToolCall()**:
```typescript
private async handleToolCall(update: any): Promise<void> {
  const toolInfo = {
    id: update.toolCallId,
    title: update.title,
    status: update.status || 'running',
    params: extractParams(update),
  };
  
  // Log to CLI with details (default behavior)
  this.opts.log(`[tool] ${update.title} (${update.status})`);
  if (this.logLevel === 'debug') {
    this.opts.log(`  params: ${JSON.stringify(toolInfo.params, null, 2)}`);
  }
  
  // Update Telegram with summary
  await this.streamingState.updateToolSummary(toolInfo);
}
```

**Changes to handleToolCallUpdate()**:
```typescript
private async handleToolCallUpdate(update: any): Promise<void> {
  const toolInfo = {
    id: update.toolCallId,
    title: update.title,
    status: update.status || 'completed',
    result: extractResult(update.content),
  };
  
  // CLI logging (default shows truncated results)
  this.opts.log(`[tool] ${update.title} → ${update.status}`);
  if (toolInfo.result) {
    const preview = this.logLevel === 'debug' 
      ? toolInfo.result 
      : truncate(toolInfo.result, 200);
    this.opts.log(`  result: ${preview}`);
  }
  
  // Telegram update
  await this.streamingState.updateToolSummary(toolInfo);
}
```

**New: handleThoughtChunk() enhancements**:
```typescript
private async handleThoughtChunk(update: any): Promise<void> {
  if (update.content.type === "text") {
    const thought = update.content.text;
    
    // Always log thoughts to CLI (default behavior)
    this.opts.log(`[thought] ${truncate(thought, 100)}...`);
    
    if (this.opts.showThoughts) {
      await this.streamingState.appendThought(thought);
    }
  }
}
```

#### 4. Configuration (Modified)

**File**: `src/config.ts`

**Add new options**:
```typescript
interface TelegramAcpConfig {
  // ... existing fields
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';  // CLI log verbosity (default: info)
    maxToolHistory: number; // Max tools to show in Telegram summary (default: 10)
  };
}
```

**Environment variables**:
- `TELEGRAM_ACP_LOG_LEVEL=info|debug|warn|error` → Control CLI log verbosity (default: info)
- `TELEGRAM_ACP_MAX_TOOLS=15` → Adjust tool history limit

**Log Level Behavior**:
- `error`: Only errors
- `warn`: Errors + warnings
- `info` (default): Thoughts + tool names + truncated results (200 chars)
- `debug`: Full details including complete params and results

### Message Format

#### Telegram Tool Summary

```
🔧 Active Tools (3)

⏳ ReadFile: /src/client.ts
✅ WriteFile: /src/utils.ts
⏳ Terminal: npm test
```

**Icon meanings**:
- ⏳ Running
- ✅ Completed
- ❌ Error

#### CLI Log Format

**Default (info level)**:
```
[15:20:49] [thought] Analyzing the request...
[15:20:50] [thought] Need to check the config file
[15:20:51] [tool] ReadFile (running)
[15:20:52] [tool] ReadFile → completed
           result: import { Config } from './types...
[15:20:53] [tool] WriteFile (running)
[15:20:54] [tool] WriteFile → completed
           result: Successfully wrote 245 bytes to...
```

**Debug level**:
```
[15:20:51] [tool] ReadFile (running)
           params: {
             "path": "/src/config.ts"
           }
[15:20:52] [tool] ReadFile → completed
           result: import { Config } from './types';
                   
                   export interface TelegramAcpConfig {
                     telegram: {
                       botToken: string;
                     };
                     // ... full content
```

## Implementation Plan

### Phase 1: Core Infrastructure
1. Create `ToolCallTracker` class
2. Update `StreamingMessageState` to use single tool stream
3. Add configuration options

### Phase 2: CLI Logging
1. Enhance `handleThoughtChunk()` with CLI logging
2. Update `handleToolCall()` and `handleToolCallUpdate()` with detailed output
3. Add truncation utilities for long content
4. Implement log level filtering

### Phase 3: Telegram Messaging
1. Implement tool summary formatter
2. Update message streaming to use tracker
3. Add rate limiting for edits

### Phase 4: Testing & Documentation
1. Add unit tests for `ToolCallTracker`
2. Update integration tests for streaming
3. Update README with new options

## Backward Compatibility

- Feature flags control new behavior
- Default: new behavior enabled (better UX)
- Old behavior available via config:
  ```yaml
  features:
    legacyToolMessages: true  # Use old per-tool messages
  ```

## Success Criteria

1. ✅ Single consolidated tool message in Telegram (max 10 tools shown)
2. ✅ CLI logs show thought content (default: info level)
3. ✅ CLI logs show tool names (not IDs)
4. ✅ Default mode shows truncated params/results; debug mode shows full details
5. ✅ Message rate limited to avoid Telegram API limits
6. ✅ All existing tests pass
