# 本地 Hook 机制设计

**Date:** 2026-03-29
**Author:** Claude
**Status:** Draft → Pending User Review

---

## 概述

创建本地 hook 机制，强制 Claude 在修改项目文件前必须完成 spec → plan → approve 流程，防止跳过规范直接修改代码。

---

## 目标

- **强制流程遵守**：修改项目文件前必须有批准的 spec 和 plan
- **用户确认机制**：没有有效批准时，要求用户明确确认
- **多任务支持**：支持同时追踪多个任务
- **docs 目录豁免**：允许直接写 spec/plan，无需批准

---

## 架构

### 组件

| 组件 | 位置 | 职责 |
|------|------|------|
| 状态文件 | `.claude/workflow-state.json` | 记录任务、spec/plan 路径、批准状态 |
| 权限配置 | `.claude/settings.local.json` | 定义文件修改规则 |

### 文件结构

```
.claude/
├── settings.local.json      # 权限规则（已存在，需更新）
└── workflow-state.json      # 任务状态追踪（新建）
```

---

## 状态文件结构

```json
{
  "version": "1.0",
  "tasks": [
    {
      "id": "task-20260329-001",
      "name": "修复 README 文档错误",
      "spec": "docs/superpowers/specs/2026-03-29-readme-fix-design.md",
      "plan": "docs/superpowers/plans/2026-03-29-readme-fix.md",
      "status": "plan_approved",
      "files": [
        "README.md",
        "packages/telegram-acp/README.md"
      ],
      "createdAt": "2026-03-29T06:30:00Z",
      "approvedAt": "2026-03-29T06:45:00Z"
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一任务 ID，格式 `task-YYYYMMDD-NNN` |
| `name` | string | 任务名称 |
| `spec` | string | spec 文件路径，相对于项目根目录 |
| `plan` | string | plan 文件路径，相对于项目根目录 |
| `status` | enum | `pending` / `spec_written` / `spec_approved` / `plan_written` / `plan_approved` / `completed` |
| `files` | string[] | 此任务允许修改的文件列表 |
| `createdAt` | string | ISO 8601 时间戳 |
| `approvedAt` | string | 批准时间，未批准时为 null |

---

## 流程阶段与权限

### 阶段定义

| 阶段 | 触发条件 | 允许的操作 |
|------|----------|-----------|
| **无任务** | - | 读取文件、调用 brainstorming |
| **spec_written** | brainstorming 完成，spec 已写 | 修改 `docs/superpowers/specs/` |
| **spec_approved** | 用户确认 spec | 修改 `docs/superpowers/specs/` 和 `docs/superpowers/plans/` |
| **plan_written** | plan 已写 | 修改 `docs/superpowers/` |
| **plan_approved** | 用户确认 plan | 修改 `files` 中列出的项目文件 |
| **completed** | 任务完成 | 状态归档，可开始新任务 |

### 文件修改规则

| 文件路径 | 规则 |
|----------|------|
| `docs/superpowers/**` | 允许直接修改（无需批准） |
| `CLAUDE.md` | 需要用户确认 |
| `packages/**` | 需要 `plan_approved` 状态且文件在 `files` 列表中 |
| `*.json`（根目录） | 需要用户确认 |
| 其他项目文件 | 需要用户确认 |

---

## 权限配置

更新 `.claude/settings.local.json`：

```json
{
  "permissions": {
    "allow": [
      "Read(**)",
      "Glob(**)",
      "Grep(**)",
      "Bash(ls:*)",
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(pnpm:*)",
      "Edit(docs/superpowers/**)",
      "Write(docs/superpowers/**)"
    ]
  }
}
```

**说明：**
- `docs/superpowers/**` 的 Edit/Write 无条件允许
- 其他文件修改需要用户确认（Claude Code 默认行为）

---

## 状态转换流程

```
用户发起任务
    │
    ▼
superpowers:brainstorming
    │
    ▼
创建任务记录 (status: pending)
    │
    ▼
写 spec 文件
    │
    ▼
status: spec_written
    │
    ▼
用户审核 spec → 不通过 → 修改 spec
    │
    通过
    ▼
status: spec_approved
    │
    ▼
写 plan 文件
    │
    ▼
status: plan_written
    │
    ▼
用户审核 plan → 不通过 → 修改 plan
    │
    通过
    ▼
status: plan_approved
    │
    ▼
执行实现
    │
    ▼
status: completed
```

---

## 任务文件列表声明

每个任务必须在 plan 中明确声明要修改的文件：

```markdown
## Files Changed

| File | Action |
|------|--------|
| `README.md` | Modify |
| `packages/telegram-acp/src/config.ts` | Modify |
```

这些文件将被写入 `workflow-state.json` 的 `files` 字段。

---

## 用户确认机制

当 Claude 尝试修改不在白名单且无 `plan_approved` 状态的文件时：

1. Claude Code 的权限系统会弹出确认请求
2. 用户可选择：
   - **允许**：临时允许此修改
   - **拒绝**：阻止修改
3. 用户应要求 Claude 先走流程

---

## 边界情况

### 情况 1：紧急修复

用户可手动修改 `workflow-state.json` 添加紧急任务，或直接在确认对话框选择"允许"。

### 情况 2：多任务并行

`workflow-state.json` 支持多个任务，Claude 在修改文件时应检查是否有任一任务包含该文件。

### 情况 3：任务取消

删除任务记录或设置 `status: cancelled`。

---

## 实现文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `.claude/workflow-state.json` | 新建 | 任务状态文件 |
| `.claude/settings.local.json` | 修改 | 更新权限规则 |

---

## 成功标准

- [ ] `docs/superpowers/**` 可直接修改
- [ ] 修改其他项目文件时需要用户确认
- [ ] 任务状态可追踪（pending → spec_approved → plan_approved → completed）
- [ ] 多任务可并行存在