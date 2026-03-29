# Telegram ACP 遗留代码清理设计

**日期:** 2026-03-28
**状态:** Approved

## 背景

telegram-acp 已从 `telegram` 包（MTProto 用户账号登录）迁移到 grammy（Bot API）。Bot API 只需要静态 Bot Token，不需要用户账号登录相关的 `apiId`、`apiHash`、`sessionString`。遗留代码需要清理。

## 目标

移除所有 MTProto 用户账号登录相关的代码和文档，简化配置结构。

## 需要删除的文件

| 文件 | 说明 |
|------|------|
| `packages/telegram-acp/package-lock.json` | npm 遗留文件（项目使用 pnpm） |
| `packages/telegram-acp/src/storage.ts` | MTProto session 存储，Bot 不需要 |

## 需要修改的文件

### `packages/telegram-acp/src/config.ts`

简化 `TelegramConfig` 接口：

```typescript
export interface TelegramConfig {
  botToken: string;  // 仅保留 botToken
}
```

移除：
- `apiId: number`
- `apiHash: string`
- `sessionString?: string`

更新 `defaultConfig()` 中 `telegram` 默认值：
```typescript
telegram: {
  botToken: "",
}
```

### `packages/telegram-acp/src/bin/telegram-acp.ts`

移除以下内容：

1. **导入：**
   - `loadSession, saveSession, clearSession` from `"../storage.js"`

2. **parseArgs 返回类型：**
   - `forceLogin: boolean`

3. **parseArgs 默认值：**
   - `forceLogin: false`

4. **参数解析：**
   - `case "--login": result.forceLogin = true; break;`

5. **usage() 帮助文本：**
   - `--login               Force re-authentication`

6. **子命令处理：**
   - `session clear` 命令分支
   - `handleSessionClear` 函数

7. **main() 函数中：**
   - `loadSession` 调用和相关赋值：
     ```typescript
     // 删除以下代码块
     const session = loadSession(config.storage.dir);
     if (session && !args.forceLogin) {
       config.telegram.sessionString = session.sessionString;
       config.telegram.apiId = session.apiId;
       config.telegram.apiHash = session.apiHash;
     }
     ```

### `packages/telegram-acp/README.md`

更新内容：

1. **标题描述：**
   - 移除 "MTProto"，改为 "Bot API via grammy"

2. **Features：**
   - 移除 "MTProto connection via `telegram` library"
   - 改为 "Bot API connection via grammy"

3. **Requirements：**
   - 移除 `TELEGRAM_API_ID` 和 `TELEGRAM_API_HASH`
   - 仅保留 Bot Token 要求

4. **Quick Start：**
   - 移除 `TELEGRAM_API_ID` 和 `TELEGRAM_API_HASH` 环境变量示例

5. **Options：**
   - 移除 `--login` 选项

6. **Commands：**
   - 移除 `telegram-acp session clear`

7. **Configuration File 示例：**
   - 移除 `apiId` 和 `apiHash`
   - proxy 配置改为字符串 `"socks5://user:pass@host:port"`

8. **Storage：**
   - 移除 `session.json` 说明
   - 保留 `daemon.pid` 和 `telegram-acp.log`

## 保留不变

- `proxy?: string` 配置（已正确实现为字符串 URL）
- daemon、reaction、ACP session 等其他功能
- Bot Token 认证流程

## 验收标准

1. `pnpm run build` 成功，无 TypeScript 错误
2. `node dist/bin/telegram-acp.js --help` 不显示 `--login` 选项
3. `storage.ts` 文件已删除
4. `package-lock.json` 文件已删除
5. README.md 不包含 `TELEGRAM_API_ID`, `apiId`, `apiHash` 相关内容