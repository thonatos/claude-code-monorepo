# Telegram Grammy 迁移设计文档

**日期**: 2026-03-28
**状态**: 已批准

## 1. 概述

将 `telegram-acp` 项目从 `telegram` npm 包迁移到 `grammy` 框架，利用 grammy 的中间件系统重构消息处理流程。

### 1.1 迁移动机

- `grammy` 专为 Telegram Bot 场景设计，API 更简洁
- 完整的 TypeScript 类型支持，无需 `@ts-ignore`
- 中间件系统提供更好的代码组织和可扩展性
- 内置错误处理、轮询、session 管理

### 1.2 约束条件

- 仅使用 Bot Token 认证（grammy 不支持用户账号登录）
- 保留 ACP 会话管理核心逻辑
- 保留并发控制（maxConcurrentUsers、idleTimeout）

---

## 2. 架构设计

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────┐
│                      bot.start()                        │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   grammy Bot                            │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Error Boundary (bot.catch)                 │
│          全局捕获所有未处理错误，记录日志                  │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│           [1] authMiddleware                            │
│   - 检查 allowedUsers / open 模式                        │
│   - 非授权用户直接返回，不继续处理                        │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│           [2] acpSessionMiddleware                      │
│   - 根据 userId 获取/创建 ACP 会话                        │
│   - 注入 ctx.acpSession                                 │
│   - 实现 idleTimeout 和 maxConcurrentUsers              │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│           [3] messageHandler                            │
│   - 解析消息 (文本/媒体)                                  │
│   - 调用 ctx.acpSession.enqueue()                       │
│   - 发送回复到 Telegram                                 │
└─────────────────────────────────────────────────────────┘
```

### 2.2 核心组件

#### 2.2.1 `bot.ts` — Bot 实例创建

```typescript
import { Bot } from "grammy";
import { authMiddleware } from "./middleware/auth.js";
import { acpSessionMiddleware } from "./middleware/acp-session.js";
import { messageHandler } from "./handlers/message.js";

export function createBot(token: string, config: Config) {
  const bot = new Bot(token);

  // 全局错误处理
  bot.catch((err) => {
    config.log(`[grammy] Error: ${err.message}`);
  });

  // 注册中间件
  bot.use(authMiddleware(config));
  bot.use(acpSessionMiddleware(config));

  // 注册消息处理器
  bot.on("message", messageHandler);

  // 命令处理
  bot.command("start", (ctx) => ctx.reply("欢迎使用!"));
  bot.command("help", (ctx) => ctx.reply("帮助信息..."));

  return bot;
}
```

#### 2.2.2 `middleware/auth.ts` — 权限验证

- 检查 `allowedUsers` 配置
- 支持 `open` 模式（允许任意用户）
- 非授权用户直接阻断，不继续处理

#### 2.2.3 `middleware/acp-session.ts` — ACP 会话注入

- 根据 `userId` 获取/创建 ACP 会话
- 实现 `idleTimeout` 自动清理
- 实现 `maxConcurrentUsers` 并发限制
- 扩展 `Context` 类型，注入 `ctx.acpSession`

#### 2.2.4 `handlers/message.ts` — 消息处理

- 使用 grammy 自动解析的消息 (`ctx.message`)
- 支持文本、图片、媒体等多种类型
- 调用 `ctx.acpSession.enqueue()` 发送到 ACP
- 使用 `ctx.reply()` 发送回复

#### 2.2.5 `acp/session.ts` — 简化版 SessionManager

- 基于 `Map<string, AcpSession>` 的轻量实现
- 保留 `idleTimeoutMs` 和 `maxConcurrentUsers` 配置
- 提供 `get()`, `create()`, `touch()`, `cleanup()` 接口

---

## 3. 文件结构

```
packages/telegram-acp/
├── src/
│   ├── index.ts                  # 包入口
│   ├── bot.ts                    # grammy Bot 创建 [新建]
│   ├── config.ts                 # 配置 [保留]
│   ├── middleware/
│   │   ├── auth.ts               # 权限验证 [新建]
│   │   └── acp-session.ts        # ACP 会话注入 [新建]
│   ├── handlers/
│   │   └── message.ts            # 消息处理 [新建]
│   ├── acp/
│   │   ├── session.ts            # 简化版 SessionManager [重构]
│   │   ├── agent-manager.ts      # Agent 进程管理 [保留]
│   │   └── client.ts             # ACP 客户端 [保留]
│   └── adapter/
│       └── outbound.ts           # ACP → Telegram 格式化 [保留]
├── package.json                  # 添加 grammy 依赖
└── tsconfig.json
```

### 3.1 删除的文件

以下文件在迁移后删除：

- `src/telegram/client.ts` — grammy 内置连接管理
- `src/telegram/monitor.ts` — grammy 内置轮询
- `src/telegram/send.ts` — grammy `ctx.reply()` 替代
- `src/telegram/auth.ts` — Bot Token 无需 session 管理
- `src/telegram/download.ts` — grammy `ctx.getFile()` 替代
- `src/adapter/inbound.ts` — grammy 自动解析消息

---

## 4. 依赖变更

```json
{
  "dependencies": {
    "grammy": "^1.41.1",
    "@agentclientprotocol/sdk": "^0.16.1"
  }
}
```

移除：`telegram` (^2.24.18)

---

## 5. 迁移步骤

1. **安装 grammy** — `npm install grammy`
2. **创建 `bot.ts`** — Bot 实例 + 中间件注册
3. **创建中间件** — `auth.ts`、`acp-session.ts`
4. **创建处理器** — `message.ts`
5. **简化 `session.ts`** — 移除复杂逻辑
6. **更新 `bridge.ts`** — 改为调用 `bot.start()`
7. **删除旧文件** — `client.ts`、`monitor.ts`、`send.ts`、`auth.ts`、`download.ts`
8. **测试** — 验证消息接收、ACP 处理、回复发送

---

## 6. 验收标准

1. `npm run build` 成功，无 TypeScript 错误
2. `bot.start()` 成功启动轮询
3. 授权用户发送消息能触发 ACP 处理
4. 非授权用户消息被阻断
5. ACP 回复正确发送到 Telegram
6. `idleTimeout` 自动清理空闲会话
7. `maxConcurrentUsers` 限制生效

---

## 7. 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| grammy 不支持某些 `telegram` 包的底层 API | 评估当前功能，确认仅使用 Bot API |
| 迁移后行为不一致 | 编写集成测试，对比行为 |
| 媒体处理逻辑差异 | 使用 grammy `ctx.getFile()` 重写 |

---

## 8. 未来扩展

- 使用 `@grammyjs/conversations` 实现多轮对话
- 使用 `@grammyjs/ratelimiter` 实现更精细的限流
- 使用 `Composer` 模块化支持群聊、频道等场景
- 添加 `/start`、`/help` 等命令处理
