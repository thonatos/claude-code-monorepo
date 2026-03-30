#!/bin/bash
# 启动动态预览服务器 (bun server 渲染 TSX + 数据)
# 用法: ./serve_preview.sh <analysis_dir>
# 示例: ./serve_preview.sh data/analysis/2026-03-31-12-30-45-TSLA-1h

PORT=3000

# 检测 bun 是否安装
if ! command -v bun &> /dev/null; then
    echo "bun not found. Please install bun:"
    echo "  curl -fsSL https://bun.sh/install | bash"
    echo "  or visit: https://bun.sh"
    exit 1
fi

# 获取分析目录参数
ANALYSIS_DIR="${1:-}"

if [ -z "$ANALYSIS_DIR" ]; then
    echo "Usage: $0 <analysis_dir>"
    echo "Example: $0 data/analysis/2026-03-31-12-30-45-TSLA-1h"
    echo ""
    echo "Available analysis directories:"
    ls -d data/analysis/*/ 2>/dev/null | head -5
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