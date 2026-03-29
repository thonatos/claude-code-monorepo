# Telegram SOCKS 代理支持实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 telegram-acp 添加 SOCKS 代理支持，通过 `--proxy` CLI 参数和 `TELEGRAM_PROXY` 环境变量配置

**Architecture:** 使用 `socks-proxy-agent` 创建 SocksProxyAgent，传入 grammy Bot 的 `client.baseFetchConfig` 选项

**Tech Stack:** grammy, socks-proxy-agent, Node.js ESM

---

## 文件结构

### 修改文件
- `packages/telegram-acp/package.json` - 添加 socks-proxy-agent 依赖
- `packages/telegram-acp/src/config.ts` - proxy 类型定义为字符串
- `packages/telegram-acp/src/bot.ts` - 添加代理配置逻辑
- `packages/telegram-acp/src/bin/telegram-acp.ts` - 读取 CLI 参数和环境变量

---

## Task 1: 添加 socks-proxy-agent 依赖

**Files:**
- Modify: `packages/telegram-acp/package.json`

- [ ] **Step 1: 添加依赖到 package.json**

```json
{
  "dependencies": {
    "grammy": "^1.41.1",
    "@agentclientprotocol/sdk": "^0.16.1",
    "socks-proxy-agent": "^8.0.0"
  }
}
```

- [ ] **Step 2: 运行 pnpm install**

```bash
cd packages/telegram-acp && pnpm install
```

Expected: 成功安装 socks-proxy-agent

- [ ] **Step 3: 验证安装**

```bash
pnpm list socks-proxy-agent
```

Expected: 显示 socks-proxy-agent@8.x.x

- [ ] **Step 4: 提交**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add socks-proxy-agent dependency"
```

---

## Task 2: 更新 config.ts 中的 proxy 类型

**Files:**
- Modify: `packages/telegram-acp/src/config.ts`

- [ ] **Step 1: 简化 proxy 类型为字符串**

将 `proxy?: ProxyConfig` 改为：

```typescript
export interface TelegramAcpConfig {
  telegram: TelegramConfig;
  proxy?: string;  // SOCKS proxy URL, e.g. socks5://user:pass@host:port
  allowedUsers?: string[];
  open?: boolean;
  // ... 其他字段保持不变
}
```

- [ ] **Step 2: 删除 parseProxyUrl 函数**

删除整个 `parseProxyUrl` 函数（不再需要）

- [ ] **Step 3: 删除 ProxyConfig 接口**（如果存在）

- [ ] **Step 4: 验证编译**

```bash
pnpm run build
```

Expected: 无 TypeScript 错误

- [ ] **Step 5: 提交**

```bash
git add src/config.ts
git commit -m "refactor: simplify proxy type to string URL"
```

---

## Task 3: 更新 bot.ts 添加代理支持

**Files:**
- Modify: `packages/telegram-acp/src/bot.ts`

- [ ] **Step 1: 添加 SocksProxyAgent 导入**

```typescript
import { Bot } from "grammy";
import { SocksProxyAgent } from "socks-proxy-agent";
// ... 其他导入
```

- [ ] **Step 2: 更新 createBot 函数**

```typescript
export function createBot(token: string, config: TelegramAcpConfig) {
  const botOptions: any = {};

  // 配置 socks 代理
  if (config.proxy) {
    const socksAgent = new SocksProxyAgent(config.proxy);
    botOptions.client = {
      baseFetchConfig: {
        agent: socksAgent,
        compress: true,
      },
    };
  }

  const bot = new Bot(token, botOptions);

  // 全局错误处理
  bot.catch((err) => {
    config.log?.(`[grammy] Error: ${err.message}`);
  });

  // 注册中间件
  bot.use(authMiddleware(config));
  bot.use(acpSessionMiddleware(config, bot));

  // 注册消息处理器
  bot.on("message", messageHandler);

  // 命令处理
  bot.command("start", (ctx) => ctx.reply("欢迎使用 Telegram ACP!"));
  bot.command("help", (ctx) => ctx.reply("帮助信息..."));
  bot.command("status", (ctx) => ctx.reply("运行中..."));

  return bot;
}
```

- [ ] **Step 3: 验证编译**

```bash
pnpm run build
```

Expected: 无 TypeScript 错误

- [ ] **Step 4: 提交**

```bash
git add src/bot.ts
git commit -m "feat: add SOCKS proxy support to grammy Bot"
```

---

## Task 4: 更新 bin/telegram-acp.ts 读取代理配置

**Files:**
- Modify: `packages/telegram-acp/src/bin/telegram-acp.ts`

- [ ] **Step 1: 在 parseArgs 中添加 proxy 参数解析**

在 `parseArgs` 函数中添加：

```typescript
case "--proxy":
  result.proxy = args[++i];
  break;
```

在返回类型中添加 `proxy?: string;`

- [ ] **Step 2: 在 main 函数中应用代理配置**

在 `defaultConfig()` 调用后添加：

```typescript
// 从 CLI 参数或环境变量读取代理配置
const proxy = args.proxy || process.env.TELEGRAM_PROXY;
if (proxy) {
  config.proxy = proxy;
}
```

- [ ] **Step 3: 验证编译**

```bash
pnpm run build
```

Expected: 无 TypeScript 错误

- [ ] **Step 4: 测试 CLI 帮助**

```bash
node dist/bin/telegram-acp.js --help
```

Expected: 显示 `--proxy <url>` 选项

- [ ] **Step 5: 提交**

```bash
git add src/bin/telegram-acp.ts
git commit -m "feat: add --proxy CLI option and TELEGRAM_PROXY env support"
```

---

## Task 5: 最终验证

- [ ] **Step 1: 完整构建**

```bash
pnpm run build
```

Expected: 无错误

- [ ] **Step 2: 测试 CLI 运行**

```bash
node dist/bin/telegram-acp.js --help
```

Expected: 显示帮助信息，包含 `--proxy` 选项

- [ ] **Step 3: 测试代理配置**

```bash
TELEGRAM_PROXY=socks5://localhost:1080 node dist/bin/telegram-acp.js --agent claude
```

Expected: Bot 启动，通过代理连接（需要有实际代理服务）

- [ ] **Step 4: 提交所有变更**

```bash
git add -A
git commit -m "chore: final cleanup for proxy support"
```

---

## 验收标准

1. `pnpm run build` 成功
2. `node dist/bin/telegram-acp.js --help` 显示 `--proxy` 选项
3. `TELEGRAM_PROXY` 环境变量生效
4. CLI `--proxy` 参数优先级高于环境变量
5. Bot 能通过 SOCKS 代理连接 Telegram API
