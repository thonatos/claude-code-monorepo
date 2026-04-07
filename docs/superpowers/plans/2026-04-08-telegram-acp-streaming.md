# Telegram ACP Streaming Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Telegram ACP Bot 流式输出，将 Agent 中间状态实时展示给用户。

**Architecture:** 在 `TelegramAcpClient` 内实现流式逻辑，通过新增 callbacks 调用 Telegram API 编辑消息。阈值触发批量编辑（首次 30 字符，后续 80 字符），thought/text 合并一条流式，tool calls 各自独立消息。

**Tech Stack:** TypeScript, grammy, ACP SDK, vitest

---

## File Structure

| File | Action | Description |
|------|--------|-------------|
| `test/client.test.ts` | Create | 单元测试：阈值触发、格式化、reset |
| `src/client.ts` | Modify | 流式消息追踪、编辑逻辑、格式化方法 |
| `src/session.ts` | Modify | 新增 sendMessage/editMessage callbacks 传递 |
| `src/bridge.ts` | Modify | 新增消息管理 callbacks 实现 |
| `src/bot.ts` | Modify | 移除最终 reply 发送，调用 reset() |

---

## Task 1: 编写 client.ts 单元测试

**Files:**
- Create: `packages/telegram-acp/test/client.test.ts`
- Modify: `packages/telegram-acp/src/client.ts` (仅添加 export)

- [ ] **Step 1: 创建测试文件骨架**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelegramAcpClient } from '../src/client.ts';

describe('TelegramAcpClient streaming', () => {
  let mockSendMessage: ReturnType<typeof vi.fn>;
  let mockEditMessage: ReturnType<typeof vi.fn>;
  let client: TelegramAcpClient;

  beforeEach(() => {
    mockSendMessage = vi.fn().mockResolvedValue(123);
    mockEditMessage = vi.fn().mockResolvedValue(123);
    client = new TelegramAcpClient({
      sendMessage: mockSendMessage,
      editMessage: mockEditMessage,
      onThoughtFlush: vi.fn(),
      log: vi.fn(),
      showThoughts: true,
    });
  });

  describe('threshold triggers', () => {
    // Tests will be added in subsequent steps
  });

  describe('formatting', () => {
    // Tests will be added in subsequent steps
  });

  describe('reset', () => {
    // Tests will be added in subsequent steps
  });
});
```

- [ ] **Step 2: 运行测试确认骨架可执行**

Run: `cd packages/telegram-acp && pnpm test test/client.test.ts`

Expected: 测试框架运行，所有测试 pass（空 describe）

- [ ] **Step 3: 编写阈值触发测试**

在 `describe('threshold triggers', () => {})` 内添加：

```typescript
it('should send message when thought reaches FIRST_SEND_THRESHOLD', async () => {
  // FIRST_SEND_THRESHOLD = 30
  await client.sessionUpdate({
    update: {
      sessionUpdate: 'agent_thought_chunk',
      content: { type: 'text', text: 'This is a thinking process that has more than thirty characters' },
    },
  });

  expect(mockSendMessage).toHaveBeenCalledTimes(1);
  expect(mockSendMessage).toHaveBeenCalledWith(
    expect.stringContaining('Thinking'),
    'HTML'
  );
});

it('should edit message when thought reaches EDIT_THRESHOLD', async () => {
  // 首次发送
  await client.sessionUpdate({
    update: {
      sessionUpdate: 'agent_thought_chunk',
      content: { type: 'text', text: 'This is a thinking process that has more than thirty characters' },
    },
  });

  // 第二次 chunk 超过 EDIT_THRESHOLD (80)
  await client.sessionUpdate({
    update: {
      sessionUpdate: 'agent_thought_chunk',
      content: { type: 'text', text: ' and then continues with even more thinking content to reach the edit threshold limit' },
    },
  });

  expect(mockSendMessage).toHaveBeenCalledTimes(1);
  expect(mockEditMessage).toHaveBeenCalledTimes(1);
});

