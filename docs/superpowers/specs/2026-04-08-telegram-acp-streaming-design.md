# Telegram ACP Streaming Output Design

**Date**: 2026-04-08
**Status**: Draft
**Scope**: telegram-acp package

## Overview

### Goal

实现 Telegram ACP Bot 的流式输出功能，将 Agent 的中间状态（thought、text chunks、tool calls）实时展示给 Telegram 用户，通过编辑消息实现类似流式输出的视觉效果。

### Current Behavior

- `TelegramAcpClient.sessionUpdate()` 收集所有 chunks
- `client.flush()` 在 prompt 结束后一次性发送完整结果
- 用户无法看到中间过程（thinking、tool execution）

### Target Behavior

- Thought 流式展示：累积字符后发送消息并持续编辑
- Text 流式展示：与 thought 分离，独立消息流式更新
- Tool calls 独立消息：每个 tool call 单条消息，状态变化时编辑
- 混合模式：thought + text 合并一条流式，tool calls 各自独立

### Constraints

- Telegram 消息编辑速率限制：约 30 次/分钟
- Telegram 消息长度限制：4096 字符
- ACP 协议 chunks 不保证顺序或完整性

---

## Architecture

### Design Decision

采用 **方案 A**：在 `TelegramAcpClient` 内实现流式发送逻辑。

**理由**：
- 改动集中在 `client.ts`，逻辑清晰
- 现有 `flush()` 机制保留，兼容性好
- 流式状态管理内聚，易于维护

### Component Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `client.ts` | Major | 新增流式消息追踪、编辑逻辑、格式化方法 |
| `session.ts` | Minor | 新增 `sendMessage/editMessage` callbacks 传递 |
| `bridge.ts` | Minor | 新增消息管理 callbacks，调用 Telegram API |
| `bot.ts` | Minor | 移除最终 reply 发送，调用 `reset()` |

---

## Data Flow

### Normal Flow

```
ACP Agent → sessionUpdate chunks
  ↓
TelegramAcpClient.sessionUpdate()
  ↓
Accumulate chars + count
  ↓
Threshold exceeded?
  ↓ (yes)
sendMessage/editMessage (via callbacks)
  ↓
SessionManager → bridge.ts → Telegram API
  ↓
Message updated in Telegram chat
  ↓
prompt() completes
  ↓
client.flush() → finalizeAll()
  ↓
Record history
```

### Threshold Strategy

- **首次发送阈值**：30 字符（快速展示，避免空白等待）
- **编辑阈值**：80 字符（平衡视觉效果与 API 限制）
- **最终编辑**：`flush()` 时强制编辑，确保完整内容

---

## Detailed Design

### 1. TelegramAcpClient State

```typescript
// 流式消息追踪
private thoughtMsgId: number | null = null;
private textMsgId: number | null = null;
private toolMsgIds: Map<string, number> = new Map();

// 累积计数器
private thoughtCharCount: number = 0;
private textCharCount: number = 0;

// 常量
private static readonly FIRST_SEND_THRESHOLD = 30;
private static readonly EDIT_THRESHOLD = 80;
```

### 2. TelegramAcpClientOpts Extension

```typescript
export interface TelegramAcpClientOpts {
  // 现有字段保留
  sendTyping?: () => Promise<void>;
  onThoughtFlush: (text: string) => Promise<void>;
  log: (msg: string) => void;
  showThoughts: boolean;

  // 新增
  sendMessage?: (text: string, parseMode?: 'HTML') => Promise<number>;
  editMessage?: (msgId: number, text: string, parseMode?: 'HTML') => Promise<number>;
}
```

**返回值说明**：`sendMessage/editMessage` 返回 `message_id`，用于后续编辑追踪。

### 3. sessionUpdate Event Handling

#### agent_thought_chunk

```typescript
case "agent_thought_chunk":
  if (update.content.type === "text") {
    const text = update.content.text;
    this.thoughtChunks.push(text);
    this.thoughtCharCount += text.length;

    // 首次发送（快速展示）
    if (!this.thoughtMsgId && this.thoughtCharCount >= FIRST_SEND_THRESHOLD) {
      const formatted = this.formatThought(this.thoughtChunks.join(""));
      this.thoughtMsgId = await this.opts.sendMessage?.(formatted, "HTML") ?? null;
    }
    // 后续编辑（批量阈值）
    else if (this.thoughtMsgId && this.thoughtCharCount >= EDIT_THRESHOLD) {
      const formatted = this.formatThought(this.thoughtChunks.join(""));
      await this.opts.editMessage?.(this.thoughtMsgId, formatted, "HTML");
      this.thoughtCharCount = 0;
    }
  }
  await this.maybeSendTyping();
  break;
```

