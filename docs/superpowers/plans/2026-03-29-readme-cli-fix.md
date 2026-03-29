# README 文档命令修正实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正 README.md 和 CLAUDE.md 中的 CLI 命令文档，区分"开发模式"和"安装后使用"两种场景。

**Architecture:** 文档修改任务，修改三个文件中的 CLI 命令示例，分场景说明运行方式。

**Tech Stack:** Markdown 文档

---

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `README.md` | 修改 | 根目录项目文档 |
| `packages/telegram-acp/README.md` | 修改 | 包文档 |
| `CLAUDE.md` | 修改 | 项目规范文件 |

---

### Task 1: 更新根目录 README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 修改 Quick Start 部分**

将 Quick Start 部分替换为：

```markdown
## Quick Start

### 开发模式

在项目目录内开发运行：

```bash
pnpm install
pnpm --filter telegram-acp run build
pnpm --filter telegram-acp run start -- --preset claude
```

### 安装后使用

全局安装后可在任意目录运行：

```bash
# 构建并链接
cd packages/telegram-acp
pnpm run build
pnpm link --global

# 在任意目录运行
pnpx telegram-acp --preset claude
```
```

- [ ] **Step 2: 修改 CLI Commands 部分**

将 CLI Commands 部分替换为：

```markdown
## CLI Commands

开发模式：

```bash
pnpm --filter telegram-acp run start -- --preset <name>    # 使用预设
pnpm --filter telegram-acp run start -- --config <file>    # 使用配置文件
pnpm --filter telegram-acp run start -- agents             # 列出可用预设
```

安装后：

```bash
pnpx telegram-acp --preset <name>    # 使用预设
pnpx telegram-acp --config <file>    # 使用配置文件
pnpx telegram-acp agents             # 列出可用预设
```
```

- [ ] **Step 3: 验证修改**

```bash
cat README.md
```

Expected: 显示更新后的内容，包含"开发模式"和"安装后使用"两个子章节

- [ ] **Step 4: 提交**

```bash
git add README.md
git commit -m "docs: update README CLI commands for dev and installed modes"
```

---

### Task 2: 更新 packages/telegram-acp/README.md

**Files:**
- Modify: `packages/telegram-acp/README.md`

- [ ] **Step 1: 修改 Quick Start 部分**

将 Quick Start 部分（从 `## Quick Start` 到 `## Built-in Agent Presets` 之前）替换为：

```markdown
## Quick Start

### 开发模式

在项目目录内开发运行：

```bash
# 创建配置文件
mkdir -p ~/.telegram-acp
cat > ~/.telegram-acp/config.yaml << 'EOF'
telegram:
  botToken: "YOUR_TOKEN"
agent:
  preset: claude
EOF

# 构建 and 运行
pnpm run build
pnpm run start -- --preset claude
```

### 安装后使用

全局安装后可在任意目录运行：

```bash
# 构建并链接
pnpm run build
pnpm link --global

# 在任意目录运行
pnpx telegram-acp --preset claude
```
```

- [ ] **Step 2: 修改 CLI Usage 部分**

将 CLI Usage 部分替换为：

```markdown
## CLI Usage

开发模式：

```text
pnpm run start -- --preset <name>    使用预设 (config from ~/.telegram-acp/config.yaml)
pnpm run start -- --config <file>    使用配置文件
pnpm run start -- agents             列出可用预设
```

安装后：

```text
pnpx telegram-acp --preset <name>    使用预设 (config from ~/.telegram-acp/config.yaml)
pnpx telegram-acp --config <file>    使用配置文件
pnpx telegram-acp agents             列出可用预设
```
```

- [ ] **Step 3: 验证修改**

```bash
cat packages/telegram-acp/README.md
```

Expected: 显示更新后的内容

- [ ] **Step 4: 提交**

```bash
git add packages/telegram-acp/README.md
git commit -m "docs: update telegram-acp README CLI commands"
```

---

### Task 3: 更新 CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: 修改 CLI Commands 部分**

将 `### CLI Commands` 部分（从该标题到 `### Built-in Agent Presets` 之前）替换为：

```markdown
### CLI Commands

开发模式：

```bash
pnpm --filter telegram-acp run start -- --preset <name>
pnpm --filter telegram-acp run start -- --config <file>
pnpm --filter telegram-acp run start -- agents
```

安装后：

```bash
pnpx telegram-acp --preset <name>
pnpx telegram-acp --config <file>
pnpx telegram-acp agents
```
```

- [ ] **Step 2: 验证修改**

```bash
cat CLAUDE.md
```

Expected: 显示更新后的 CLI Commands 部分

- [ ] **Step 3: 提交**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md CLI commands"
```

---

### Task 4: 最终验证

- [ ] **Step 1: 验证所有文件已修改**

```bash
git log --oneline -3
```

Expected: 显示三个新的提交

- [ ] **Step 2: 检查 git 状态**

```bash
git status
```

Expected: working tree clean

---

## Files Changed Summary

| 文件 | 变更说明 |
|------|----------|
| `README.md` | Quick Start 和 CLI Commands 分场景说明 |
| `packages/telegram-acp/README.md` | 同步更新 CLI 命令 |
| `CLAUDE.md` | CLI Commands 部分更新 |

---

## Self-Review Checklist

- [x] Spec coverage: 所有需求都有对应任务
- [x] Placeholder scan: 无 TBD/TODO
- [x] File paths: 路径精确
- [x] Commands: 包含验证命令