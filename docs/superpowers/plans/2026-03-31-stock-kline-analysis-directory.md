# Stock K-Line Analysis 目录规范实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一 stock-kline-analysis skill 的目录规范，使用动态 ROOT_DIR 检测，集中数据存储

**Architecture:** 脚本内部通过 git rev-parse --show-toplevel 自动获取项目根目录，数据集中存储在 $ROOT_DIR/data/analysis/

**Tech Stack:** Bash scripts, Markdown

---

### Task 1: 更新 create_dir.sh 脚本

**Files:**
- Modify: `skills/stock-kline-analysis/scripts/create_dir.sh`

- [ ] **Step 1: 更新脚本内容**

将脚本替换为以下内容：

```bash
#!/bin/bash
# 创建分析数据目录
# 用法: ./skills/stock-kline-analysis/scripts/create_dir.sh <symbol> <interval>
# 必须从项目根目录执行

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || echo "Not in a git repository")
if [ "$ROOT_DIR" = "Not in a git repository" ]; then
    echo "Error: Must run from within a git repository"
    exit 1
fi

symbol=${1:-QQQ}
interval=${2:-4h}
datetime=$(date +%Y-%m-%d-%H-%M-%S)
dir="$ROOT_DIR/data/analysis/${datetime}-${symbol}-${interval}"

mkdir -p "$dir"
echo "Created: $dir"
```

- [ ] **Step 2: 验证脚本**

从项目根目录执行：
```bash
./skills/stock-kline-analysis/scripts/create_dir.sh TEST 1h
```

预期输出：显示创建的目录路径，如 `Created: /path/to/root/data/analysis/2026-03-31-XX-XX-XX-TEST-1h`

- [ ] **Step 3: 清理测试目录并提交**

```bash
rm -rf data/analysis/*TEST*
git add skills/stock-kline-analysis/scripts/create_dir.sh
git commit -m "fix(skill): update create_dir.sh to use ROOT_DIR detection"
```

---

### Task 2: 更新 serve_preview.sh 脚本

**Files:**
- Modify: `skills/stock-kline-analysis/scripts/serve_preview.sh`

- [ ] **Step 1: 更新脚本内容**

将脚本替换为以下内容：

```bash
#!/bin/bash
# 启动动态预览服务器
# 用法: ./skills/stock-kline-analysis/scripts/serve_preview.sh <analysis_dir>
# 必须从项目根目录执行

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || echo "Not in a git repository")
if [ "$ROOT_DIR" = "Not in a git repository" ]; then
    echo "Error: Must run from within a git repository"
    exit 1
fi

PORT=3000

# 检测 bun 是否安装
if ! command -v bun &> /dev/null; then
    echo "bun not found. Please install bun:"
    echo "  curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

# 获取分析目录参数
ANALYSIS_DIR="${1:-}"

if [ -z "$ANALYSIS_DIR" ]; then
    echo "Usage: $0 <analysis_dir>"
    echo "Example: $0 $ROOT_DIR/data/analysis/2026-03-31-12-30-45-TSLA-1h"
    echo ""
    echo "Available analysis directories:"
    ls -d "$ROOT_DIR/data/analysis/*/" 2>/dev/null | head -5
    exit 1
fi

# 获取脚本绝对路径
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPORT_SCRIPT="${SCRIPT_DIR}/report.tsx"

# 获取分析目录绝对路径
ABS_ANALYSIS_DIR="$(cd "$ANALYSIS_DIR" && pwd)"

echo "Starting preview server..."
echo "Analysis: $ABS_ANALYSIS_DIR"
echo "Open: http://localhost:$PORT"

bun "$REPORT_SCRIPT" "$ABS_ANALYSIS_DIR"
```

- [ ] **Step 2: 验证脚本无参数行为**

从项目根目录执行：
```bash
./skills/stock-kline-analysis/scripts/serve_preview.sh
```

预期输出：显示 Usage 信息和可用的分析目录列表

- [ ] **Step 3: 提交**

```bash
git add skills/stock-kline-analysis/scripts/serve_preview.sh
git commit -m "fix(skill): update serve_preview.sh to use ROOT_DIR detection"
```

