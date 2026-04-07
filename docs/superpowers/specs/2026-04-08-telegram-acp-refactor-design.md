# telegram-acp 架构优化设计

## 目标

- 结构清晰：模块职责单一，边界明确
- 代码简洁：删除冗余抽象，减少代码量
- 职责明确：每个文件只做一件事

## 当前问题

| 文件 | 行数 | 问题 |
|------|------|------|
| session.ts | 450 | 职责过重：生命周期、spawn、health、消息记录、idle管理 |
| storage.ts | 355 | 双层抽象（SessionStorage 包装 FileStorageBackend）过度 |
| streaming.ts | 360 | 多个类混合：MessageStream、StreamingMessageState、RateLimiter |
| bridge.ts | 137 | 回调函数耦合度高（4个回调传入 SessionManager） |
| metrics.ts | 351 | 定义了完整系统但未实际使用 |

测试覆盖：仅有 4 个测试文件，核心模块缺少测试

---

## Phase 1: 结构重构

### 1.1 session.ts 拆分

**当前结构：** 单文件 450 行，混合多种职责

**目标结构：**
```
src/session/
├── index.ts          # 导出入口：SessionManager
├── lifecycle.ts      # Session 生命周期（create/restore/stop/restart/recordMessage）
├── spawn.ts          # Agent 进程 spawn + ACP 连接初始化
├── idle-manager.ts   # Idle timeout + eviction + 容量控制
└── types.ts          # UserSession、SessionManagerOpts、RestoredSession
```

**职责划分：**

| 模块 | 职责 |
|------|------|
| lifecycle.ts | session CRUD、状态管理、消息记录、与 storage 交互 |
| spawn.ts | 进程创建、stdio 处理、ACP 初始化、sessionId 获取 |
| idle-manager.ts | 定时器管理、超时清理、容量检查、eviction |
| types.ts | 所有类型定义，供其他模块引用 |

**依赖关系：**
```
SessionManager (index.ts)
    ├── Lifecycle → storage, spawn, idle-manager, health
    ├── Spawn → TelegramAcpClient, ACP SDK
    └── IdleManager → timers, eviction logic
```

### 1.2 storage.ts 简化

**当前结构：** SessionStorage 包装 FileStorageBackend（双层）

**目标结构：**
```
src/storage/
├── index.ts          # 导出：StorageBackend 接口 + FileStorage 类
├── file-storage.ts   # 文件存储实现（合并原实现）
└── types.ts          # StoredSession、StoredMessage、SessionStatus
```

**变更：**
- 删除 SessionStorage 包装层
- FileStorage 直接实现 StorageBackend 接口
- 保留批量写入（pendingWrites）逻辑

### 1.3 streaming.ts 拆分

**当前结构：** MessageStream + StreamingMessageState + RateLimiter 混合

**目标结构：**
```
src/streaming/
├── index.ts          # 导出：StreamingMessageState、RateLimiter
├── message-stream.ts # MessageStream 类
├── state.ts          # StreamingMessageState（协调多个 stream）
├── rate-limiter.ts   # TelegramRateLimiter
├── formatting.ts     # markdownToHtml、escapeHtml
└── types.ts          # StreamingConfig、MessageCallbacks
```

---

## Phase 2: 代码清理

### 2.1 metrics.ts 处理

**决策：删除**

理由：
- 完整实现但未集成到任何流程
- 增加代码量但不提供价值
- 后续需要时可重新引入（设计已验证）

**影响：**
- 删除 src/metrics.ts
- 删除 config.ts 中 MetricsConfig、ObservabilityConfig 相关定义
- SessionMetrics、MessageMetrics、ApiMetrics 辅助类一并删除

### 2.2 bridge.ts 回调简化

**当前模式：**
```typescript
// 4个回调函数传入 SessionManager
new SessionManager({
  onReply: async (userId, text) => { ... },
  sendTyping: async (userId) => { ... },
  sendMessage: async (userId, text, parseMode) => { ... },
  editMessage: async (userId, msgId, text, parseMode) => { ... },
})
```

