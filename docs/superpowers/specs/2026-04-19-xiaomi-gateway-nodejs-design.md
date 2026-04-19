# Xiaomi Gateway Node.js REST API 设计文档

## 概述

将 Python 版 `xiaomi-device-control` 移植为 Node.js REST API 服务，使用 TypeScript + Koa 构建。

**目标**
- 提供 REST API 供外部应用调用小米设备控制功能
- 支持小米账号密码登录 + 二次验证
- 支持设备列表、搜索、属性读写、动作调用

**技术栈**
- Node.js 18+
- TypeScript
- Koa + @koa/router + koa-bodyparser
- axios（HTTP 客户端）
- crypto（内置加密模块）

## 项目结构

```
xiaomi-gateway/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 # Koa 服务入口
│   ├── routes/
│   │   ├── auth.ts              # 认证路由
│   │   └── device.ts            # 设备路由
│   ├── services/
│   │   ├── micloud.ts           # 小米云端 API（加密/解密/请求）
│   │   ├── auth.ts              # 认证流程（登录/验证/token管理）
│   │   └── device.ts            # 设备操作（list/find/get/set/action）
│   ├── middleware/
│   │   ├── errorHandler.ts      # 全局错误处理
│   │   └── bodyParser.ts        # JSON 解析
│   └── types/
│       └── index.ts             # 类型定义
├── .mi_token                    # Token 存储（JSON）
├── .mi_session                  # 验证会话存储（JSON）
├── .env.example
└── README.md
```

## API 设计

### 认证 API

| 方法 | 路径 | 说明 | 请求体 |
|------|------|------|--------|
| GET | `/api/auth/status` | 检查认证状态 | - |
| POST | `/api/auth/login` | 发起登录 | `{username, password, country?}` |
| POST | `/api/auth/verify` | 提交验证码 | `{code}` |
| POST | `/api/auth/logout` | 清除认证 | - |

**响应示例**

```json
// GET /api/auth/status
{
  "status": "authenticated",
  "message": "已认证，可正常使用"
}

// POST /api/auth/login - 需要验证
{
  "status": "verification_required",
  "message": "需要手机验证，验证码已发送到 138****1234"
}

// POST /api/auth/login - 直接成功
{
  "status": "ok",
  "message": "登录成功，找到 12 个设备",
  "devices": [{"name": "客厅灯", "model": "yeelink.light.ceil1", "online": true}]
}
```

### 设备 API

| 方法 | 路径 | 说明 | 请求体 |
|------|------|------|--------|
| GET | `/api/devices` | 列出所有设备 | - |
| GET | `/api/devices/search?name=xxx` | 搜索设备 | - |
| GET | `/api/devices/:did/properties?siid=2&piids=1,2,3` | 读取属性 | - |
| POST | `/api/devices/:did/properties` | 设置属性 | `{siid, piid, value}` |
| POST | `/api/devices/:did/actions` | 调用动作 | `{siid, aiid, params?}` |

**响应示例**

```json
// GET /api/devices
[
  {"did": "xxx", "name": "客厅灯", "model": "yeelink.light.ceil1", "ip": "192.168.1.100", "is_online": true}
]

// GET /api/devices/:did/properties?siid=2&piids=1,2,3
{
  "did": "xxx",
  "properties": [{"piid": 1, "value": true}, {"piid": 2, "value": 50}]
}

// POST /api/devices/:did/properties
{
  "success": true,
  "did": "xxx",
  "siid": 2,
  "piid": 1,
  "value": true
}
```

## 认证流程

```
┌─────────┐      POST /login       ┌─────────┐
│  用户   │ ──────────────────────▶│  服务   │
└─────────┘                        └─────────┘
                                        │
                                        ▼
                               ┌─────────────────┐
                               │  小米账号 API   │
                               │  (serviceLogin) │
                               └─────────────────┘
                                        │
                     ┌──────────────────┴──────────────────┐
                     │                                     │
                     ▼                                     ▼
            ┌────────────────┐                    ┌──────────────┐
            │  无二次验证    │                    │  需二次验证  │
            │  直接成功      │                    │  返回状态码  │
            └────────────────┘                    └──────────────┘
                     │                                     │
                     ▼                                     ▼
            ┌────────────────┐              ┌─────────────────────┐
            │ 保存 token     │              │ POST /verify (code) │
            │ 返回成功       │              └─────────────────────┘
            └────────────────┘                        │
                                                      ▼
                                            ┌─────────────────┐
                                            │ 提交验证码完成  │
                                            │ 保存 token      │
                                            └─────────────────┘
```

**Token 存储**

- 文件：`.mi_token`（JSON）
- 内容：`{cookies: {...}, ssecurity: "hex_string", server: "cn"}`
- 会话文件：`.mi_session`（验证过程中临时存储）

## 小米 API 加密机制

### 端点

| 区域 | Base URL |
|------|----------|
| cn | `https://api.io.mi.com/app` |
| de | `https://de.api.io.mi.com/app` |
| sg | `https://sg.api.io.mi.com/app` |
| us | `https://us.api.io.mi.com/app` |

### 加密流程

```
请求参数 JSON → ARC4 加密 → base64 编码 → POST
响应内容 → base64 解码 → ARC4 解密 → JSON 解析
```