it('should not edit before reaching threshold', async () => {
  await client.sessionUpdate({
    update: {
      sessionUpdate: 'agent_thought_chunk',
      content: { type: 'text', text: 'short' }, // 5 chars, below threshold
    },
  });

  expect(mockSendMessage).not.toHaveBeenCalled();
  expect(mockEditMessage).not.toHaveBeenCalled();
});
```

- [ ] **Step 4: 运行测试确认失败**

Run: `cd packages/telegram-acp && pnpm test test/client.test.ts`

Expected: FAIL - 类型错误或方法不存在（因为 client.ts 未实现）

- [ ] **Step 5: 编写格式化测试**

在 `describe('formatting', () => {})` 内添加：

```typescript
it('should format thought with italic prefix', async () => {
  await client.sessionUpdate({
    update: {
      sessionUpdate: 'agent_thought_chunk',
      content: { type: 'text', text: 'This is a thinking process that has more than thirty characters' },
    },
  });

  const sentText = mockSendMessage.mock.calls[0][0];
  expect(sentText).toMatch(/^<i>💭 Thinking\.\.\.<\/i>\n/);
  expect(sentText).toContain('This is a thinking');
});

it('should escape HTML in thought content', async () => {
  await client.sessionUpdate({
    update: {
      sessionUpdate: 'agent_thought_chunk',
      content: { type: 'text', text: 'This has <script> tags and more than thirty characters total' },
    },
  });

  const sentText = mockSendMessage.mock.calls[0][0];
  expect(sentText).toContain('&lt;script&gt;');
  expect(sentText).not.toContain('<script>');
});

it('should format tool call with bold and icon', async () => {
  await client.sessionUpdate({
    update: {
      sessionUpdate: 'tool_call',
      toolCallId: 'tool-123',
      title: 'Read File',
      status: 'running',
    },
  });

  expect(mockSendMessage).toHaveBeenCalledTimes(1);
  const sentText = mockSendMessage.mock.calls[0][0];
  expect(sentText).toMatch(/⏳.*🔧.*Read File/);
  expect(sentText).toContain('<b>');
});
```

- [ ] **Step 6: 编写 reset 测试**

在 `describe('reset', () => {})` 内添加：

```typescript
it('should clear all streaming state on reset', async () => {
  // 触发一些流式消息
  await client.sessionUpdate({
    update: {
      sessionUpdate: 'agent_thought_chunk',
      content: { type: 'text', text: 'This is a thinking process that has more than thirty characters' },
    },
  });

  await client.sessionUpdate({
    update: {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'This is a response message with enough characters to trigger first send' },
    },
  });

  await client.sessionUpdate({
    update: {
      sessionUpdate: 'tool_call',
      toolCallId: 'tool-1',
      title: 'Test Tool',
      status: 'running',
    },
  });

  // 重置
  client.reset();

  // 新的消息应该重新发送（不编辑旧消息）
  await client.sessionUpdate({
    update: {
      sessionUpdate: 'agent_thought_chunk',
      content: { type: 'text', text: 'New thought with more than thirty characters here' },
    },
  });

  // 应该是新的 sendMessage，而不是 editMessage
  expect(mockSendMessage.mock.calls.length).toBeGreaterThan(3);
});
```

- [ ] **Step 7: 运行测试确认失败**

Run: `cd packages/telegram-acp && pnpm test test/client.test.ts`

Expected: FAIL - TelegramAcpClient 缺少新方法/属性

- [ ] **Step 8: 提交测试文件**

```bash
git add packages/telegram-acp/test/client.test.ts
git commit -m "test: 添加 TelegramAcpClient 流式输出测试"
```

---

## Task 2: 实现 TelegramAcpClient 流式状态与常量

**Files:**
- Modify: `packages/telegram-acp/src/client.ts`

- [ ] **Step 1: 添加流式状态属性**

在 `TelegramAcpClient` 类顶部添加：

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

- [ ] **Step 2: 扩展 TelegramAcpClientOpts 接口**

修改接口定义：

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

- [ ] **Step 3: 运行测试确认类型错误修复**

Run: `cd packages/telegram-acp && pnpm test test/client.test.ts`

Expected: FAIL - 方法未实现，但类型错误已修复

- [ ] **Step 4: 提交**

```bash
git add packages/telegram-acp/src/client.ts
git commit -m "feat(client): 添加流式消息状态追踪属性"
```

---

## Task 3: 实现 reset() 方法

**Files:**
- Modify: `packages/telegram-acp/src/client.ts`

- [ ] **Step 1: 实现 reset() 方法**

在 `TelegramAcpClient` 类添加：

```typescript
/**
 * Reset streaming state for new prompt.
 */
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

