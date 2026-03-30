# Stock K-Line Analysis 目录规范设计

## 概述

解决 skill 和脚本的目录定义歧义问题，统一数据存储位置和脚本执行规范。

## 定义

- `ROOT_DIR` = `git rev-parse --show-toplevel` 执行结果（项目根目录）
- 所有脚本必须从项目根目录执行
- 所有路径使用 `$ROOT_DIR` 作为基准

## 目录结构

```
<ROOT_DIR>/
├── data/
│   └── analysis/
│       └── {YYYY-MM-DD-HH-MM-SS}-{symbol}-{interval}/
│           ├── screenshot.jpg
│           ├── analysis_output.json
│           └── report.md
├── skills/
│   └── stock-kline-analysis/
│       ├── SKILL.md
│       ├── scripts/
│       │   ├── create_dir.sh
│       │   ├── serve_preview.sh
│       │   ├── tradingview.js
│       │   ├── report.tsx
│       │   └── package.json
│       └── references/
```

## 变更内容

### 1. SKILL.md 更新

**开头增加定义段：**

```markdown
## ⚠️ 工作目录规范

**ROOT_DIR**：通过 `git rev-parse --show-toplevel` 获取的项目根目录

**执行位置**：所有脚本必须从 ROOT_DIR 执行

**数据目录**：`$ROOT_DIR/data/analysis/`
```

**路径表格更新：**

| 操作 | 命令 |
|------|------|
| 创建数据目录 | `$ROOT_DIR/skills/stock-kline-analysis/scripts/create_dir.sh <symbol> <interval>` |
| 数据存储位置 | `$ROOT_DIR/data/analysis/{datetime}-{symbol}-{interval}/` |
| 截图保存 | `$ROOT_DIR/data/analysis/.../screenshot.jpg` |
| 报告保存 | `$ROOT_DIR/data/analysis/.../report.md` |
| 安装依赖 | `cd $ROOT_DIR/skills/stock-kline-analysis/scripts && bun install` |
| 启动预览 | `$ROOT_DIR/skills/stock-kline-analysis/scripts/serve_preview.sh $ROOT_DIR/data/analysis/...` |

### 2. create_dir.sh 更新

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

### 3. serve_preview.sh 更新

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

## 调用示例

```bash
# 创建目录
./skills/stock-kline-analysis/scripts/create_dir.sh NVDA 4h

# 启动预览
./skills/stock-kline-analysis/scripts/serve_preview.sh data/analysis/2026-03-31-12-30-45-NVDA-4h
```

## 影响范围

- SKILL.md — 文档更新
- scripts/create_dir.sh — 路径逻辑更新
- scripts/serve_preview.sh — 路径逻辑更新
- data/ 目录 — 需创建（如不存在）

## 不变内容

- 脚本位置保持在 skills 目录
- 分析数据格式不变
- 其他脚本（tradingview.js、report.tsx）无需修改