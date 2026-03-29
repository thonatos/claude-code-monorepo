# Telegram ACP Message Prompt Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix message handler to send user messages to ACP agent via connection.prompt()

**Architecture:** Add the missing connection.prompt() call in message.ts, following the pattern from wechat-acp's processQueue. Minimal change - no refactoring, no new features.

**Tech Stack:** TypeScript, grammy, @agentclientprotocol/sdk

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `packages/telegram-acp/src/handlers/message.ts` | Modify | Add connection.prompt() call |

---

### Task 1: Fix Message Handler

**Files:**
- Modify: `packages/telegram-acp/src/handlers/message.ts:41-53`

- [ ] **Step 1: Edit message.ts to add connection.prompt() call**

Replace lines 41-53 (from `// 构建 ACP prompt` to end of function):

```typescript
export async function messageHandler(ctx: Context) {
  const acpCtx = ctx as AcpContext;
  const userId = ctx.from?.id.toString();

  console.log(`[telegram-acp] Received message from user ${userId}:`, ctx.message);

  if (!userId) {
    return;
  }

  // 提取消息内容
  let prompt: string;

  if (ctx.message?.text) {
    prompt = ctx.message.text;
  } else if (ctx.message?.photo) {
    // grammy 自动解析媒体
    prompt = `[图片 ${ctx.message.photo.length} 张]`;
  } else if (ctx.message?.animation) {
    prompt = "[GIF]";
  } else if (ctx.message?.video) {
    prompt = "[视频]";
  } else if (ctx.message?.audio) {
    prompt = "[音频]";
  } else if (ctx.message?.voice) {
    prompt = "[语音]";
  } else if (ctx.message?.document) {
    prompt = "[文件]";
  } else {
    prompt = ctx.message?.caption || "[未知消息类型]";
  }

  // 构建 ACP prompt
  const content: acp.ContentBlock = {
    type: "text",
    text: prompt,
  };

  // 获取 ACP session
  const session = acpCtx.acpSession;

  try {
    // 发送 prompt 给 ACP agent
    const result = await session.agentInfo.connection.prompt({
      sessionId: session.agentInfo.sessionId,
      prompt: [content],
    });

    // 收集 agent 回复
    let replyText = await session.client.flush();

    // 处理 stopReason
    if (result.stopReason === "cancelled") {
      replyText += "\n[cancelled]";
    } else if (result.stopReason === "refusal") {
      replyText += "\n[agent refused to continue]";
    }

    // 发送回复给用户
    if (replyText.trim()) {
      await ctx.reply(replyText);
    }
  } catch (err) {
    await ctx.reply(`⚠️ Agent error: ${String(err)}`);
  }
}
```

- [ ] **Step 2: Build the package**

Run: `cd packages/telegram-acp && pnpm run build`
Expected: TypeScript compiles without errors

- [ ] **Step 3: Commit**

```bash
git add packages/telegram-acp/src/handlers/message.ts
git commit -m "fix: send user message to ACP agent via connection.prompt()"
```

---

### Task 2: Manual Verification

- [ ] **Step 1: Start the bot with an agent**

Run: `cd packages/telegram-acp && pnpm run start -- --agent claude --token <your-bot-token>`
Expected: Bot starts and logs "Creating new session" on first message

- [ ] **Step 2: Send a test message to the bot**

Send a message to the bot in Telegram
Expected: Bot responds with agent's reply, not empty message

---

## Success Criteria

1. TypeScript compilation passes
2. Bot receives message, sends to agent, agent replies, bot forwards reply to user
3. Error messages are sent to user if agent fails