- [ ] **Step 2: 导出 reset() 方法**

确保类已有 public 方法暴露（默认 TypeScript class methods 为 public）

- [ ] **Step 3: 运行 reset 相关测试**

Run: `cd packages/telegram-acp && pnpm test test/client.test.ts -t "reset"`

Expected: FAIL - 其他方法未实现，但 reset() 应可用

- [ ] **Step 4: 提交**

```bash
git add packages/telegram-acp/src/client.ts
git commit -m "feat(client): 实现 reset() 方法清理流式状态"
```

---

## Task 4: 实现格式化方法

**Files:**
- Modify: `packages/telegram-acp/src/client.ts`
- Import: `packages/telegram-acp/src/bot.ts` 的 escapeHtml

- [ ] **Step 1: 导入 escapeHtml 函数**

在文件顶部添加导入：

```typescript
import { escapeHtml } from './bot.ts';
```

- [ ] **Step 2: 实现 formatThought 方法**

```typescript
private formatThought(text: string): string {
  const escaped = escapeHtml(text);
  return `<i>💭 Thinking...</i>\n${escaped}`;
}
```

- [ ] **Step 3: 实现 formatThoughtFinal 方法**

```typescript
private formatThoughtFinal(text: string): string {
  const escaped = escapeHtml(text);
  return `<i>💭 Thought complete</i>\n${escaped}`;
}
```

- [ ] **Step 4: 实现 formatToolCall 方法**

```typescript
private formatToolCall(update: { title: string; status: string }): string {
  const icon = update.status === 'running' ? '⏳' :
               update.status === 'completed' ? '✅' : '❌';
  const title = escapeHtml(update.title);
  return `<b>${icon} 🔧 ${title}</b>`;
}
```

- [ ] **Step 5: 实现 formatToolCallUpdate 方法**

```typescript
private formatToolCallUpdate(update: { toolCallId: string; status?: string; title?: string; content?: any[] }): string {
  const icon = update.status === 'running' ? '⏳' :
               update.status === 'completed' ? '✅' : '❌';
  const title = escapeHtml(update.title ?? 'Tool');
  const content = update.content ? this.formatToolContent(update.content) : '';
  return `<b>${icon} 🔧 ${title}</b>\n${content}`;
}
```

- [ ] **Step 6: 实现 formatToolContent 方法**

```typescript
private formatToolContent(content: any[]): string {
  const parts: string[] = [];
  for (const c of content) {
    if (c.type === 'text') {
      parts.push(escapeHtml(c.text));
    } else if (c.type === 'diff') {
      const diff = c;
      const lines = [`--- ${diff.path}`];
      if (diff.oldText) lines.push(...diff.oldText.split('\n').map((l: string) => `- ${l}`));
      if (diff.newText) lines.push(...diff.newText.split('\n').map((l: string) => `+ ${l}`));
      parts.push(`<pre><code>${escapeHtml(lines.join('\n'))}</code></pre>`);
    }
  }
  return parts.join('\n');
}
```

- [ ] **Step 7: 运行格式化测试**

Run: `cd packages/telegram-acp && pnpm test test/client.test.ts -t "formatting"`

Expected: FAIL - sessionUpdate 未使用格式化方法

- [ ] **Step 8: 提交**

```bash
git add packages/telegram-acp/src/client.ts
git commit -m "feat(client): 实现流式消息格式化方法"
```

---

## Task 5: 实现 finalize 方法

**Files:**
- Modify: `packages/telegram-acp/src/client.ts`

- [ ] **Step 1: 实现 finalizeThought 方法**

