# 本地 Hook 机制实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建本地 hook 机制，通过权限配置和状态文件强制 Claude 遵守 spec → plan → approve 流程。

**Architecture:** 利用 Claude Code 的 permission 机制，允许直接修改 docs/superpowers/ 目录，其他文件修改需要用户确认。状态文件追踪任务流程阶段。

**Tech Stack:** JSON 配置文件，Claude Code permissions

---

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `.claude/workflow-state.json` | 新建 | 任务状态追踪 |
| `.claude/settings.local.json` | 修改 | 添加 docs/superpowers 权限规则 |

---

### Task 1: 创建工作流状态文件

**Files:**
- Create: `.claude/workflow-state.json`

- [ ] **Step 1: 创建 workflow-state.json**

创建 `.claude/workflow-state.json`：

```json
{
  "version": "1.0",
  "tasks": []
}
```

- [ ] **Step 2: 验证文件已创建**

```bash
cat .claude/workflow-state.json
```

Expected: 显示 `{"version": "1.0", "tasks": []}`

- [ ] **Step 3: 提交**

```bash
git add .claude/workflow-state.json
git commit -m "chore: add workflow-state.json for task tracking"
```

---

### Task 2: 更新权限配置

**Files:**
- Modify: `.claude/settings.local.json`

- [ ] **Step 1: 更新 settings.local.json**

将 `.claude/settings.local.json` 替换为：

```json
{
  "permissions": {
    "allow": [
      "Read(**)",
      "Glob(**)",
      "Grep(**)",
      "Bash(ls:*)",
      "Bash(cd:*)",
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(git show:*)",
      "Bash(git branch:*)",
      "Bash(git remote:*)",
      "Bash(pnpm:*)",
      "Bash(node:*)",
      "Bash(mkdir:*)",
      "Bash(chmod:*)",
      "Bash(grep:*)",
      "Bash(cat:*)",
      "Bash(head:*)",
      "Bash(tail:*)",
      "Bash(echo:*)",
      "Edit(docs/superpowers/**)",
      "Write(docs/superpowers/**)",
      "WebSearch",
      "WebFetch(domain:grammy.dev)",
      "mcp__plugin_episodic-memory_episodic-memory__search",
      "mcp__plugin_context7_context7__resolve-library-id",
      "mcp__plugin_context7_context7__query-docs",
      "Bash(gitleaks:*)"
    ]
  },
  "enabledPlugins": {
    "episodic-memory@superpowers-marketplace": true,
    "superpowers@superpowers-marketplace": true,
    "superpowers-lab@superpowers-marketplace": true,
    "frontend-design@claude-plugins-official": true,
    "context7@claude-plugins-official": true,
    "code-simplifier@claude-plugins-official": true,
    "typescript-lsp@claude-plugins-official": true,
    "commit-commands@claude-plugins-official": true,
    "claude-md-management@claude-plugins-official": true,
    "claude-mem@thedotmack": true,
    "security-guidance@claude-plugins-official": true
  }
}
```

- [ ] **Step 2: 验证配置**

```bash
cat .claude/settings.local.json
```

Expected: 显示更新后的 JSON 内容，包含 `Edit(docs/superpowers/**)` 和 `Write(docs/superpowers/**)`

- [ ] **Step 3: 提交**

```bash
git add .claude/settings.local.json
git commit -m "chore: add permissions for docs/superpowers direct edit"
```

---

### Task 3: 更新 CLAUDE.md 文档

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: 添加 workflow-state.json 说明到 CLAUDE.md**

在 `## Notes` 部分前添加：

```markdown
## Workflow State

任务状态记录在 `.claude/workflow-state.json`：

```json
{
  "version": "1.0",
  "tasks": [
    {
      "id": "task-YYYYMMDD-NNN",
      "name": "任务名称",
      "spec": "docs/superpowers/specs/xxx-design.md",
      "plan": "docs/superpowers/plans/xxx.md",
      "status": "plan_approved",
      "files": ["path/to/file.ts"],
      "createdAt": "ISO timestamp",
      "approvedAt": "ISO timestamp or null"
    }
  ]
}
```

**状态值：** `pending` → `spec_written` → `spec_approved` → `plan_written` → `plan_approved` → `completed`

**修改规则：**
- `docs/superpowers/**` - 可直接修改
- 其他项目文件 - 需要 `plan_approved` 状态且文件在 `files` 列表中

```

- [ ] **Step 2: 提交**

```bash
git add CLAUDE.md
git commit -m "docs: document workflow-state.json and file modification rules"
```

---

### Task 4: 最终验证

- [ ] **Step 1: 验证文件结构**

```bash
ls -la .claude/
```

Expected: 显示 `settings.local.json` 和 `workflow-state.json`

- [ ] **Step 2: 验证 workflow-state.json 内容**

```bash
cat .claude/workflow-state.json
```

Expected: `{"version": "1.0", "tasks": []}`

- [ ] **Step 3: 检查 git 状态**

```bash
git status
```

Expected: working tree clean

---

## Self-Review Checklist

- [x] Spec coverage: 所有需求都有对应任务
- [x] Placeholder scan: 无 TBD/TODO
- [x] Type consistency: JSON 结构一致
- [x] File paths: 路径精确
- [x] Commands: 包含验证命令