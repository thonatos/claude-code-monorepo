#!/bin/bash
# 创建分析数据目录
# 用法: ./create_dir.sh <symbol> <interval>

symbol=${1:-QQQ}
interval=${2:-4h}
date=$(date +%Y-%m-%d)
dir="data/analysis/${date}-${symbol}-${interval}"

mkdir -p "$dir"
echo "Created: $dir"