```typescript
private async finalizeThought(): Promise<void> {
  if (this.thoughtChunks.length > 0 && this.thoughtMsgId) {
    const formatted = this.formatThoughtFinal(this.thoughtChunks.join(""));
    await this.opts.editMessage?.(this.thoughtMsgId, formatted, "HTML");
  }
  this.thoughtChunks = [];
  this.thoughtCharCount = 0;
}
```

- [ ] **Step 2: 实现 finalizeText 方法**

```typescript
private async finalizeText(): Promise<void> {
  if (this.chunks.length > 0 && this.textMsgId) {
    const text = this.chunks.join("");
    await this.opts.editMessage?.(this.textMsgId, text, "HTML");
  }
  this.textCharCount = 0;
}
```

- [ ] **Step 3: 实现 finalizeAll 方法**

```typescript
private async finalizeAll(): Promise<void> {
  await this.finalizeThought();
  await this.finalizeText();
}
```

- [ ] **Step 4: 提交**

```bash
git add packages/telegram-acp/src/client.ts
git commit -m "feat(client): 实现 finalize 方法完成流式消息"
```

---

## Task 6: 修改 flush() 方法

**Files:**
- Modify: `packages/telegram-acp/src/client.ts`

- [ ] **Step 1: 修改 flush() 调用 finalizeAll**

修改现有 `flush()` 方法：

```typescript
async flush(): Promise<string> {
  await this.finalizeAll();
  const text = this.chunks.join("");
  this.chunks = [];
  return text;
}
```

- [ ] **Step 2: 运行测试确认基础编译通过**

Run: `cd packages/telegram-acp && pnpm run build`

Expected: 编译成功

- [ ] **Step 3: 提交**

```bash
git add packages/telegram-acp/src/client.ts
git commit -m "feat(client): flush() 调用 finalizeAll 完成流式消息"
```

---

## Task 7: 实现 agent_thought_chunk 处理

**Files:**
- Modify: `packages/telegram-acp/src/client.ts`

- [ ] **Step 1: 修改 sessionUpdate 的 agent_thought_chunk case**

找到 `case "agent_thought_chunk"` 块，替换为：

```typescript
case "agent_thought_chunk":
  if (update.content.type === "text") {
    const text = update.content.text;
    this.thoughtChunks.push(text);
    this.thoughtCharCount += text.length;

    // 首次发送（快速展示）
    if (!this.thoughtMsgId && this.thoughtCharCount >= TelegramAcpClient.FIRST_SEND_THRESHOLD) {
      const formatted = this.formatThought(this.thoughtChunks.join(""));
      this.thoughtMsgId = await this.opts.sendMessage?.(formatted, "HTML") ?? null;
    }
    // 后续编辑（批量阈值）
    else if (this.thoughtMsgId && this.thoughtCharCount >= TelegramAcpClient.EDIT_THRESHOLD) {
      const formatted = this.formatThought(this.thoughtChunks.join(""));
      await this.opts.editMessage?.(this.thoughtMsgId, formatted, "HTML");
      this.thoughtCharCount = 0;
    }
  }
  await this.maybeSendTyping();
  break;
```

- [ ] **Step 2: 运行 thought 相关测试**

Run: `cd packages/telegram-acp && pnpm test test/client.test.ts -t "thought"`

Expected: PASS - thought 阈值触发测试通过

- [ ] **Step 3: 提交**

```bash
git add packages/telegram-acp/src/client.ts
git commit -m "feat(client): 实现 agent_thought_chunk 流式处理"
```

---

## Task 8: 实现 agent_message_chunk 处理

**Files:**
- Modify: `packages/telegram-acp/src/client.ts`

- [ ] **Step 1: 修改 sessionUpdate 的 agent_message_chunk case**

找到 `case "agent_message_chunk"` 块，替换为：

