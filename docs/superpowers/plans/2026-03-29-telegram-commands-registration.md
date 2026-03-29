# Telegram Commands UI Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register bot commands to Telegram UI menu so users see suggestions when typing `/`

**Architecture:** Add `bot.api.setMyCommands()` call in `startBot()` before `bot.start()`. Direct API call, no new dependencies.

**Tech Stack:** grammy Bot API, TypeScript

---

## File Structure

**Modify:**
- `packages/telegram-acp/src/bot.ts` — Add command registration in `startBot()` function

---

### Task 1: Add setMyCommands Call

**Files:**
- Modify: `packages/telegram-acp/src/bot.ts:266-268`

- [ ] **Step 1: Add command registration code**

Edit `startBot()` function:

```typescript
// --- Bot lifecycle ---
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

- [ ] **Step 2: Build to verify TypeScript compilation**

Run: `cd packages/telegram-acp && pnpm run build`
Expected: Exit code 0, no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add packages/telegram-acp/src/bot.ts
git commit -m "feat: register bot commands to Telegram UI menu"
```

---

## Verification

After deployment, verify by:
1. Start bot with `pnpm --filter telegram-acp run start -- --preset claude`
2. In Telegram, type `/` — should see command list with descriptions
3. Commands should match: start, help, status, restart, clear