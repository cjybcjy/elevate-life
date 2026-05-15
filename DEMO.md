# Family Ledger Pro - 演示指南

## 环境要求

- Docker & Docker Compose
- 或 Node.js 20 + npm

## 一键启动（Docker）

```bash
cd /home/kyrie/workspace/elevate-life/.worktrees/data-management
./start-demo.sh
```

启动后访问：`http://<服务器IP>/`

## 手动启动（开发模式）

### 1. 启动后端

```bash
cd backend
npm install
npm run start:dev
```

后端运行在 `http://localhost:3000`

### 2. 初始化演示数据（首次）

```bash
cd backend
npm run seed
```

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端运行在 `http://localhost:5173`

## 演示账号

- 用户名：`demo`
- 密码：`demo123`

## 演示流程

### 1. 仪表板概览

登录后进入仪表板，展示：
- 净资产概览
- 资产配置饼图
- 负债概览
- 收支剪刀图
- 12个月现金流预测
- **新增：顶部右侧「+ 记一笔」快捷记账按钮**

### 2. 快捷记账（Dashboard）

1. 点击仪表板右上角「+ 记一笔」
2. 在右侧滑出的抽屉中：
   - 选择类型：收入 / 支出 / 转账
   - 输入金额
   - 选择分类（收入/支出）
   - 选择资金来源/去向账户
   - 选择日期和备注
3. 点击保存，交易记录创建，资产余额自动联动更新

### 3. 管理后台

点击右上角「管理」进入管理后台：

#### 资产管理 (`/management/assets`)
- 搜索资产名称
- 按类型筛选（现金、房产、股票、基金、黄金、加密货币等）
- 查看浮动资产盈亏（基于持仓成本价计算）
- 新增/编辑/删除资产
- **新增字段：加密货币类型、持仓成本价**

#### 负债管理 (`/management/liabilities`)
- 搜索负债名称
- 查看剩余金额、利率、剩余期数
- 新增/编辑/删除负债
- **新增字段：关联资产**

#### 交易管理 (`/management/transactions`)
- 搜索备注
- 按类型筛选（收入/支出/转账）
- 查看账户流转（转账显示 A → B）
- 点击「+ 记一笔」打开抽屉记账
- 编辑/删除交易（删除自动回滚余额）

#### 分类管理 (`/management/categories`)
- 分开展示支出分类和收入分类
- 支持图标
- 新增/编辑/删除分类

### 4. 删除防呆演示

尝试删除以下数据，观察系统提示：
1. 删除一个已有交易的分类 → 提示"该分类下存在X笔交易，无法删除"
2. 删除一个已有交易的资产 → 提示"该资产存在X笔关联交易，无法删除"
3. 删除一个已有交易的负债 → 提示"该负债存在X笔关联交易，无法删除"

### 5. 余额联动演示

1. 创建一笔支出交易（如：餐饮 100元，资金来源：现金存款）
2. 观察现金存款余额自动减少 100 元
3. 删除这笔交易，观察余额自动恢复
4. 创建一笔转账交易（如：从现金存款转到股票账户 50000元）
5. 观察两个账户余额同步变化

## 技术亮点

| 功能 | 实现 |
|------|------|
| 转账类型 | 交易类型扩展为 income/expense/transfer |
| 账户关联 | fromAccountId / toAccountId 关联资产 |
| 余额联动 | 交易 CRUD 自动更新资产余额 |
| 加密货币 | 资产类型新增 crypto |
| 持仓成本 | 浮动资产盈亏计算（PnL）|
| 关联资产 | 负债可关联到具体资产 |
| 删除防呆 | ConflictException 阻止破坏历史数据 |
| 快捷记账 | 仪表板全局入口 + 管理页抽屉 |
| 搜索筛选 | 各管理页支持关键词搜索和类型筛选 |

## 已知问题与修复

1. **CORS 跨域问题** → 已修复：`main.ts` 允许所有来源（演示环境）
2. **Network Error** → 已修复：CORS + 前端 `.env` 配置 API URL
3. **缺少 Transaction 导入** → 已修复：`liabilities.service.ts` 补充导入
4. **Seed 数据不完整** → 已修复：交易数据添加 fromAccountId/toAccountId

## 停止演示

```bash
docker-compose down
```

或按 `Ctrl+C` 停止手动启动的服务。