```typescript
case "agent_message_chunk":
  // 先完成 thought
  await this.finalizeThought();

  if (update.content.type === "text") {
    this.chunks.push(update.content.text);
    this.textCharCount += update.content.text.length;

    // 首次发送
    if (!this.textMsgId && this.textCharCount >= TelegramAcpClient.FIRST_SEND_THRESHOLD) {
      const text = this.chunks.join("");
      this.textMsgId = await this.opts.sendMessage?.(text, "HTML") ?? null;
    }
    // 后续编辑
    else if (this.textMsgId && this.textCharCount >= TelegramAcpClient.EDIT_THRESHOLD) {
      const text = this.chunks.join("");
      await this.opts.editMessage?.(this.textMsgId, text, "HTML");
      this.textCharCount = 0;
    }
  }
  await this.maybeSendTyping();
  break;
```

- [ ] **Step 2: 运行测试**

Run: `cd packages/telegram-acp && pnpm test test/client.test.ts`

Expected: PASS - 所有阈值测试通过

- [ ] **Step 3: 提交**

```bash
git add packages/telegram-acp/src/client.ts
git commit -m "feat(client): 实现 agent_message_chunk 流式处理"
```

---

## Task 9: 实现 tool_call 处理

**Files:**
- Modify: `packages/telegram-acp/src/client.ts`

- [ ] **Step 1: 修改 sessionUpdate 的 tool_call case**

找到 `case "tool_call"` 块，替换为：

```typescript
case "tool_call":
  await this.finalizeThought();

  const toolKey = update.toolCallId;
  const formatted = this.formatToolCall(update);

  if (!this.toolMsgIds.has(toolKey)) {
    const msgId = await this.opts.sendMessage?.(formatted, "HTML") ?? 0;
    this.toolMsgIds.set(toolKey, msgId);
  }
  this.opts.log(`[tool] ${update.title} (${update.status})`);
  await this.maybeSendTyping();
  break;
```

- [ ] **Step 2: 运行 tool call 相关测试**

Run: `cd packages/telegram-acp && pnpm test test/client.test.ts -t "tool"`

Expected: PASS - tool call 格式化测试通过

- [ ] **Step 3: 提交**

```bash
git add packages/telegram-acp/src/client.ts
git commit -m "feat(client): 实现 tool_call 流式消息发送"
```

---

## Task 10: 实现 tool_call_update 处理

**Files:**
- Modify: `packages/telegram-acp/src/client.ts`

- [ ] **Step 1: 修改 sessionUpdate 的 tool_call_update case**

找到 `case "tool_call_update"` 块，替换为：

```typescript
case "tool_call_update":
  const msgId = this.toolMsgIds.get(update.toolCallId);
  if (msgId && update.status) {
    const formatted = this.formatToolCallUpdate(update);
    await this.opts.editMessage?.(msgId, formatted, "HTML");
  }
  if (update.status) {
    this.opts.log(`[tool] ${update.toolCallId} → ${update.status}`);
  }
  break;
```

- [ ] **Step 2: 运行所有测试**

Run: `cd packages/telegram-acp && pnpm test test/client.test.ts`

Expected: PASS - 所有测试通过

- [ ] **Step 3: 提交**

```bash
git add packages/telegram-acp/src/client.ts
git commit -m "feat(client): 实现 tool_call_update 流式消息编辑"
```

---

## Task 11: 修改 SessionManager 传递 callbacks

**Files:**
- Modify: `packages/telegram-acp/src/session.ts`

- [ ] **Step 1: 扩展 SessionManagerOpts 接口**

找到 `SessionManagerOpts` 接口，添加：

