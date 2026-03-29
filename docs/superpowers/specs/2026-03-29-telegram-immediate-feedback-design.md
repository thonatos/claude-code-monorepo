# telegram-acp Immediate Feedback Design

**Date**: 2026-03-29
**Status**: Approved
**Scope**: telegram-acp package

## Problem

When a user sends a message to telegram-acp, there is no immediate feedback. The bot waits for the full ACP agent response before sending any reply. This creates a poor user experience - users don't know if their message was received or is being processed.

## Solution

Add immediate feedback on message receipt using two mechanisms:
1. **Reaction** - emoji reaction on the user's message
2. **Typing action** - "typing..." status in chat header

## Reaction Lifecycle

| Event | Action | Emoji |
|-------|--------|-------|
| Message received | Add reaction | 👀 |
| Processing starts (text/voice) | Update reaction | 🤔 |
| Processing starts (media) | Update reaction | ⚡ |
| Reply sent | Clear reaction | - |

**Content type classification**:
- Text/Voice → 🤔 (thinking)
- Media (photo/video/audio/document/GIF) → ⚡ (processing)

## Typing Action

- Send `ctx.sendChatAction('typing')` immediately on message receipt
- Automatically stops when reply message is sent

## Implementation

### Changes to `packages/telegram-acp/src/bot.ts`

**messageHandler function** - add immediate feedback before ACP processing:

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
  const content: acp.ContentBlock = { type: 'text', text: prompt };

  // 3. Update reaction based on content type
  const isMedia = isMediaMessage(ctx);
  try {
    await ctx.react({ type: 'emoji', emoji: isMedia ? '⚡' : '🤔' });
  } catch {
    // Best-effort
  }

  // 4. Send prompt to ACP agent (existing logic)
  const session = acpCtx.session;
  try {
    const result = await session.connection.prompt({
      sessionId: session.sessionId,
      prompt: [content],
    });

    let replyText = await session.client.flush();
    if (result.stopReason === 'cancelled') replyText += '\n[cancelled]';
    if (result.stopReason === 'refusal') replyText += '\n[agent refused]';

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

**New helper function**:

```typescript
function isMediaMessage(ctx: Context): boolean {
  const msg = ctx.message;
  return !!msg?.photo || !!msg?.video || !!msg?.audio
    || !!msg?.document || !!msg?.animation;
}
```

## Error Handling

- All reaction/typing operations are best-effort
- If they fail, log and continue with normal message processing
- Clear reaction on both success and error paths

## Testing Plan

Manual testing:
1. Send text message → verify 👀 → 🤔 → cleared
2. Send photo → verify 👀 → ⚡ → cleared
3. Send voice → verify 👀 → 🤔 → cleared
4. Send document → verify 👀 → ⚡ → cleared
5. Test error case → verify reaction cleared

## Scope Constraints

- Single file change: `bot.ts`
- No changes to session management or ACP logic
- No configuration options - fixed emoji mapping