# Telegram SOCKS 代理支持设计文档

**日期**: 2026-03-28
**状态**: 已批准

---

## 1. 概述

为 telegram-acp 添加 SOCKS 代理支持，允许用户通过代理服务器连接 Telegram API。

### 1.1 需求来源

基于 `docs/superpowers/specs/2026-03-28-telegram-acp-design.md` spec 中的要求：
- 环境变量：`TELEGRAM_PROXY=<url>`
- CLI 参数：`--proxy <url>`
- 支持协议：socks4, socks5, http, https

---

## 2. 架构设计

### 2.1 配置方式

| 方式 | 示例 | 优先级 |
|------|------|--------|
| CLI 参数 | `--proxy socks5://host:port` | 最高 |
| 环境变量 | `TELEGRAM_PROXY=socks5://host:port` | 中 |
| Config 文件 | `"proxy": "socks5://host:port"` | 低 |

### 2.2 代理 URL 格式

```
socks5://user:pass@host:port
socks4://host:port
http://host:port
https://host:port
```

### 2.3 技术实现

使用 `socks-proxy-agent` 库创建 `SocksProxyAgent`，传入 grammy Bot 的 `client.baseFetchConfig` 选项。

---

## 3. 代码变更

### 3.1 `config.ts`

```typescript
export interface TelegramAcpConfig {
  telegram: TelegramConfig;
  proxy?: string;  // SOCKS proxy URL, e.g. socks5://user:pass@host:port
  // ...
}
```

### 3.2 `bot.ts`

```typescript
import { Bot } from "grammy";
import { SocksProxyAgent } from "socks-proxy-agent";

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
  // ...
}
```

### 3.3 `bin/telegram-acp.ts`

```typescript
// 从 CLI 参数读取
const proxy = args.proxy || process.env.TELEGRAM_PROXY;

if (proxy) {
  config.proxy = proxy;
}
```

---

## 4. 依赖变更

```json
{
  "dependencies": {
    "grammy": "^1.41.1",
    "@agentclientprotocol/sdk": "^0.16.1",
    "socks-proxy-agent": "^8.0.0"
  }
}
```

---

## 5. 验收标准

1. `pnpm run build` 成功，无 TypeScript 错误
2. 通过 `--proxy socks5://host:port` 启动 Bot 能正常连接
3. 通过 `TELEGRAM_PROXY` 环境变量配置代理能正常连接
4. CLI 参数优先级高于环境变量

---

## 6. 未来扩展

- 支持 config 文件中的 proxy 配置
- 支持更复杂的代理认证方式
