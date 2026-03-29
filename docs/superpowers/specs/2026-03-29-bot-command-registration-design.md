# Bot Command Registration Optimization Design

**Date:** 2026-03-29
**Status:** Draft

## Problem

The current `startBot` function in `packages/telegram-acp/src/bot.ts` has three issues:

1. **Race condition:** Commands are registered via `await bot.api.setMyCommands()` before `await bot.start()`, potentially calling Telegram API before the bot is ready.

2. **Missing scope:** Commands have no scope specified, causing them to potentially appear in group chats where they shouldn't.

3. **Silent failure:** The reference implementation uses `.catch(() => {})` to silently ignore command registration failures, but the user wants failures to block startup.

## Solution

Refactor `startBot` to register commands inside the `onStart` callback, with proper scope and mandatory success.

### Architecture

```typescript
import { GrammyError } from "grammy";

export async function startBot(bot: Bot): Promise<void> {
  const COMMANDS = [
    { command: "start", description: "Create or restore session" },
    { command: "help", description: "Show available commands" },
    { command: "status", description: "Show session details" },
    { command: "restart", description: "Restart session" },
    { command: "clear", description: "Clear conversation history" },
  ];
  const SCOPE = { type: "all_private_chats" };

  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await bot.start({
        onStart: async (info) => {
          process.stderr.write(`telegram channel: polling as @${info.username}\n`);
          await bot.api.setMyCommands(COMMANDS, { scope: SCOPE });
        },
      });
      return; // Clean exit (bot.stop() was called)
    } catch (err) {
      // 409 Conflict: another instance polling → retry with backoff
      if (err instanceof GrammyError && err.error_code === 409) {
        const delay = Math.min(1000 * attempt, 15000);
        const detail = attempt === 1
          ? " — another instance is polling"
          : "";
        process.stderr.write(
          `telegram channel: 409 Conflict${detail}, retrying in ${delay / 1000}s\n`
        );
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      // "Aborted delay": bot.stop() called mid-setup → clean exit
      if (err instanceof Error && err.message === "Aborted delay") {
        return;
      }

      // Other errors (including command registration failure) → stop and throw
      try { await bot.stop(); } catch {}
      throw err;
    }
  }

  throw new Error(`Failed to start bot after ${maxAttempts} attempts`);
}
```

### Key Changes

1. **Command registration timing:** Moved from before `bot.start()` to inside `onStart` callback, ensuring bot is ready before API calls.

2. **Scope specification:** Added `{ scope: { type: "all_private_chats" } }` to limit commands to private chats only.

3. **Mandatory success:** No `.catch(() => {})` — if `setMyCommands` fails, `onStart` throws, `bot.start()` rejects, and we stop the bot and throw.

4. **409 Conflict retry:** Added retry loop with exponential backoff (1s → 2s → 3s, capped at 15s), max 3 attempts.

### Error Handling Matrix

| Error Type | Handling |
|------------|----------|
| 409 Conflict | Retry with backoff (max 3 attempts) |
| "Aborted delay" | Clean exit (user called `bot.stop()`) |
| Command registration failure | Stop bot, throw error |
| Other errors | Stop bot, throw error |

## Files Changed

- `packages/telegram-acp/src/bot.ts`: Refactor `startBot` function (lines 312-323)

## Testing

Manual testing via:
```bash
cd packages/telegram-acp
pnpm run start -- --preset claude
```

Verify:
1. Bot starts and commands appear in private chat menu
2. Commands do NOT appear in group chats
3. 409 Conflict shows retry messages in stderr
4. Command registration failure prevents startup