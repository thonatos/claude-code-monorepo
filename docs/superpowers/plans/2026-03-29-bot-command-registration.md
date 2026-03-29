# Bot Command Registration Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `startBot` to register commands inside `onStart` callback with proper scope and mandatory success, adding 409 Conflict retry logic.

**Architecture:** Move command registration from before `bot.start()` into the `onStart` callback, add scope for private chats only, implement retry loop for 409 Conflict errors with exponential backoff.

**Tech Stack:** grammy, TypeScript, Telegram Bot API

---

## Files

| Action | File | Purpose |
|--------|------|---------|
| Modify | `packages/telegram-acp/src/bot.ts:312-323` | Refactor `startBot` function |
| Modify | `packages/telegram-acp/src/bot.ts:1-9` | Add `GrammyError` import |

---

### Task 1: Refactor startBot function

**Files:**
- Modify: `packages/telegram-acp/src/bot.ts`

- [ ] **Step 1: Add GrammyError import**

Add `GrammyError` to the existing grammy import at line 5:

```typescript
import { Bot, Context, GrammyError } from "grammy";
```

- [ ] **Step 2: Replace startBot function (lines 312-327)**

Replace the entire `startBot` function with the new implementation:

```typescript
// --- Bot lifecycle ---
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

export async function stopBot(bot: Bot): Promise<void> {
  await bot.stop();
}
```

- [ ] **Step 3: Build and verify compilation**

Run: `cd packages/telegram-acp && pnpm run build`
Expected: Build succeeds without errors

- [ ] **Step 4: Commit changes**

```bash
git add packages/telegram-acp/src/bot.ts
git commit -m "$(cat <<'EOF'
fix(bot): register commands in onStart with scope and retry logic

- Move setMyCommands into bot.start onStart callback
- Add scope: all_private_chats to limit commands to private chats
- Add 409 Conflict retry with exponential backoff (max 3 attempts)
- Remove silent failure handling, errors now block startup

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Manual verification

- [ ] **Step 1: Start bot and verify commands**

Run: `cd packages/telegram-acp && pnpm run start -- --preset claude`
Expected: Bot starts, stderr shows "polling as @<username>"

- [ ] **Step 2: Verify commands in Telegram UI**

In private chat with bot:
- Check command menu shows: start, help, status, restart, clear
- Verify commands work correctly

- [ ] **Step 3: Verify commands NOT in group chats (if applicable)**

If bot is added to a group:
- Verify command menu does NOT appear in group chat