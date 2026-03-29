# Telegram Grammy 迁移实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 telegram-acp 从 telegram 包迁移到 grammy 框架，利用中间件系统重构消息处理流程

**Architecture:** 使用 grammy 的 Bot + 中间件模式替代手动事件轮询，保留 ACP 会话管理核心逻辑

**Tech Stack:** grammy v1.41.1, TypeScript ES Modules, Node.js ESM

---

## 文件结构

### 新建文件
- `src/bot.ts` — grammy Bot 实例创建 + 中间件注册
- `src/middleware/auth.ts` — 用户权限验证中间件
- `src/middleware/acp-session.ts` — ACP 会话注入中间件
- `src/handlers/message.ts` — 消息处理器

### 重构文件
- `src/acp/session.ts` — 简化 SessionManager（基于 Map 的轻量实现）
- `src/bridge.ts` — 改为调用 grammy bot.start()
- `src/bin/telegram-acp.ts` — 更新启动逻辑

### 删除文件
- `src/telegram/client.ts`
- `src/telegram/monitor.ts`
- `src/telegram/send.ts`
- `src/telegram/auth.ts`
- `src/telegram/download.ts`
- `src/adapter/inbound.ts`

### 保留文件
- `src/config.ts`
- `src/acp/agent-manager.ts`
- `src/acp/client.ts`
- `src/adapter/outbound.ts`
- `src/telegram/types.ts`

---

## Chunk 1: 基础设置与 grammy 安装

### Task 1: 安装 grammy 依赖

**Files:**
- Modify: `packages/telegram-acp/package.json`

- [ ] **Step 1: 修改 package.json 依赖**

将 `telegram` 替换为 `grammy`:

```json
{
  "dependencies": {
    "grammy": "^1.41.1",
    "@agentclientprotocol/sdk": "^0.16.1"
  }
}
```

- [ ] **Step 2: 安装依赖**

```bash
cd packages/telegram-acp && npm install
```

Expected: grammy 安装成功，无冲突

- [ ] **Step 3: 验证安装**

```bash
npm list grammy
```

Expected: 显示 grammy@1.41.1

- [ ] **Step 4: 提交**

```bash
git add package.json package-lock.json
git commit -m "chore: replace telegram with grammy"
```

---

### Task 2: 创建简化版 SessionManager

**Files:**
- Modify: `packages/telegram-acp/src/acp/session.ts`

- [ ] **Step 1: 阅读现有 session.ts**

```bash
cat src/acp/session.ts
```

- [ ] **Step 2: 重写为基于 Map 的轻量实现**

保留核心接口：`get()`, `create()`, `touch()`, `cleanup()`, `evictOldest()`

- [ ] **Step 3: 验证编译**

```bash
npm run build
```

Expected: 无 TypeScript 错误

- [ ] **Step 4: 提交**

```bash
git add src/acp/session.ts
git commit -m "refactor: simplify SessionManager to Map-based implementation"
```

---

## Chunk 2: grammy 中间件创建

### Task 3: 创建 auth 中间件

**Files:**
- Create: `packages/telegram-acp/src/middleware/auth.ts`

- [ ] **Step 1: 创建 middleware 目录**

```bash
mkdir -p src/middleware
```

- [ ] **Step 2: 创建 auth.ts**

```typescript
import { Context } from "grammy";
import type { TelegramAcpConfig } from "../config.js";

export function authMiddleware(config: TelegramAcpConfig) {
  return async (ctx: Context, next: () => Promise<void>) => {
    const userId = ctx.from?.id.toString();

    // open 模式：任何用户都允许
    if (config.telegram.open) {
      return next();
    }

    // 检查 allowedUsers
    if (!config.allowedUsers?.includes(userId!)) {
      config.log?.(`[auth] Blocked user ${userId}`);
      return; // 阻止后续处理
    }

    await next();
  };
}
```

- [ ] **Step 3: 验证编译**

```bash
npm run build
```

Expected: 无 TypeScript 错误

- [ ] **Step 4: 提交**

```bash
git add src/middleware/auth.ts
git commit -m "feat: add auth middleware"
```

---

### Task 4: 创建 acp-session 中间件

**Files:**
- Create: `packages/telegram-acp/src/middleware/acp-session.ts`

- [ ] **Step 1: 创建 acp-session.ts**

```typescript
import { Context } from "grammy";
import { AcpSessionManager, type AcpSession } from "../acp/session.js";
import type { TelegramAcpConfig } from "../config.js";
import { sendTextMessage } from "../adapter/outbound.js";
import type { TelegramClient } from "telegram";

// 扩展 Context 类型
export interface AcpContext extends Context {
  acpSession: AcpSession;
}

export function acpSessionMiddleware(config: TelegramAcpConfig, client: any) {
  const sessionManager = new AcpSessionManager({
    maxConcurrentUsers: config.session.maxConcurrentUsers,
    idleTimeoutMs: config.session.idleTimeoutMs,
    log: config.log,
    onReply: async (userId: string, text: string) => {
      const formatted = formatForTelegram(text);
      await sendTextMessage(client, userId, formatted);
    },
  });

  return async (ctx: Context, next: () => Promise<void>) => {
    const userId = ctx.from!.id.toString();

    // 获取或创建 ACP 会话
    let session = sessionManager.get(userId);
    if (!session) {
      session = await sessionManager.create(userId);
    }

    // 重置 idle timer
    sessionManager.touch(userId);

    // 注入到上下文
    (ctx as AcpContext).acpSession = session;

    await next();
  };
}
```

- [ ] **Step 2: 验证编译**

```bash
npm run build
```

Expected: 无 TypeScript 错误

- [ ] **Step 3: 提交**