---

### Task 3: 更新 SKILL.md 文档

**Files:**
- Modify: `skills/stock-kline-analysis/SKILL.md`

- [ ] **Step 1: 更新工作目录规范部分**

将现有的 "⚠️ 工作目录规范" 部分替换为：

```markdown
## ⚠️ 工作目录规范

**ROOT_DIR**：通过 `git rev-parse --show-toplevel` 获取的项目根目录

**执行位置**：所有脚本必须从 ROOT_DIR 执行

**数据目录**：`$ROOT_DIR/data/analysis/`

**路径对照表：**

| 操作 | 命令 |
|------|------|
| 创建数据目录 | `$ROOT_DIR/skills/stock-kline-analysis/scripts/create_dir.sh <symbol> <interval>` |
| 数据存储位置 | `$ROOT_DIR/data/analysis/{datetime}-{symbol}-{interval}/` |
| 截图保存 | `$ROOT_DIR/data/analysis/.../screenshot.jpg` |
| 报告保存 | `$ROOT_DIR/data/analysis/.../report.md` |
| 安装依赖 | `cd $ROOT_DIR/skills/stock-kline-analysis/scripts && bun install` |
| 启动预览 | `$ROOT_DIR/skills/stock-kline-analysis/scripts/serve_preview.sh $ROOT_DIR/data/analysis/...` |
```

- [ ] **Step 2: 更新数据存储部分**

将 "数据存储" 部分的目录结构替换为：

```markdown
## 数据存储

所有分析数据集中存储在项目根目录下：

```
$ROOT_DIR/data/analysis/{YYYY-MM-DD-HH-MM-SS}-{symbol}-{interval}/
├── screenshot.jpg       # K 线图截图
├── analysis_output.json # 分析数据（中间产物）
└── report.md            # Markdown 分析报告
```
```

- [ ] **Step 3: 更新工作流程中的路径引用**

将阶段 1 中的路径引用更新为：

```markdown
**操作流程**：

1. 创建数据目录 → `$ROOT_DIR/skills/stock-kline-analysis/scripts/create_dir.sh <symbol> <interval>`
```

- [ ] **Step 4: 更新预览报告部分**

将预览报告部分的命令示例更新为：

```markdown
## 预览报告

首次运行需安装依赖：

```bash
cd $ROOT_DIR/skills/stock-kline-analysis/scripts && bun install
```

使用 `scripts/serve_preview.sh` 启动动态渲染服务器：

```bash
$ROOT_DIR/skills/stock-kline-analysis/scripts/serve_preview.sh $ROOT_DIR/data/analysis/{datetime}-{symbol}-{interval}
# 打开 http://localhost:3000
```

**端口占用处理**：如端口 3000 被占用，先关闭占用进程：

```bash
lsof -ti:3000 | xargs kill -9
$ROOT_DIR/skills/stock-kline-analysis/scripts/serve_preview.sh $ROOT_DIR/data/analysis/{datetime}-{symbol}-{interval}
```
```

- [ ] **Step 5: 提交**

```bash
git add skills/stock-kline-analysis/SKILL.md
git commit -m "docs(skill): update SKILL.md with ROOT_DIR directory conventions"
```

---

### Task 4: 迁移现有数据并验证

**Files:**
- Move: `skills/stock-kline-analysis/data/analysis/*` → `data/analysis/`

- [ ] **Step 1: 创建目标目录**

```bash
mkdir -p data/analysis
```

- [ ] **Step 2: 迁移现有数据**

```bash
mv skills/stock-kline-analysis/data/analysis/* data/analysis/
```

- [ ] **Step 3: 清理空目录**

```bash
rm -rf skills/stock-kline-analysis/data
```

- [ ] **Step 4: 验证完整流程**

创建测试目录并验证脚本：
```bash
./skills/stock-kline-analysis/scripts/create_dir.sh VERIFY 4h
ls data/analysis/
```

预期：显示新创建的目录

- [ ] **Step 5: 清理测试数据并提交**

```bash
rm -rf data/analysis/*VERIFY*
git add data/analysis
git commit -m "chore(skill): migrate analysis data to centralized location"
```