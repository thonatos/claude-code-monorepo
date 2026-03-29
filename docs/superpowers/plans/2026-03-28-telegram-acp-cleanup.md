# Telegram ACP 遗留代码清理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 清理 telegram-acp 从 MTProto 迁移到 grammy 后遗留的用户账号登录相关代码

**Architecture:** 删除无用文件（storage.ts, package-lock.json），简化配置结构（移除 apiId/apiHash/sessionString），更新文档

**Tech Stack:** TypeScript, grammy, pnpm

---

## 文件结构

### 删除文件
- `packages/telegram-acp/package-lock.json` - npm 遗留
- `packages/telegram-acp/src/storage.ts` - MTProto session 存储

### 修改文件
- `packages/telegram-acp/src/config.ts` - 简化 TelegramConfig
- `packages/telegram-acp/src/bin/telegram-acp.ts` - 移除 session/login 相关逻辑
- `packages/telegram-acp/README.md` - 更新文档

---

## Task 1: 删除 package-lock.json

**Files:**
- Delete: `packages/telegram-acp/package-lock.json`

- [ ] **Step 1: 删除文件**

```bash
rm packages/telegram-acp/package-lock.json
```

- [ ] **Step 2: 验证删除**

```bash
ls packages/telegram-acp/package-lock.json 2>&1
```

Expected: `No such file or directory` 或类似错误

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "chore: remove npm package-lock.json (use pnpm)"
```

---

## Task 2: 删除 storage.ts

**Files:**
- Delete: `packages/telegram-acp/src/storage.ts`

- [ ] **Step 1: 删除文件**

```bash
rm packages/telegram-acp/src/storage.ts
```

- [ ] **Step 2: 验证删除**

```bash
ls packages/telegram-acp/src/storage.ts 2>&1
```

Expected: `No such file or directory` 或类似错误

- [ ] **Step 3: 验证编译（预期失败，因 bin 文件仍有导入）**

```bash
cd packages/telegram-acp && pnpm run build
```

Expected: 编译错误，提示找不到 `../storage.js`（这会在 Task 4 修复）

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "chore: remove MTProto session storage (grammy Bot API doesn't need it)"
```

---

## Task 3: 更新 config.ts

**Files:**
- Modify: `packages/telegram-acp/src/config.ts`

- [ ] **Step 1: 简化 TelegramConfig 接口**

找到 `TelegramConfig` 接口（约第 25-30 行），替换为：

```typescript
export interface TelegramConfig {
  botToken: string;
}
```

- [ ] **Step 2: 更新 defaultConfig() 中的 telegram 默认值**

找到 `defaultConfig()` 函数中的 `telegram` 配置（约第 111-118 行），替换为：

```typescript
telegram: {
  botToken: "",
},
```

- [ ] **Step 3: 验证编译**

```bash
cd packages/telegram-acp && pnpm run build
```

Expected: 可能仍有错误（bin 文件引用 apiId/apiHash），继续 Task 4

- [ ] **Step 4: 提交**

```bash
git add src/config.ts
git commit -m "refactor: simplify TelegramConfig to only botToken"
```

---

## Task 4: 更新 bin/telegram-acp.ts

**Files:**
- Modify: `packages/telegram-acp/src/bin/telegram-acp.ts`

- [ ] **Step 1: 移除 storage 导入**

删除第 17-18 行的导入：

```typescript
// 删除这两行
import { loadSession, saveSession, clearSession } from "../storage.js";
import { DEFAULT_REACTION_EMOJIS } from "../config.js";
```

改为只保留：

```typescript
import { DEFAULT_REACTION_EMOJIS } from "../config.js";
```

（注意：`DEFAULT_REACTION_EMOJIS` 导入在第 18 行，需要保留）

实际修改：删除包含 `loadSession, saveSession, clearSession` 的导入行。

- [ ] **Step 2: 移除 parseArgs 返回类型中的 forceLogin**

找到 parseArgs 返回类型定义（约第 59-76 行），删除 `forceLogin: boolean;`

- [ ] **Step 3: 移除 parseArgs 默认值中的 forceLogin**

找到 result 默认值（约第 78-87 行），删除 `forceLogin: false,`

- [ ] **Step 4: 移除 --login 参数解析**

找到 switch 语句中的 `--login` case（约第 106-108 行），删除：

```typescript
case "--login":
  result.forceLogin = true;
  break;
```

- [ ] **Step 5: 移除 usage() 中的 --login 选项**

找到帮助文本中的 `--login` 行（约第 43 行），删除：

```text
  --login               Force re-authentication
```

- [ ] **Step 6: 移除 handleSessionClear 函数**

删除整个 `handleSessionClear` 函数（约第 245-248 行）：

```typescript
function handleSessionClear(config: TelegramAcpConfig): void {
  clearSession(config.storage.dir);
  console.log("Session cleared");
}
```

- [ ] **Step 7: 移除 session clear 子命令处理**

找到 main 函数中的 `session clear` 处理（约第 315-318 行），删除：

```typescript
if (args.command === "session" && process.argv.includes("clear")) {
  handleSessionClear(config);
  return;
}
```

- [ ] **Step 8: 移除 loadSession 调用**

找到 main 函数中的 session 加载代码（约第 321-326 行），删除整个代码块：

```typescript
// Load session
const session = loadSession(config.storage.dir);
if (session && !args.forceLogin) {
  config.telegram.sessionString = session.sessionString;
  config.telegram.apiId = session.apiId;
  config.telegram.apiHash = session.apiHash;
}
```