#### agent_message_chunk

```typescript
case "agent_message_chunk":
  await this.finalizeThought(); // 先完成 thought

  if (update.content.type === "text") {
    this.chunks.push(update.content.text);
    this.textCharCount += update.content.text.length;

    if (!this.textMsgId && this.textCharCount >= FIRST_SEND_THRESHOLD) {
      const text = this.chunks.join("");
      this.textMsgId = await this.opts.sendMessage?.(text, "HTML") ?? null;
    }
    else if (this.textMsgId && this.textCharCount >= EDIT_THRESHOLD) {
      const text = this.chunks.join("");
      await this.opts.editMessage?.(this.textMsgId, text, "HTML");
      this.textCharCount = 0;
    }
  }
  await this.maybeSendTyping();
  break;
```

#### tool_call

```typescript
case "tool_call":
  await this.finalizeThought();

  const toolKey = update.toolCallId;
  const formatted = this.formatToolCall(update);

  if (!this.toolMsgIds.has(toolKey)) {
    const msgId = await this.opts.sendMessage?.(formatted, "HTML") ?? 0;
    this.toolMsgIds.set(toolKey, msgId);
  }
  await this.maybeSendTyping();
  break;
```

#### tool_call_update

```typescript
case "tool_call_update":
  const msgId = this.toolMsgIds.get(update.toolCallId);
  if (msgId && update.status) {
    const formatted = this.formatToolCallUpdate(update);
    await this.opts.editMessage?.(msgId, formatted, "HTML");
  }
  break;
```

### 4. Formatting Methods

```typescript
private formatThought(text: string): string {
  const escaped = escapeHtml(text);
  return `<i>💭 Thinking...</i>\n${escaped}`;
}

private formatThoughtFinal(text: string): string {
  const escaped = escapeHtml(text);
  return `<i>💭 Thought complete</i>\n${escaped}`;
}

private formatToolCall(update: acp.ToolCall): string {
  const icon = update.status === 'running' ? '⏳' :
               update.status === 'completed' ? '✅' : '❌';
  const title = escapeHtml(update.title);
  return `<b>${icon} 🔧 ${title}</b>`;
}

private formatToolCallUpdate(update: acp.ToolCallUpdate): string {
  const icon = update.status === 'running' ? '⏳' :
               update.status === 'completed' ? '✅' : '❌';
  const title = escapeHtml(update.title ?? 'Tool');
  const content = update.content ? this.formatToolContent(update.content) : '';
  return `<b>${icon} 🔧 ${title}</b>\n${content}`;
}

private formatToolContent(content: acp.ContentBlock[]): string {
  const parts: string[] = [];
  for (const c of content) {
    if (c.type === 'text') {
      parts.push(escapeHtml(c.text));
    } else if (c.type === 'diff') {
      const diff = c as acp.Diff;
      const lines = [`--- ${diff.path}`];
      if (diff.oldText) lines.push(...diff.oldText.split('\n').map(l => `- ${l}`));
      if (diff.newText) lines.push(...diff.newText.split('\n').map(l => `+ ${l}`));
      parts.push(`<pre><code>${escapeHtml(lines.join('\n'))}</code></pre>`);
    }
  }
  return parts.join('\n');
}
```

### 5. flush() and Finalization

```typescript
async flush(): Promise<string> {
  await this.finalizeAll();
  const text = this.chunks.join("");
  this.chunks = [];
  return text;
}

private async finalizeAll(): Promise<void> {
  await this.finalizeThought();
  await this.finalizeText();
}

private async finalizeThought(): Promise<void> {
  if (this.thoughtChunks.length > 0 && this.thoughtMsgId) {
    const formatted = this.formatThoughtFinal(this.thoughtChunks.join(""));
    await this.opts.editMessage?.(this.thoughtMsgId, formatted, "HTML");
  }
  this.thoughtChunks = [];
  this.thoughtCharCount = 0;
}

private async finalizeText(): Promise<void> {
  if (this.chunks.length > 0 && this.textMsgId) {
    const text = this.chunks.join("");
    await this.opts.editMessage?.(this.textMsgId, text, "HTML");
  }
  this.textCharCount = 0;
}

reset(): void {
  this.thoughtMsgId = null;
  this.textMsgId = null;
  this.toolMsgIds.clear();
  this.thoughtCharCount = 0;
  this.textCharCount = 0;
  this.thoughtChunks = [];
  this.chunks = [];
}
```

