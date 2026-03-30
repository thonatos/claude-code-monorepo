#!/bin/bash
# 创建分析数据目录
# 用法: ./create_dir.sh <symbol> <interval>
# 输出: data/analysis/{YYYY-MM-DD-HH-MM-SS}-{symbol}-{interval}/

symbol=${1:-QQQ}
interval=${2:-4h}
datetime=$(date +%Y-%m-%d-%H-%M-%S)
dir="data/analysis/${datetime}-${symbol}-${interval}"

mkdir -p "$dir"
echo "Created: $dir"