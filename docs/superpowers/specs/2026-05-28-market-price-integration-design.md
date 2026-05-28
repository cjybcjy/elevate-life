# Market Price Integration Design

## Overview

为实物黄金、纸黄金、股票、基金等资产分类自动获取公开市场价格，用户只需记录克数/份数，系统自动计算市值。每次登录时异步更新价格，支持手动刷新。

## 1. Data Model

### Asset 表新增字段

```prisma
model Asset {
  // ... existing fields ...
  quantity       Decimal?  @db.Decimal(18, 4)   // 持有数量（克/股/份）
  stockCode      String?                         // 证券代码
  market         String?                         // cn / hk / us
  costUnitPrice  Decimal?  @db.Decimal(18, 4)   // 成本单价（每克/每股买入价）
}
```

字段关系：
- `quantity` — 用户输入的持有数量
- `costUnitPrice` — 用户输入的成本单价
- `costPrice` — 成本总值 = quantity × costUnitPrice（保留现有字段，自动计算）
- 当前单价 — 从 MarketPrice 表查询
- 市场价值（即 `balance`）= quantity × 当前单价（自动计算，不再由用户输入）
- 盈亏 = 市场价值 - 成本总值

对于黄金：quantity = 克数，当前单价 = 每克金价
对于股票/基金：quantity = 股数/份数，当前单价 = 每股/份价格
对于现金/房产/债券/其他：这些字段为空，balance 仍手动输入

### MarketPrice 统一价格表

```prisma
model MarketPrice {
  id        String   @id @default(uuid())
  code      String                          // 证券/商品代码
  market    String                          // cn / hk / us / commodity
  name      String                          // 名称
  price     Decimal  @db.Decimal(18, 4)    // 当前单价
  source    String?                         // 数据来源
  updatedAt DateTime @updatedAt

  @@unique([code, market])
  @@index([market])
}
```

替代现有 GoldPrice 和 StockPrice 表。Migration 时将旧数据迁移后删除旧表。

## 2. Price Service

### 文件结构

```
src/lib/services/price/
├── index.ts          // PriceService 统一入口
├── sources/
│   ├── cn-stock.ts   // A股：东方财富 push2.eastmoney.com
│   ├── hk-stock.ts   // 港股：腾讯 qt.gtimg.cn
│   ├── us-stock.ts   // 美股：新浪 hq.sinajs.cn
│   └── gold.ts       // 黄金：新浪贵金属接口
└── anti-crawl.ts     // 反爬虫工具
```

### 反爬虫策略

- User-Agent 池随机轮换（Chrome/Safari/Edge 各版本）
- 请求间隔随机 1-3 秒
- 失败重试 3 次，指数退避（2s / 4s / 8s）
- 带 Referer 头模拟从财经网站跳转
- 每次请求随机延迟，避免固定频率触发反爬

### 数据源映射

| 市场 | 数据源 | 代码示例 |
|------|--------|---------|
| cn (A股) | push2.eastmoney.com 或 hq.sinajs.cn | 600519, 000001 |
| hk (港股) | qt.gtimg.cn | 00700, 09988 |
| us (美股) | hq.sinajs.cn | AAPL, TSLA |
| commodity (黄金) | hq.sinajs.cn 贵金属 | AU9999 |

### 关键方法

```ts
class PriceService {
  static async fetchPrice(code: string, market: string): Promise<PriceResult>
  static async fetchPricesBatch(items: {code: string, market: string}[]): Promise<PriceResult[]>
  static async refreshPrices(assets: Asset[]): Promise<void>
  static isStale(updatedAt: Date): boolean  // 超过1小时视为过期
}
```

`refreshPrices` 收集所有市场定价资产的 code+market，去重后批量拉取，结果写入 MarketPrice 表（upsert by code+market）。

## 3. Update Triggers

### 登录后异步刷新

1. Dashboard server component 调用 `getAssets()`
2. `getAssets()` 解密资产后，为每个市场定价资产从 MarketPrice 表附加最新价格
3. 检查价格是否过期（>1h），返回 `pricesStale: boolean`
4. Dashboard 内嵌 `<PriceRefresher />` 客户端组件
5. 若 `pricesStale`，useEffect 中调用 `refreshMyPrices()` server action
6. 完成后 `router.refresh()` 刷新页面数据
7. 整个过程不阻塞页面渲染

### 手动刷新

- 刷新按钮在资产列表和 StockTable 上方
- 调用 `refreshMyPrices()` server action
- 按钮显示 loading 旋转动画
- 完成后页面自动刷新，短暂提示"价格已更新"
- 失败时显示错误 toast

### Cron 定时任务

- `/api/cron/prices` 端点（复用现有 `/api/cron/gold` 模式）
- CRON_SECRET 保护
- 每小时触发，扫描所有用户持仓代码去重后批量刷新

## 4. Error Handling

| 场景 | 处理 |
|------|------|
| API 网络错误/被反爬 | 使用 DB 最近价格兜底，前端标记"价格可能不是最新" |
| 首次添加无历史价格 | 必须拉取成功，失败则提示用户稍后重试 |
| API 超时（5s） | 放弃本次拉取，保留旧价格，不阻塞页面 |
| 用户无市场定价资产 | 跳过刷新逻辑 |
| 非交易时段 | 返回最新收盘价，标记来源为"收盘价" |
| 代码停牌/退市 | 返回特殊标记，前端显示"停牌"而非错误 |

## 5. UI Changes

### 新增资产表单

分类选择联动表单：
- 实物黄金/纸黄金：名称 + 克数 + 成本单价 + 货币
- 股票/基金：名称 + 市场(cn/hk/us) + 代码 + 股数/份数 + 成本单价
- 现金/房产/债券/其他：名称 + 金额（手动，保持现状）

代码输入后自动查名称确认（如 600519 → "贵州茅台"）。

### 资产列表

新增列：代码、市场、持有数量、成本单价、当前单价、市场价值、盈亏

### StockTable 完善

补齐现有的 stockCode、market、quantity、unitPrice、currentValue 字段，展示持仓盈亏表。

## 6. Testing

- 单元测试：PriceService 各市场 URL 构造、响应解析、反爬虫 header
- 集成测试：拉取价格 → 写入 MarketPrice → getAssets 附加价格
- 边界：API 异常格式、网络超时、空持仓、停牌代码
- 手动验证：创建各类型资产 → 确认市值 → 点击刷新 → 确认更新