### 6. SessionManager Changes

```typescript
export interface SessionManagerOpts {
  // 现有字段保留
  agentPreset?: string;
  agentCommand: string;
  agentArgs: string[];
  agentCwd: string;
  agentEnv?: Record<string, string>;
  sessionConfig: SessionConfig;
  historyConfig: HistoryConfig;
  showThoughts: boolean;
  log: (msg: string) => void;
  onReply: (userId: string, text: string) => Promise<void>;
  sendTyping: (userId: string) => Promise<void>;

  // 新增
  sendMessage?: (userId: string, text: string, parseMode?: 'HTML') => Promise<number>;
  editMessage?: (userId: string, msgId: number, text: string, parseMode?: 'HTML') => Promise<number>;
}
```

**create() method modification**:

```typescript
private async create(userId: string): Promise<UserSession> {
  const client = new TelegramAcpClient({
    sendTyping: () => this.opts.sendTyping(userId),
    onThoughtFlush: (text: string) => this.opts.onReply(userId, text),

    // 新增
    sendMessage: async (text: string, parseMode?: 'HTML') => {
      return this.opts.sendMessage?.(userId, text, parseMode) ?? 0;
    },
    editMessage: async (msgId: number, text: string, parseMode?: 'HTML') => {
      return this.opts.editMessage?.(userId, msgId, text, parseMode) ?? 0;
    },

    log: (msg: string) => this.opts.log(`[${userId}] ${msg}`),
    showThoughts: this.opts.showThoughts,
  });
  // ... rest unchanged
}
```

### 7. bridge.ts Changes

```typescript
async start(): Promise<void> {
  this.sessionManager = new SessionManager({
    // 现有配置保留
    agentCommand: this.config.agent.command,
    agentArgs: this.config.agent.args,
    agentCwd: this.config.agent.cwd,
    agentEnv: this.config.agent.env,
    agentPreset: this.config.agent.preset,
    sessionConfig: this.config.session,
    historyConfig: this.config.history,
    showThoughts: this.config.agent.showThoughts,
    log: this.log,

    onReply: async (userId: string, text: string) => {
      if (this.bot) {
        await this.bot.api.sendMessage(userId, text);
      }
    },
    sendTyping: async (userId: string) => {
      if (this.bot) {
        await this.bot.api.sendChatAction(userId, "typing");
      }
    },

    // 新增
    sendMessage: async (userId: string, text: string, parseMode?: 'HTML') => {
      if (!this.bot) return 0;
      const msg = await this.bot.api.sendMessage(userId, text, {
        parse_mode: parseMode
      });
      return msg.message_id;
    },
    editMessage: async (userId: string, msgId: number, text: string, parseMode?: 'HTML') => {
      if (!this.bot) return 0;
      const msg = await this.bot.api.editMessageText(userId, msgId, text, {
        parse_mode: parseMode
      });
      return msg.message_id;
    },
  });
  // ... rest unchanged
}
```

### 8. bot.ts Changes

```typescript
async function messageHandler(ctx: Context) {
  const acpCtx = ctx as AcpContext;
  const session = acpCtx.session;
  const userId = ctx.from?.id.toString();

  if (!userId) return;

  // 1. Immediate feedback (现有逻辑保留)
  await ctx.react("👀");

  // 2. Extract message content (现有逻辑保留)
  let prompt = extractPrompt(ctx);

  // 3. Inject history (现有逻辑保留)
  const historyToInject = pendingHistoryInjection.get(userId);
  if (historyToInject) {
    pendingHistoryInjection.delete(userId);
    prompt = buildHistoryContext(historyToInject) + "\n\n[Current message]:\n" + prompt;
  }

  // 4. Record user message (现有逻辑保留)
  await acpCtx.sessionManager.recordMessage(userId, 'user', prompt);

  // 5. Update reaction (现有逻辑保留)
  await ctx.react("🤔");

  // Build ACP prompt (现有逻辑保留)
  const content: acp.ContentBlock = {
    type: "text",
    text: prompt,
  };

  try {
    // 新增：重置流式状态
    session.client.reset();

    // 发送 prompt (现有逻辑保留)
    const result = await session.connection.prompt({
      sessionId: session.sessionId,
      prompt: [content],
    });

    // flush() 现在只返回完整文本用于记录
    const replyText = await session.client.flush();

    // Handle stop reasons (现有逻辑保留，可选：标记未完成消息)
    if (result.stopReason === "cancelled") {
      replyText += "\n[cancelled]";
    } else if (result.stopReason === "refusal") {
      replyText += "\n[agent refused]";
    }

    // 记录历史 (现有逻辑保留)
    await acpCtx.sessionManager.recordMessage(userId, 'agent', replyText);

    // 清除 reaction (现有逻辑保留)
    await ctx.react([]);

    // 移除：不再发送最终 reply（流式消息已发送完毕）

  } catch (err) {
    await ctx.react([]);
    await ctx.reply(`⚠️ Error: ${String(err)}`);
  }
}
```

