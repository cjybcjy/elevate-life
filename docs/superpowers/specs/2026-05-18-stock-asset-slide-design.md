# 股票资产独立 Slide 设计方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在仪表板新增股票资产独立 Slide，刷新页面时自动拉取 A股/港股/美股实时价格，展示每支股票的市值、盈亏，并在标题栏显示股票总市值和总盈亏。

**Architecture:** 复用现有 `Asset` 实体体系，新增 `market` 字段区分市场；增强 `StockService` 支持多市场代码识别；新建 `StockSlide` 前端组件作为 `asset-allocation` section 的专用视图。

**Tech Stack:** NestJS + TypeORM + SQLite, React + Tailwind + Vite

---

## 背景

现有系统已支持股票资产：
- `Asset` 实体含 `stockCode`、`quantity`、`costBasis` 字段
- `StockService` 已从新浪/腾讯/东财拉取 A 股实时价格
- `AssetsService` 在查询时自动计算股票当前市值
- 前端「资产管理」页面已能新增/编辑股票资产

缺失能力：
- 无港股、美股价格拉取
- 无股票市场分类标记
- 无独立的股票详细视图（市值、盈亏、盈亏率）
- 无股票组合级汇总（总市值、总盈亏）

---

## 方案概述

采用**方案一：复用现有资产体系**，最小改动实现目标。

---

## 任务分解

### Task 1: 扩展 Asset 实体 — 新增 market 字段

**Files:**
- Modify: `backend/src/modules/assets/assets.entity.ts`

**改动：**
- 新增 `@Column({ type: 'varchar', length: 10, nullable: true }) market: string | null`
- 用于区分 `cn`（A股）、`hk`（港股）、`us`（美股）

---

### Task 2: 增强 StockService — 支持港股/美股

**Files:**
- Modify: `backend/src/modules/stock/stock.service.ts`

**改动：**
- `guessExchangePrefix` 重命名为更通用的 `guessMarket`，返回 `{ market, prefix }`
- 新增港股识别：纯数字 5 位或 `0` 开头 5 位 → `hk`
- 新增美股识别：全字母代码（如 `AAPL`、`TSLA`）→ `us`
- 新增 `fetchHKPrice(code)`：通过 Sina 港股接口 `https://hq.sinajs.cn/list=hk00700`
- 新增 `fetchUSPrice(code)`：通过腾讯/新浪美股接口
- `getStockPrice(code)` 根据市场分发到对应 fetch 方法

---

### Task 3: 资产表单新增市场下拉

**Files:**
- Modify: `frontend/src/components/forms/AssetFormModal.tsx`

**改动：**
- 当 `category === 'stock'` 时，显示「市场」下拉选择：`cn` / `hk` / `us`
- 表单提交时携带 `market` 字段

---

### Task 4: 新建 StockSlide 组件

**Files:**
- Create: `frontend/src/components/slides/StockSlide.tsx`

**功能：**
- 拉取当前用户所有 `category === 'stock'` 的资产
- 页面加载时自动调用 `POST /assets/batch-refresh-prices`（或复用现有查询接口，后端已在 `findByUser` 中实时计算）
- 表格列：名称、市场、代码、数量、成本价、现价、市值、盈亏、盈亏率
- 标题栏显示：
  - 股票总市值
  - 总盈亏金额 + 盈亏率

---

### Task 5: 接入 Dashboard

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/layout/DockNavigation.tsx`（可选，若需要导航锚点）

**改动：**
- 在 `asset-allocation` section 内或之后插入 `<StockSlide />`
- 为股票区域添加 `id="stock-holdings"` 锚点

---

## API 变更

| 方法 | 路径 | 变更 |
|------|------|------|
| GET | `/assets` | 返回中 `market` 字段自然带出 |
| POST | `/assets` | 接收 `market` 字段 |
| PATCH | `/assets/:id` | 接收 `market` 字段 |

---

## 数据流

```
页面刷新
  → StockSlide 挂载
    → 调用 GET /assets?category=stock（或统一 GET /assets 后过滤）
      → AssetsService.findByUser
        → StockService.getMultiplePrices(stockCodes)
          → 按市场分发：fetchSinaPrice / fetchHKPrice / fetchUSPrice
        → 计算 currentValue = quantity × price
        → 计算 unitPrice = price
    → 前端渲染表格
    → 前端聚合：totalValue = ΣcurrentValue
totalPnl = Σ(currentValue - costBasis×quantity)
```

---

## 错误处理

- 某支股票价格拉取失败 → 显示「--」或沿用缓存，不影响其他股票
- 全部价格源失败 → 显示上次缓存价格，标题栏提示「价格更新失败」

---

## 测试策略

- `StockService` 单元测试：验证 A股/港股/美股代码识别逻辑
- 手动验证：添加 A股、港股、美股各一支，确认刷新后价格正确、市值/盈亏计算正确