**目标模式：**
```typescript
// 依赖注入 TelegramApiWrapper
new SessionManager({
  telegramApi: this.telegramApi, // 封装 Bot API
})

// src/telegram-api.ts
export class TelegramApiWrapper {
  constructor(private api: BotApi) {}

  async sendMessage(userId: string, text: string, parseMode?: 'HTML'): Promise<number>
  async editMessage(userId: string, msgId: number, text: string, parseMode?: 'HTML'): Promise<number>
  async sendTyping(userId: string): Promise<void>
}
```

**新增文件：** `src/telegram-api.ts`

---

## Phase 3: 测试完善

### 测试文件规划

```
test/
├── session/
│   ├── lifecycle.test.ts    # create/restore/stop/restart/recordMessage
│   ├── spawn.test.ts        # spawnAgent（mock process）
│   └── idle-manager.test.ts # resetIdleTimer/evictOldest
├── storage/
│   └── file-storage.test.ts # save/load/recordMessage/batchFlush
├── streaming/
│   ├── state.test.ts        # appendThought/appendText/finalizeAll
│   ├── message-stream.test.ts # append/flushIfNeeded/finalize
│   └── formatting.test.ts   # markdownToHtml/escapeHtml
├── health.test.ts           # start/stop/markHealthy/markUnhealthy
├── history.test.ts          # buildContext/estimateTokens/strategies
└── integration.test.ts      # 集成测试骨架（mock ACP）
```

### 测试优先级

1. **核心路径：** lifecycle.test.ts、state.test.ts
2. **边界条件：** idle-manager.test.ts、file-storage.test.ts
3. **辅助模块：** health.test.ts、history.test.ts、formatting.test.ts

---

## 实施顺序

```
Phase 1.1: session/ 拆分 → Phase 1.2: storage/ 简化 → Phase 1.3: streaming/ 拆分
    ↓
Phase 2: metrics 删除 + telegram-api.ts 新增
    ↓
Phase 3: 测试补齐（按优先级）
```

每个 Phase 完成后运行现有测试确保不破坏功能。

---

## 文件变更汇总

### 新增

| 文件 | 描述 |
|------|------|
| src/session/index.ts | SessionManager 入口 |
| src/session/lifecycle.ts | 生命周期管理 |
| src/session/spawn.ts | Agent spawn |
| src/session/idle-manager.ts | Idle 管理 |
| src/session/types.ts | 类型定义 |
| src/storage/index.ts | 存储入口 |
| src/storage/file-storage.ts | 文件存储 |
| src/storage/types.ts | 类型定义 |
| src/streaming/index.ts | 流式入口 |
| src/streaming/message-stream.ts | 单消息状态 |
| src/streaming/state.ts | 多消息协调 |
| src/streaming/rate-limiter.ts | 速率限制 |
| src/streaming/formatting.ts | 格式化 |
| src/streaming/types.ts | 类型定义 |
| src/telegram-api.ts | Bot API 封装 |

### 删除

| 文件 | 原因 |
|------|------|
| src/session.ts | 拆分到 session/ |
| src/storage.ts | 拆分到 storage/ |
| src/streaming.ts | 拆分到 streaming/ |
| src/metrics.ts | 未使用 |

### 修改

| 文件 | 变更 |
|------|------|
| src/bridge.ts | 使用 TelegramApiWrapper |
| src/index.ts | 更新导出路径 |
| src/config.ts | 移除 metrics 相关定义 |

---

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 拆分导致导入路径变化 | 外部依赖可能失败 | 更新 index.ts 导出保持兼容 |
| storage 层简化破坏现有逻辑 | 批量写入可能失效 | 保留 pendingWrites 逻辑 |
| metrics 删除后无法恢复 | 后续需要监控 | Git 历史可恢复，设计经验保留 |

---

## 验收标准

1. 所有现有测试通过
2. 新增测试覆盖核心模块
3. 无 TypeScript 编译错误
4. 文件行数减少 20%+
5. 每个模块职责单一，可独立理解