---

## Error Handling

### Rate Limiting (429 Too Many Requests)

**策略**：
- 不主动处理，依赖 Telegram API 自然失败
- 失败时 `opts.editMessage` 返回 0，不影响流程
- 最终 `flush()` 时强制编辑，确保完整内容

**可选优化**（后续迭代）：
- 引入本地速率限制器（如每 2 秒最多 1 次编辑）
- 遇到 429 时缓存消息，稍后重试

### Message Too Long (400 Bad Request)

**策略**：
- 检测消息长度，超过 4096 字符时分段发送
- Thought/Tool call 内容较短，不易超限
- Text 内容超限：首次发送截断，后续编辑补充分段

```typescript
// 示例：分段发送逻辑
private async sendLongText(text: string): Promise<number[]> {
  const msgIds: number[] = [];
  const chunks = this.splitMessage(text, 4000);
  for (const chunk of chunks) {
    const msgId = await this.opts.sendMessage?.(chunk, "HTML") ?? 0;
    msgIds.push(msgId);
  }
  return msgIds;
}

private splitMessage(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  while (text.length > maxLen) {
    chunks.push(text.slice(0, maxLen));
    text = text.slice(maxLen);
  }
  chunks.push(text);
  return chunks;
}
```

### Network Errors

**策略**：
- 所有 Telegram API 调用用 `try-catch` 包裹
- 失败时记录日志，继续流程
- 最终 `flush()` 时仍尝试发送完整消息作为 fallback

---

## Testing Points

### Unit Tests (client.ts)

1. **阈值触发**：验证 `thoughtCharCount >= EDIT_THRESHOLD` 时触发编辑
2. **首次发送**：验证首次 30 字符发送消息
3. **格式化**：验证 HTML 格式正确（escape、标签）
4. **reset()**：验证状态清理完整

### Integration Tests

1. **完整流程**：发送 prompt → 观察流式消息 → 验证最终内容
2. **多 tool calls**：验证每个 tool call 独立消息且状态正确
3. **历史记录**：验证 `flush()` 返回完整文本正确记录

### Manual Tests

1. **速率限制**：模拟高频 chunks，观察是否触发 429
2. **长消息**：发送超长内容，验证分段逻辑
3. **取消/拒绝**：验证 stopReason 处理正确

---

## Implementation Notes

### Phase 1: Core Streaming

- 实现 `client.ts` 流式逻辑
- 实现 `session.ts` / `bridge.ts` callbacks
- 修改 `bot.ts` 移除最终 reply

### Phase 2: Error Handling

- 添加消息分段逻辑
- 添加速率限制检测（可选）

### Phase 3: Polish

- 优化格式化（添加更多状态图标）
- 添加用户配置（可选启用流式）

---

## Decisions

1. **showThoughts 配置**：保留该配置控制 thought 显示。
   - `showThoughts: false` 时跳过 thought 流式，仅展示 text 和 tool calls

2. **Tool call 内容展示**：`tool_call_update` 的 content 只在完成时展示。
   - 避免频繁编辑，减少 API 调用

3. **取消/拒绝处理**：保留未完成的流式消息，标记 `[cancelled]` / `[refused]`。
   - 用户可见中断原因，避免消息消失困惑

---

## References

- [Telegram API: editMessageText](https://core.telegram.org/bots/api#editmessagetext)
- [Telegram API: sendMessage](https://core.telegram.org/bots/api#sendmessage)
- [grammy Documentation](https://grammy.dev/guide/messages.html)
- [ACP Protocol: SessionNotification](packages/telegram-acp/src/client.ts)