```typescript
export interface SessionManagerOpts {
  // 现有字段保留...
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

- [ ] **Step 2: 修改 create 方法传递 callbacks**

找到 `create` 方法中 `new TelegramAcpClient({...})` 部分，添加：

```typescript
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
```

- [ ] **Step 3: 修改 restore 方法传递 callbacks**

找到 `restore` 方法中 `new TelegramAcpClient({...})` 部分，添加相同 callbacks：

```typescript
const client = new TelegramAcpClient({
  sendTyping: () => this.opts.sendTyping(userId),
  onThoughtFlush: async (text: string) => {
    this.bufferReply(userId, text);
    await this.opts.onReply(userId, text);
  },

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
```

- [ ] **Step 4: 运行编译检查**

Run: `cd packages/telegram-acp && pnpm run build`

Expected: 编译成功

- [ ] **Step 5: 提交**

```bash
git add packages/telegram-acp/src/session.ts
git commit -m "feat(session): 传递 sendMessage/editMessage callbacks"
```

---

## Task 12: 修改 bridge.ts 实现 callbacks

**Files:**
- Modify: `packages/telegram-acp/src/bridge.ts`

- [ ] **Step 1: 添加 sendMessage callback**

在 `SessionManager` 初始化中添加：

```typescript
this.sessionManager = new SessionManager({
  // 现有配置保留...
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
```

- [ ] **Step 2: 运行编译检查**

Run: `cd packages/telegram-acp && pnpm run build`

Expected: 编译成功

- [ ] **Step 3: 提交**

```bash
git add packages/telegram-acp/src/bridge.ts
git commit -m "feat(bridge): 实现 sendMessage/editMessage callbacks"
```

---

## Task 13: 修改 bot.ts messageHandler

**Files:**
- Modify: `packages/telegram-acp/src/bot.ts`

- [ ] **Step 1: 在 prompt 前添加 reset() 调用**

找到 `messageHandler` 函数，在 `try` 块开头添加：

```typescript
try {
  // 新增：重置流式状态
  session.client.reset();

  // 发送 prompt (现有逻辑保留)
  const result = await session.connection.prompt({...});
```

- [ ] **Step 2: 移除最终 reply 发送**

找到 `flush()` 后的 `ctx.reply(replyText)` 调用，删除或注释：

```typescript
// 记录历史
await acpCtx.sessionManager.recordMessage(userId, 'agent', replyText);

// 清除 reaction
await ctx.react([]);

// 移除：不再发送最终 reply（流式消息已在 sessionUpdate 过程中发送完毕）
// if (replyText.trim()) {
//   const formatted = formatForTelegram(replyText);
//   await ctx.reply(formatted, { parse_mode: "HTML" });
// }
```

- [ ] **Step 3: 运行编译检查**

Run: `cd packages/telegram-acp && pnpm run build`

Expected: 编译成功

- [ ] **Step 4: 运行所有测试**

Run: `cd packages/telegram-acp && pnpm test`

Expected: 所有测试通过

- [ ] **Step 5: 提交**

```bash
git add packages/telegram-acp/src/bot.ts
git commit -m "feat(bot): 移除最终 reply 发送，调用 reset() 重置流式状态"
```

---

## Task 14: 运行完整测试套件

- [ ] **Step 1: 运行所有单元测试**

Run: `cd packages/telegram-acp && pnpm test`

Expected: 所有测试 PASS

- [ ] **Step 2: 运行编译**

Run: `cd packages/telegram-acp && pnpm run build`

Expected: 编译成功，无错误

- [ ] **Step 3: 确认导出正确**

检查 `src/index.ts` 确保 `TelegramAcpClient` 已导出：

```typescript
export { TelegramAcpClient } from './client.ts';
```

- [ ] **Step 4: 提交最终版本**

```bash
git add -A
git commit -m "feat: 完成 telegram-acp 流式输出功能"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Threshold triggers (FIRST_SEND_THRESHOLD, EDIT_THRESHOLD) - Task 7, 8
- [x] Thought streaming with formatting - Task 7
- [x] Text streaming - Task 8
- [x] Tool call independent messages - Task 9
- [x] Tool call update editing - Task 10
- [x] reset() for new prompt - Task 3, 13
- [x] finalizeAll() in flush() - Task 6
- [x] SessionManager callbacks - Task 11
- [x] bridge.ts Telegram API integration - Task 12
- [x] bot.ts messageHandler modification - Task 13

**Placeholder scan:**
- [x] No TBD, TODO, or vague descriptions
- [x] All code blocks contain complete implementation
- [x] All commands specify exact paths and expected output

**Type consistency:**
- [x] `sendMessage` returns `Promise<number>` (message_id)
- [x] `editMessage` returns `Promise<number>` (message_id)
- [x] `toolCallId` is string type throughout
- [x] `parseMode` is `'HTML'` literal type