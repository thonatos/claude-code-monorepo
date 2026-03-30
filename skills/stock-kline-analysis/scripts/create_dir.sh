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