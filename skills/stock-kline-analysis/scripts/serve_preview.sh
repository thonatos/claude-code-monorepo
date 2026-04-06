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

# 检查端口占用并自动关闭
PID=$(lsof -ti:$PORT 2>/dev/null)
if [ -n "$PID" ]; then
    echo "Port $PORT is in use (PID: $PID). Killing process..."
    kill -9 $PID 2>/dev/null
    sleep 1
    # 验证端口是否已释放
    if lsof -ti:$PORT >/dev/null 2>&1; then
        echo "Failed to kill process on port $PORT. Please manually free the port."
        exit 1
    fi
    echo "Port $PORT freed."
fi

echo "Starting preview server..."
echo "Analysis: $ABS_ANALYSIS_DIR"
echo "Open: http://localhost:$PORT"

bun "$REPORT_SCRIPT" "$ABS_ANALYSIS_DIR"