- [ ] **Step 9: 验证编译**

```bash
cd packages/telegram-acp && pnpm run build
```

Expected: 编译成功，无 TypeScript 错误

- [ ] **Step 10: 提交**

```bash
git add src/bin/telegram-acp.ts
git commit -m "refactor: remove MTProto session/login logic from CLI"
```

---

## Task 5: 更新 README.md

**Files:**
- Modify: `packages/telegram-acp/README.md`

- [ ] **Step 1: 更新标题描述**

找到第 5 行，将：

```markdown
`telegram-acp` uses MTProto to log in with a Telegram bot, listens for incoming direct messages, forwards them to an ACP agent over stdio, and sends the agent reply back to Telegram.
```

改为：

```markdown
`telegram-acp` uses grammy Bot API to connect with a Telegram bot, listens for incoming direct messages, forwards them to an ACP agent over stdio, and sends the agent reply back to Telegram.
```

- [ ] **Step 2: 更新 Features**

找到第 9 行，将：

```markdown
- MTProto connection via `telegram` library
```

改为：

```markdown
- Bot API connection via grammy
```

- [ ] **Step 3: 更新 Requirements**

找到第 20-24 行，将：

```markdown
## Requirements

- Node.js 20+
- Telegram Bot Token
- Telegram API ID and API Hash (from https://my.telegram.org)
```

改为：

```markdown
## Requirements

- Node.js 20+
- Telegram Bot Token (from @BotFather)
```

- [ ] **Step 4: 更新 Quick Start**

找到第 28-34 行，将：

```markdown
```bash
# With environment variables
export TELEGRAM_API_ID=123456
export TELEGRAM_API_HASH=abc123def456
export TELEGRAM_BOT_TOKEN="bot_token_here"

npx telegram-acp --agent claude
```

改为：

```markdown
```bash
# With environment variable
export TELEGRAM_BOT_TOKEN="bot_token_here"

npx telegram-acp --agent claude
```

- [ ] **Step 5: 移除 --login 选项**

找到 Options 部分（约第 74 行），删除：

```markdown
- `--login`: Force re-authentication
```

- [ ] **Step 6: 移除 session clear 命令**

找到 Commands 部分（约第 68 行），删除：

```markdown
telegram-acp session clear
```

- [ ] **Step 7: 更新 Configuration File 示例**

找到配置文件示例（约第 93-120 行），将：

```json
{
  "telegram": {
    "apiId": 123456,
    "apiHash": "abc123def456",
    "botToken": "bot_token_here"
  },
  "proxy": {
    "ip": "localhost",
    "port": 1080,
    "type": "socks5"
  },
  ...
}
```

改为：

```json
{
  "telegram": {
    "botToken": "bot_token_here"
  },
  "proxy": "socks5://user:pass@host:port",
  ...
}
```

完整替换配置文件示例部分：

```markdown
## Configuration File

```json
{
  "telegram": {
    "botToken": "bot_token_here"
  },
  "proxy": "socks5://user:pass@host:port",
  "allowedUsers": ["123456", "789012"],
  "agent": {
    "preset": "claude"
  },
  "session": {
    "idleTimeoutMs": 86400000,
    "maxConcurrentUsers": 10
  },
  "reaction": {
    "enabled": true,
    "randomEmojis": ["👍", "👌", "🫡"]
  }
}
```
```

- [ ] **Step 8: 更新 Storage 部分**

找到 Storage 部分（约第 122-130 行），将：

```markdown
## Storage

Runtime files stored under:
```
~/.telegram-acp/
├── session.json      # Auth session data
├── daemon.pid        # Daemon PID
└── telegram-acp.log  # Log file
```
```

改为：

```markdown
## Storage

Runtime files stored under:
```
~/.telegram-acp/
├── daemon.pid        # Daemon PID
└── telegram-acp.log  # Log file
```
```

- [ ] **Step 9: 验证无遗留关键词**

```bash
grep -E "TELEGRAM_API_ID|apiId|apiHash|MTProto|--login|session clear" packages/telegram-acp/README.md
```

Expected: 无匹配输出

- [ ] **Step 10: 提交**

```bash
git add README.md
git commit -m "docs: update README for grammy Bot API (remove MTProto references)"
```

---

## Task 6: 最终验证

- [ ] **Step 1: 完整构建**

```bash
cd packages/telegram-acp && pnpm run build
```

Expected: 成功，无错误

- [ ] **Step 2: 验证 CLI 帮助**

```bash
node dist/bin/telegram-acp.js --help | grep -E "login|session"
```

Expected: 无匹配输出

- [ ] **Step 3: 验证文件删除**

```bash
ls packages/telegram-acp/package-lock.json packages/telegram-acp/src/storage.ts 2>&1
```

Expected: 两个文件都显示 "No such file or directory"

- [ ] **Step 4: 验证 README**

```bash
grep -E "TELEGRAM_API_ID|apiId|apiHash" packages/telegram-acp/README.md
```

Expected: 无匹配输出

- [ ] **Step 5: 提交所有变更**

```bash
git add -A
git commit -m "chore: final cleanup for telegram-acp grammy migration"
```

---

## 验收标准

1. `pnpm run build` 成功，无 TypeScript 错误
2. `node dist/bin/telegram-acp.js --help` 不显示 `--login` 选项
3. `storage.ts` 文件已删除
4. `package-lock.json` 文件已删除
5. README.md 不包含 `TELEGRAM_API_ID`, `apiId`, `apiHash` 相关内容