# telegram-acp Continuous Typing Design

**Date**: 2026-03-29
**Status**: Approved
**Scope**: telegram-acp package

## Problem

Telegram typing action expires after ~5 seconds. ACP processing can take longer, leaving users without visual feedback during long operations.

## Solution

Adopt wechat-acp's event-driven + throttled approach: trigger typing on each ACP session update, throttle to prevent excessive API calls.

## Implementation

### Changes to `packages/telegram-acp/src/client.ts`

Add `sendTyping` callback and throttle logic (same pattern as wechat-acp):

```typescript
export interface TelegramAcpClientOpts {
  sendTyping: () => Promise<void>;  // NEW
  onThoughtFlush: (text: string) => Promise<void>;
  log: (msg: string) => void;
  showThoughts: boolean;
}

export class TelegramAcpClient implements acp.Client {
  private lastTypingAt = 0;  // NEW
  private static readonly TYPING_INTERVAL_MS = 5_000;  // NEW

  // In sessionUpdate, call maybeSendTyping() after each event
  async sessionUpdate(params) {
    switch (update.sessionUpdate) {
      case "agent_message_chunk":
        await this.maybeSendTyping();  // NEW
        ...
      case "tool_call":
        await this.maybeSendTyping();  // NEW
        ...
      case "agent_thought_chunk":
        await this.maybeSendTyping();  // NEW
        ...
    }
  }

  private async maybeSendTyping(): Promise<void> {  // NEW
    const now = Date.now();
    if (now - this.lastTypingAt < TelegramAcpClient.TYPING_INTERVAL_MS) return;
    this.lastTypingAt = now;
    try {
      await this.opts.sendTyping();
    } catch {}
  }
}
```

### Changes to `packages/telegram-acp/src/session.ts`

Pass `sendTyping` callback to client:

```typescript
export interface SessionManagerOpts {
  ...
  sendTyping: (userId: string) => Promise<void>;  // NEW
}

// In getOrCreate, pass to client:
const client = new TelegramAcpClient({
  sendTyping: () => this.opts.sendTyping(userId),  // NEW
  onThoughtFlush: (text) => this.opts.onReply(userId, text),
  ...
});
```

### Changes to `packages/telegram-acp/src/bridge.ts`

Pass `sendTyping` callback to session manager:

```typescript
this.sessionManager = new SessionManager({
  ...
  sendTyping: (userId) => this.sendTypingIndicator(userId),  // NEW
});

private async sendTypingIndicator(userId: string): Promise<void> {
  // Need to track chatId per user - store in session or map
}
```

### Changes to `packages/telegram-acp/src/bot.ts`

On message receipt, store chatId for later typing calls. Pass typing callback through session middleware.

## Notes

- Typing is best-effort: failures don't block processing
- Throttle interval 5s matches wechat-acp and Telegram's typing expiry
- Need to track chatId per user since typing API requires chatId