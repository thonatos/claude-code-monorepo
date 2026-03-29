# Telegram Bot Commands UI Registration

**Date:** 2026-03-29
**Status:** Approved

## Problem

Commands (`/start`, `/help`, `/status`, `/restart`, `/clear`) have handlers registered via `bot.command()` but are not visible in Telegram's command menu when user types `/`.

## Root Cause

`bot.command()` only registers handler logic. Telegram's UI command menu requires explicit API call via `setMyCommands()`.

## Solution

Add `bot.api.setMyCommands()` call in `startBot()` function before `bot.start()`.

## Implementation

**File:** `packages/telegram-acp/src/bot.ts`
**Location:** `startBot()` function (line 266-268)

```typescript
export async function startBot(bot: Bot): Promise<void> {
  // Register commands to Telegram UI menu
  await bot.api.setMyCommands([
    { command: "start", description: "Create or restore session" },
    { command: "help", description: "Show available commands" },
    { command: "status", description: "Show session details" },
    { command: "restart", description: "Restart session" },
    { command: "clear", description: "Clear conversation history" },
  ]);

  await bot.start();
}
```

## Impact

- Users see command suggestions when typing `/` in Telegram
- No breaking changes
- No new dependencies