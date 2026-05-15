#!/bin/bash
# Family Ledger Pro - 本地开发启动脚本（无 Docker）
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

# 启动后端
echo "[2/4] 启动后端 (SQLite)..."
cd backend
if [ ! -d "node_modules" ]; then
    echo "  安装后端依赖..."
    npm install
fi
if [ ! -f "ledger.sqlite" ]; then
    echo "  SQLite 数据库不存在，首次启动将自动创建"
fi
npm run start:dev >> ../backend.log 2>&1 &
echo "  后端 PID: $!"
echo $! > ../backend.pid
echo "  日志: backend.log"
cd ..
sleep 3

# 运行 seed（首次启动）
echo "[3/4] 初始化演示数据..."
cd backend
if [ ! -f "../.seed-done" ]; then
    echo "  运行 seed..."
    npx ts-node src/seed.ts >> ../seed.log 2>&1 &
    touch ../.seed-done
    echo "  Seed 日志: seed.log"
else
    echo "  演示数据已初始化，跳过"
fi
cd ..

# 启动前端
echo "[4/4] 启动前端..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "  安装前端依赖..."
    npm install
fi
npm run dev >> ../frontend.log 2>&1 &
echo "  前端 PID: $!"
echo $! > ../frontend.pid
echo "  日志: frontend.log"
cd ..

sleep 2

echo ""
echo "======================================"
echo "  本地服务已启动!"
echo "======================================"
echo ""
echo "访问地址:"
echo "  - 前端页面: http://$HOST_IP:5173/"
echo "  - 前端页面: http://localhost:5173/"
echo "  - 后端 API: http://$HOST_IP:3000/api"
echo ""
echo "默认账号:"
echo "  - 用户名: demo"
echo "  - 密码: demo123"
echo ""
echo "管理功能入口:"
echo "  登录后点击右上角 [管理] 按钮"
echo ""
echo "停止服务:"
echo "  ./stop-local.sh"
echo ""
