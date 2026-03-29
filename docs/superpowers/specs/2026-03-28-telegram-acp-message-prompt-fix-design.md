# Fix: Telegram ACP Message Not Sent to Agent

## Problem

`telegram-acp/src/handlers/message.ts` constructs the ACP prompt content but never calls `connection.prompt()` to send it to the agent. The handler directly calls `client.flush()` which returns empty because the agent hasn't received any message.

## Root Cause Analysis

Comparing with `wechat-acp/src/acp/session.ts:167`, the correct flow is:
1. Build `ContentBlock` from user message
2. Call `connection.prompt({ sessionId, prompt })` to send to agent
3. Call `client.flush()` to collect accumulated response
4. Send reply to user

The telegram-acp implementation skips step 2 entirely.

## Solution

Add the missing `connection.prompt()` call in `message.ts`.

## Implementation Details

**File:** `packages/telegram-acp/src/handlers/message.ts`

**Changes:**

Replace the current flush-and-reply block with:

```typescript
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
```

**No other files are modified.**

## Out of Scope

- Adding typing indicator support
- Adding message queue processing
- Refactoring session.ts to wechat-acp pattern
- Adding error recovery or agent restart logic

## Success Criteria

1. User sends message to Telegram bot
2. Bot forwards message to ACP agent via `connection.prompt()`
3. Agent processes message and returns response
4. Bot sends response back to user in Telegram