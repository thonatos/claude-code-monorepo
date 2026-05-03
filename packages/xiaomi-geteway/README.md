# Xiaomi Gateway

Node.js REST API 服务，用于控制小米/米家智能家居设备。

## 功能

- 小米账号认证（登录 + 二次验证）
- 设备列表与搜索
- 设备属性读取/设置
- 设备动作调用

## 安装

```bash
npm install
npm run build
```

## 配置

创建 `.env` 文件：

```
MI_USERNAME=your_xiaomi_account
MI_PASSWORD=your_password
MI_CLOUD_COUNTRY=cn
PORT=3000
```

## 运行

```bash
npm run start
```

开发模式：

```bash
npm run dev
```

## API 文档

### 认证

| 方法 | 路径               | 说明         |
| ---- | ------------------ | ------------ |
| GET  | `/api/auth/status` | 检查认证状态 |
| POST | `/api/auth/login`  | 发起登录     |
| POST | `/api/auth/verify` | 提交验证码   |
| POST | `/api/auth/logout` | 清除认证     |

### 设备

| 方法 | 路径                                              | 说明         |
| ---- | ------------------------------------------------- | ------------ |
| GET  | `/api/devices`                                    | 列出所有设备 |
| GET  | `/api/devices/search?name=xxx`                    | 搜索设备     |
| GET  | `/api/devices/:did/properties?siid=2&piids=1,2,3` | 读取属性     |
| POST | `/api/devices/:did/properties`                    | 设置属性     |
| POST | `/api/devices/:did/actions`                       | 调用动作     |

### 使用示例

```bash
# 检查认证状态
curl http://localhost:3000/api/auth/status

# 登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "your_account", "password": "your_password"}'

# 如果需要验证码
curl -X POST http://localhost:3000/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"code": "123456"}'

# 列出设备
curl http://localhost:3000/api/devices

# 搜索设备
curl "http://localhost:3000/api/devices/search?name=客厅"

# 读取属性
curl "http://localhost:3000/api/devices/xxx/properties?siid=2&piids=1,2,3"

# 设置属性（开关）
curl -X POST http://localhost:3000/api/devices/xxx/properties \
  -H "Content-Type: application/json" \
  -d '{"siid": 2, "piid": 1, "value": true}'

# 调用动作
curl -X POST http://localhost:3000/api/devices/xxx/actions \
  -H "Content-Type: application/json" \
  -d '{"siid": 2, "aiid": 1}'
```

## MIoT 协议

设备属性通过 `siid`(服务ID) 和 `piid`(属性ID) 定位。

常见组合：

- 开关：`siid=2, piid=1` (true/false)
- 亮度：`siid=2, piid=2` (0-100)
- 色温：`siid=2, piid=3`

查询设备规格：https://home.miot-spec.com

## 技术栈

- Node.js 18+
- TypeScript
- Koa
- axios
- crypto (内置)

## 参考

基于 [xiaomi-device-control](https://github.com/alleneee/xiaomi-device-control) Python 版移植。
