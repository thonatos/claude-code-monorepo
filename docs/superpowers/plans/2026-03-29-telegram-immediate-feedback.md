# telegram-acp Immediate Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add immediate feedback (reaction + typing) when users send messages to telegram-acp.

**Architecture:** Modify the message handler in bot.ts to add reactions and typing action before ACP processing. Reactions progress through a lifecycle: 👀 (receipt) → 🤔/⚡ (processing) → cleared (done).

**Tech Stack:** grammy Telegram Bot API, TypeScript

---

## File Structure

**Modify:**
- `packages/telegram-acp/src/bot.ts` - Add `isMediaMessage` helper and update `messageHandler`

---

### Task 1: Add isMediaMessage helper function

**Files:**
- Modify: `packages/telegram-acp/src/bot.ts` (after `extractPrompt` function)

- [ ] **Step 1: Add the helper function after extractPrompt**

Add this function after `extractPrompt` (around line 154):

```typescript
function isMediaMessage(ctx: Context): boolean {
  const msg = ctx.message;
  return !!msg?.photo || !!msg?.video || !!msg?.audio
    || !!msg?.document || !!msg?.animation;
}
```

- [ ] **Step 2: Build to verify TypeScript compiles**

Run: `cd packages/telegram-acp && pnpm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit helper function**

```bash
git add packages/telegram-acp/src/bot.ts
git commit -m "feat(telegram-acp): add isMediaMessage helper for feedback feature"
```

---

### Task 2: Add immediate feedback in messageHandler

**Files:**
- Modify: `packages/telegram-acp/src/bot.ts:99-140` (messageHandler function)

- [ ] **Step 1: Add immediate reaction and typing on receipt**

Replace the start of `messageHandler` (lines 99-115) with:

```typescript
async function messageHandler(ctx: Context) {
  const acpCtx = ctx as AcpContext;
  const userId = ctx.from?.id.toString();

  if (!userId) return;

  // 1. Immediate feedback on receipt
  try {
    await ctx.react({ type: 'emoji', emoji: '👀' });
    await ctx.sendChatAction('typing');
  } catch {
    // Best-effort - don't block if fails
  }

  // 2. Extract message content
  const prompt = extractPrompt(ctx);
  const isMedia = isMediaMessage(ctx);

  // 3. Update reaction based on content type
  try {
    await ctx.react({ type: 'emoji', emoji: isMedia ? '⚡' : '🤔' });
  } catch {
    // Best-effort
  }

  // Build ACP prompt
  const content: acp.ContentBlock = {
    type: "text",
    text: prompt,
  };

  const session = acpCtx.session;
```

- [ ] **Step 2: Build to verify TypeScript compiles**

Run: `cd packages/telegram-acp && pnpm run build`
Expected: Build succeeds with no errors

---

### Task 3: Update reply section to clear reaction

**Files:**
- Modify: `packages/telegram-acp/src/bot.ts` (remaining part of messageHandler)

- [ ] **Step 1: Wrap the ACP processing with reaction clearing**

Replace the try-catch block in messageHandler (starting around line 116) with:

```typescript
  try {
    // 4. Send prompt to ACP agent
    const result = await session.connection.prompt({
      sessionId: session.sessionId,
      prompt: [content],
    });

    // Collect agent reply
    let replyText = await session.client.flush();

    // Handle stop reasons
    if (result.stopReason === "cancelled") {
      replyText += "\n[cancelled]";
    } else if (result.stopReason === "refusal") {
      replyText += "\n[agent refused]";
    }

    // 5. Clear reaction + send reply
    try {
      await ctx.react([]); // Clear reaction
    } catch {}
    if (replyText.trim()) {
      await ctx.reply(formatForTelegram(replyText));
    }
  } catch (err) {
    try {
      await ctx.react([]); // Clear reaction on error
    } catch {}
    await ctx.reply(`⚠️ Error: ${String(err)}`);
  }
}
```

- [ ] **Step 2: Build to verify TypeScript compiles**

Run: `cd packages/telegram-acp && pnpm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit complete messageHandler changes**

```bash
git add packages/telegram-acp/src/bot.ts
git commit -m "feat(telegram-acp): add immediate reaction and typing feedback

Reaction lifecycle: 👀 on receipt → 🤔 for text/⚡ for media → cleared after reply

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Manual verification

**Files:**
- Test: Manual Telegram bot testing

- [ ] **Step 1: Start the bot with test agent**

Run: `cd packages/telegram-acp && pnpm run build && npx telegram-acp --agent echo`

(Use a simple echo agent or mock for testing)

- [ ] **Step 2: Send text message and verify reaction lifecycle**

Send a text message to the bot.
Expected:
1. 👀 reaction appears immediately
2. Updates to 🤔 quickly
3. Clears after reply arrives

- [ ] **Step 3: Send photo and verify media reaction**

Send a photo to the bot.
Expected:
1. 👀 reaction appears immediately
2. Updates to ⚡
3. Clears after reply arrives

- [ ] **Step 4: Send voice message**

Send a voice note to the bot.
Expected:
1. 👀 reaction appears immediately
2. Updates to 🤔 (voice treated as text-like)
3. Clears after reply arrives

---

## Self-Review Checklist

**Spec coverage:**
- [x] Reaction lifecycle: 👀 → 🤔/⚡ → cleared (Task 2, Task 3)
- [x] Typing action (Task 2)
- [x] isMediaMessage helper (Task 1)
- [x] Error handling clears reaction (Task 3)
- [x] Manual testing plan (Task 4)

**Placeholder scan:**
- [x] No TBD/TODO
- [x] All code shown inline
- [x] All commands specified

**Type consistency:**
- [x] `isMediaMessage(ctx: Context): boolean` - matches usage
- [x] `ctx.react()` grammy API - correct
- [x] `ctx.sendChatAction('typing')` grammy API - correct