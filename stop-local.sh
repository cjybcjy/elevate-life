#!/bin/bash
# Family Ledger Pro - 停止本地服务

cd "$(dirname "$0")"

echo "停止本地服务..."

if [ -f "backend.pid" ]; then
    kill $(cat backend.pid) 2>/dev/null && echo "  后端已停止"
    rm -f backend.pid
fi

if [ -f "frontend.pid" ]; then
    kill $(cat frontend.pid) 2>/dev/null && echo "  前端已停止"
    rm -f frontend.pid
fi

echo "完成"