### 签名计算

```typescript
// nonce: 8字节随机 + 4字节时间戳(分钟)
const nonce = Buffer.concat([
  crypto.randomBytes(8),
  Buffer.alloc(4, Math.floor(Date.now() / 60000))
]);

// signed_nonce: SHA256(ssecurity + nonce)
const signedNonce = crypto.createHash('sha256')
  .update(Buffer.concat([ssecurity, nonce]))
  .digest();

// signature: SHA1("POST&path&key=value&...&signed_nonce_base64")
const params = ['POST', path];
for (const [k, v] of Object.entries(data)) {
  params.push(`${k}=${v}`);
}
params.push(signedNonce.toString('base64'));
const signature = crypto.createHash('sha1')
  .update(params.join('&'))
  .digest()
  .toString('base64');
```

### ARC4 加密

Node.js 内置 `crypto.createCipheriv` 支持 RC4：

```typescript
// 使用 crypto 模块的流式加密
function arc4Crypt(key: Buffer, data: Buffer): Buffer {
  const cipher = crypto.createCipheriv('rc4', key, null);
  cipher.setAutoPadding(false);
  // RC4 需要先丢弃 1024 字节（与 Python 版一致）
  cipher.update(Buffer.alloc(1024));
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

// 解密使用相同函数（RC4 是对称的）
function arc4Decrypt(key: Buffer, data: Buffer): Buffer {
  return arc4Crypt(key, data);
}
```

**注意**：Node.js 18+ 内置支持 `'rc4'` 算法，无需额外依赖。
```

### API 端点映射

| Python 函数 | API 端点 | Node.js 实现 |
|-------------|----------|--------------|
| `get_devices()` | `/v2/home/device_list_page` | `MiCloud.getDevices()` |
| `get_properties()` | `/miotspec/prop/get` | `MiCloud.getProperties()` |
| `set_properties()` | `/miotspec/prop/set` | `MiCloud.setProperties()` |
| `call_action()` | `/miotspec/action` | `MiCloud.callAction()` |

## 类型定义

```typescript
// src/types/index.ts

interface Device {
  did: string;
  name: string;
  model: string;
  ip?: string;
  is_online: boolean;
}

interface AuthStatus {
  status: 'authenticated' | 'not_configured' | 'pending_verification' | 'not_authenticated';
  message: string;
}

interface MiCloudConfig {
  username: string;
  password: string;
  server: 'cn' | 'de' | 'sg' | 'us';
}

interface TokenData {
  cookies: Record<string, string>;
  ssecurity: string;  // hex
  server: string;
}

interface PropertyResult {
  did: string;
  siid: number;
  piid: number;
  value: any;
}

interface ActionResult {
  did: string;
  siid: number;
  aiid: number;
  result: any;
}
```

## 错误处理

**统一响应格式**

```typescript
interface ErrorResponse {
  error: true;
  code: string;
  message: string;
  details?: any;
}
```

**错误码定义**

| 错误码 | 说明 | HTTP 状态 |
|--------|------|-----------|
| `AUTH_REQUIRED` | 未认证 | 401 |
| `AUTH_FAILED` | 登录失败 | 400 |
| `VERIFICATION_REQUIRED` | 需二次验证 | 400 |
| `DEVICE_NOT_FOUND` | 设备不存在 | 404 |
| `DEVICE_OFFLINE` | 设备离线 | 400 |
| `API_ERROR` | 小米 API 错误 | 500 |

**中间件实现**

```typescript
// src/middleware/errorHandler.ts
import { Context } from 'koa';

export async function errorHandler(ctx: Context, next: () => Promise<void>) {
  try {
    await next();
  } catch (err: any) {
    ctx.status = err.status || 500;
    ctx.body = {
      error: true,
      code: err.code || 'UNKNOWN_ERROR',
      message: err.message,
      details: err.details,
    };
  }
}
```

## 依赖清单

```json
{
  "dependencies": {
    "koa": "^2.15.0",
    "@koa/router": "^12.0.0",
    "koa-bodyparser": "^4.4.0",
    "axios": "^1.6.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/koa": "^2.15.0",
    "@types/koa-bodyparser": "^4.4.0",
    "@types/node": "^20.0.0",
    "ts-node": "^10.9.0",
    "nodemon": "^3.0.0"
  }
}
```

## 实现优先级

1. **MiCloud 服务** - 加密/解密/请求核心（最难部分）
2. **Auth 服务** - 登录/验证/token 管理
3. **Device 服务** - 设备操作封装
4. **路由** - REST API 端点
5. **错误处理** - 中间件

## 与 Python 版差异

| 方面 | Python 版 | Node.js 版 |
|------|-----------|------------|
| 框架 | FastMCP | Koa REST API |
| HTTP 客户端 | httpx | axios |
| 加密 | cryptography 库 | crypto 内置模块 |
| 配置 | pydantic-settings | dotenv |
| 运行方式 | MCP Server | HTTP 服务 |

## 后续扩展（可选）

- [ ] 添加摄像头截图功能（需 ffmpeg）
- [ ] 添加 WebSocket 实时推送
- [ ] 添加请求日志记录
- [ ] 添加 Docker 部署配置