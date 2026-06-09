#!/bin/bash
# Family Ledger Pro - 停止本地服务

cd "$(dirname "$0")"

echo "停止本地服务..."

if [ -f "dev.pid" ]; then
    kill $(cat dev.pid) 2>/dev/null && echo "  已停止"
    rm -f dev.pid
fi

echo "完成"
