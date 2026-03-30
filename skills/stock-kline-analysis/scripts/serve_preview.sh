#!/bin/bash
# 启动静态预览服务器
# 用法: ./serve_preview.sh

PORT=3000

# 检测 bun 是否安装
if ! command -v bun &> /dev/null; then
    echo "bun not found. Please install bun:"
    echo "  curl -fsSL https://bun.sh/install | bash"
    echo "  or visit: https://bun.sh"
    exit 1
fi

echo "Starting preview server on port $PORT..."
echo "Open: http://localhost:$PORT/{date}-{symbol}-{interval}/report.html"
bun x serve data/analysis -l $PORT