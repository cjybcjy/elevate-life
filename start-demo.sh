#!/bin/bash
# Family Ledger Pro - 一键演示启动脚本
# 用法: ./start-demo.sh

set -e

echo "======================================"
echo "  Family Ledger Pro - 演示启动脚本"
echo "======================================"
echo ""

# 获取本机 IP（用于提示）
HOST_IP=$(hostname -I | awk '{print $1}')

cd "$(dirname "$0")"

# 检查 Docker
echo "[1/4] 检查 Docker 环境..."
if ! command -v docker &> /dev/null; then
    echo "错误: Docker 未安装"
    exit 1
fi
if ! docker info &> /dev/null; then
    echo "错误: Docker 守护进程未运行"
    exit 1
fi
echo "  Docker 就绪"

# 检查 docker-compose
echo "[2/4] 检查 Docker Compose..."
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    echo "错误: Docker Compose 未安装"
    exit 1
fi
echo "  Docker Compose 就绪 ($COMPOSE_CMD)"

# 构建并启动
echo "[3/4] 构建并启动服务..."
$COMPOSE_CMD down 2>/dev/null || true
$COMPOSE_CMD up --build -d
echo "  服务已启动"

# 等待后端就绪
echo "[4/4] 等待后端服务就绪..."
for i in {1..30}; do
    if nc -z localhost 3000 2>/dev/null; then
        echo "  后端服务已就绪 (端口 3000)"
        break
    fi
    echo "  等待后端启动... ($i/30)"
    sleep 2
done

# 运行数据种子（仅在首次启动时）
echo ""
echo "[可选] 初始化演示数据..."
echo "  docker exec -it $(docker ps -q -f name=backend) sh -c 'npm run seed'"
echo ""

echo "======================================"
echo "  演示环境已启动!"
echo "======================================"
echo ""
echo "访问地址:"
echo "  - 前端页面: http://$HOST_IP/"
echo "  - 前端页面: http://localhost/"
echo "  - 后端 API: http://$HOST_IP:3000/api"
echo ""
echo "默认账号:"
echo "  - 用户名: demo"
echo "  - 密码: demo123"
echo ""
echo "管理功能入口:"
echo "  1. 登录后点击右上角 [管理] 按钮"
echo "  2. 或直接访问 http://$HOST_IP/management/transactions"
echo ""
echo "演示流程:"
echo "  1. 打开前端页面，使用 demo/demo123 登录"
echo "  2. 仪表板点击 [+ 记一笔] 快捷记账"
echo "  3. 点击右上角 [管理] 进入管理后台"
echo "  4. 在交易管理中搜索/筛选交易记录"
echo "  5. 在资产管理中新增/编辑资产（支持 crypto、持仓成本）"
echo "  6. 在负债管理中关联资产到负债"
echo "  7. 在分类管理中新增收支分类"
echo "  8. 尝试删除有关联交易的分类/资产，观察防呆提示"
echo ""
echo "停止演示:"
echo "  $COMPOSE_CMD down"
echo ""
