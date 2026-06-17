#!/bin/bash
# Family Ledger Pro - 本地开发启动脚本
# 用法: ./start-local.sh

set -e

HOST_IP=$(hostname -I | awk '{print $1}')

cd "$(dirname "$0")"

echo "======================================"
echo "  Family Ledger Pro - 本地启动"
echo "======================================"
echo ""

# 检查 Node.js
echo "[1/4] 检查 Node.js..."
if ! command -v node &> /dev/null; then
    echo "错误: Node.js 未安装"
    exit 1
fi
node -v
echo ""

# 安装依赖
echo "[2/4] 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "  安装依赖..."
    npm install
fi
echo ""

# 清理缓存并重新生成 Prisma client
echo "[3/4] 清理缓存并同步数据库..."
rm -rf .next
npx prisma generate
npx prisma db push
echo ""

# 运行 seed（首次启动）
if [ ! -f ".seed-done" ]; then
    echo "[seed] 初始化演示数据..."
    npx prisma db seed >> seed.log 2>&1 &
    touch .seed-done
    echo "  Seed 日志: seed.log"
fi

# 启动 Next.js 开发服务器
echo "[4/4] 启动 Next.js 开发服务器..."
setsid npm run dev > frontend.log 2>&1 &
echo "  进程 PID: $!"
echo $! > dev.pid
echo "  日志文件: frontend.log"

sleep 3

echo ""
echo "======================================"
echo "  本地服务已启动!"
echo "======================================"
echo ""
echo "访问地址:"
echo "  - http://$HOST_IP:3000/"
echo "  - http://localhost:3000/"
echo ""
echo "默认账号:"
echo "  - 用户名: demo"
echo "  - 密码: demo123"
echo ""
echo "停止服务:"
echo "  ./stop-local.sh"
echo ""