```bash
git add src/middleware/acp-session.ts
git commit -m "feat: add ACP session middleware"
```

---

### Task 5: 创建 message 处理器

**Files:**
- Create: `packages/telegram-acp/src/handlers/message.ts`

- [ ] **Step 1: 创建 handlers 目录**

```bash
mkdir -p src/handlers
```

- [ ] **Step 2: 创建 message.ts**

```typescript
import { Context } from "grammy";
import { AcpContext } from "../middleware/acp-session.js";
import { telegramMessageToPrompt } from "../adapter/inbound.js";

export async function messageHandler(ctx: Context) {
  const acpCtx = ctx as AcpContext;
  const userId = ctx.from!.id.toString();

  // 提取消息内容
  let prompt: string;

  if (ctx.has("text")) {
    prompt = ctx.message.text;
  } else if (ctx.has("photo")) {
    // grammy 自动解析媒体
    const files = await ctx.getFiles();
    prompt = `[图片 ${files.length} 张]`;
  } else {
    prompt = ctx.message?.caption || "[未知消息类型]";
  }

  // 发送到 ACP
  const reply = await acpCtx.acpSession.enqueue(prompt);

  // 回复到 Telegram
  await ctx.reply(reply);
}
```

- [ ] **Step 3: 验证编译**

```bash
npm run build
```

Expected: 无 TypeScript 错误

- [ ] **Step 4: 提交**

```bash
git add src/handlers/message.ts
git commit -m "feat: add message handler"
```

---

## Chunk 3: Bot 创建与集成

### Task 6: 创建 bot.ts

**Files:**
- Create: `packages/telegram-acp/src/bot.ts`

- [ ] **Step 1: 创建 bot.ts**

```typescript
import { Bot } from "grammy";
import { authMiddleware } from "./middleware/auth.js";
import { acpSessionMiddleware } from "./middleware/acp-session.js";
import { messageHandler } from "./handlers/message.js";
import type { TelegramAcpConfig } from "./config.js";
import type { TelegramClient } from "telegram";

export function createBot(token: string, config: TelegramAcpConfig, client: TelegramClient) {
  const bot = new Bot(token);

  // 全局错误处理
  bot.catch((err) => {
    config.log?.(`[grammy] Error: ${err.message}`);
  });

  // 注册中间件
  bot.use(authMiddleware(config));
  bot.use(acpSessionMiddleware(config, client));

  // 注册消息处理器
  bot.on("message", messageHandler);

  // 命令处理
  bot.command("start", (ctx) => ctx.reply("欢迎使用 Telegram ACP!"));
  bot.command("help", (ctx) => ctx.reply("帮助信息..."));
  bot.command("status", (ctx) => ctx.reply("运行中..."));

  return bot;
}

export async function startBot(bot: Bot): Promise<void> {
  await bot.start();
}

export async function stopBot(bot: Bot): Promise<void> {
  await bot.stop();
}
```

- [ ] **Step 2: 验证编译**

```bash
npm run build
```

Expected: 无 TypeScript 错误

- [ ] **Step 3: 提交**

```bash
git add src/bot.ts
git commit -m "feat: create grammy Bot wrapper"
```

---

### Task 7: 更新 bridge.ts

**Files:**
- Modify: `packages/telegram-acp/src/bridge.ts`

- [ ] **Step 1: 阅读现有 bridge.ts**

- [ ] **Step 2: 重构为使用 grammy**

移除 `TelegramClientWrapper`, `startMonitor`, 改用 `createBot`, `startBot`

- [ ] **Step 3: 验证编译**

```bash
npm run build
```

- [ ] **Step 4: 提交**

```bash
git add src/bridge.ts
git commit -m "refactor: update bridge to use grammy"
```

---

### Task 8: 更新 CLI 入口

**Files:**
- Modify: `packages/telegram-acp/src/bin/telegram-acp.ts`

- [ ] **Step 1: 更新导入**

将旧的 telegram 导入改为 grammy

- [ ] **Step 2: 验证编译**

```bash
npm run build
```

- [ ] **Step 3: 测试 CLI**

```bash
node dist/bin/telegram-acp.js --help
```

Expected: 显示帮助信息

- [ ] **Step 4: 提交**

```bash
git add src/bin/telegram-acp.ts
git commit -m "refactor: update CLI for grammy"
```

---

## Chunk 4: 清理与验证

### Task 9: 删除旧文件

**Files:**
- Delete: `packages/telegram-acp/src/telegram/client.ts`
- Delete: `packages/telegram-acp/src/telegram/monitor.ts`
- Delete: `packages/telegram-acp/src/telegram/send.ts`
- Delete: `packages/telegram-acp/src/telegram/auth.ts`
- Delete: `packages/telegram-acp/src/telegram/download.ts`
- Delete: `packages/telegram-acp/src/adapter/inbound.ts`

- [ ] **Step 1: 删除文件**

```bash
rm src/telegram/client.ts src/telegram/monitor.ts src/telegram/send.ts src/telegram/auth.ts src/telegram/download.ts src/adapter/inbound.ts
```

- [ ] **Step 2: 验证编译**

```bash
npm run build
```

Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "chore: remove legacy telegram files"
```

---

### Task 10: 最终验证

- [ ] **Step 1: 完整构建**

```bash
npm run build
```

- [ ] **Step 2: 检查输出**

```bash
head -20 dist/src/bot.js
```

Expected: 包含 grammy 导入

- [ ] **Step 3: 提交最终代码**

```bash
git add -A
git commit -m "chore: final cleanup"
```

---

## 验收标准

1. `npm run build` 成功
2. 所有旧文件已删除
3. 新中间件文件存在且编译通过
4. CLI 能正常启动
