# Family Ledger Pro - 系统设计文档

**日期**: 2026-05-12  
**版本**: v1.0  
**状态**: 待实现评审

---

## 1. 项目概述

Family Ledger Pro 是一个前后端分离的家庭财务管理系统。核心逻辑为"资产动态化、负债可视化、支出结构化"。系统通过实时金价折算、债务利息模拟和现金流风险预警，帮助用户掌控长期财务健康。

**技术栈**:
- 后端: NestJS + TypeScript + TypeORM
- 前端: React 18 + Vite + Tailwind CSS + ECharts
- 数据库: PostgreSQL
- 加密: node:crypto (AES-256-GCM)
- 财务计算: decimal.js + mathjs

---

## 2. 系统架构概览

### 2.1 整体结构

单体后端 + SPA 前端，前后端通过 RESTful API + JSON 通信。

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (React 18 + Vite)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Dashboard │ │ 资产页   │ │ 负债页   │ │ 预测页   │       │
│  │ (PPT风格) │ │ (PPT风格)│ │ (PPT风格)│ │ (PPT风格)│       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS / JSON
┌────────────────────────▼────────────────────────────────────┐
│                    后端 (NestJS + TypeScript)                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Controller  │ │  Service    │ │ Repository  │           │
│  │  (API 层)    │ │  (业务层)    │ │  (数据访问)  │           │
│  └─────────────┘ └──────┬──────┘ └─────────────┘           │
│                         │                                   │
│  ┌──────────────┬───────┴────────┬──────────────┐         │
│  │ AssetService │ LiabilityService│ GoldService  │         │
│  │ ForecastSvc  │ EncryptService  │ AmortizeSvc  │         │
│  └──────────────┴────────────────┴──────────────┘         │
│                         │                                   │
│              ┌──────────▼──────────┐                      │
│              │   PostgreSQL        │                      │
│              └──────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 后端核心模块

| 模块 | 职责 |
|---|---|
| `AssetModule` | 资产 CRUD、分类管理、黄金价值实时折算 |
| `LiabilityModule` | 负债 CRUD、还款计划生成、利率管理 |
| `TransactionModule` | 收支记录、分类标签（刚性/弹性） |
| `ForecastModule` | 现金流模拟、WACR 计算、压力测试 |
| `GoldModule` | 金价定时抓取、历史价格缓存、异常熔断 |
| `EncryptionModule` | 金额字段加解密、阈值判断 |

### 2.3 前端核心页面（PPT 风格）

| 页面 | 功能 |
|---|---|
| Slide 1: 净资产总览 | 净资产大数字、资产/负债卡片、趋势迷你图 |
| Slide 2: 资产配置 | 环形图、资产列表、黄金呼吸灯卡片 |
| Slide 3: 负债漏斗 | 债务漏斗图、还款计划、WACR |
| Slide 4: 剪刀图 | 收支曲线、生存线、预警区域 |
| Slide 5: 未来预测 | 现金流预测、生存月数、压力测试参数 |

**翻页方式**: 键盘 `←` `→` / 鼠标滚轮 / 移动端左右滑动

---

## 3. 数据库设计

### 3.1 核心表结构

#### `users`
```sql
id              UUID PK
username        VARCHAR(50) UNIQUE
password_hash   VARCHAR(255)  -- bcrypt
display_name    VARCHAR(100)
encrypted_dek   VARCHAR(255)  -- 数据加密密钥（KEK 加密后存储）
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

#### `assets`
```sql
id              UUID PK
user_id         UUID FK → users
name            VARCHAR(200)
category        VARCHAR(50)            -- 房产/黄金/股票/现金/车辆等
balance         VARCHAR(500)           -- 明文或密文（金额 >= 50万时加密）
currency        VARCHAR(3) DEFAULT 'CNY'
valuation_method VARCHAR(50)           -- manual/auto/gold/live_stock
liquidity_tier  VARCHAR(20)            -- T+0 / T+7 / T+30 / T+N
is_encrypted    BOOLEAN DEFAULT false
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

#### `liabilities`
```sql
id              UUID PK
user_id         UUID FK → users
name            VARCHAR(200)
category        VARCHAR(50)            -- 房贷/车贷/信用卡/消费贷
principal       VARCHAR(500)           -- 本金（可能加密）
current_balance VARCHAR(500)           -- 当前剩余应还（可能加密）
interest_rate   DECIMAL(6, 4)          -- 年利率
term_months     INTEGER
start_date      DATE
payment_method  VARCHAR(20)            -- equal_interest / equal_principal
monthly_payment VARCHAR(500)           -- 月供（可能加密）
is_encrypted    BOOLEAN DEFAULT false
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

#### `debt_milestones`
```sql
id              UUID PK
liability_id    UUID FK → liabilities
month_index     INTEGER
due_date        DATE
principal_due   DECIMAL(18, 4)
interest_due    DECIMAL(18, 4)
total_due       DECIMAL(18, 4)
remaining_balance DECIMAL(18, 4)
scenario_type   VARCHAR(20) DEFAULT 'base'
created_at      TIMESTAMPTZ
```

#### `transactions`
```sql
id              UUID PK
user_id         UUID FK → users
type            VARCHAR(10)            -- income / expense
amount          DECIMAL(18, 4)         -- 明文存储（日常流水极少超 50万）
category_id     UUID FK → categories
description     TEXT
occurred_at     DATE
is_essential    BOOLEAN
created_at      TIMESTAMPTZ
```

#### `categories`
```sql
id              UUID PK
user_id         UUID FK → users
name            VARCHAR(100)
type            VARCHAR(10)            -- income / expense
is_essential    BOOLEAN DEFAULT false
essential_ratio DECIMAL(3, 2) DEFAULT 1.00
icon            VARCHAR(50)
color           VARCHAR(7)
```

#### `price_history`
```sql
id              UUID PK
asset_type      VARCHAR(20) DEFAULT 'gold_au9999'
price           DECIMAL(18, 4)
data_source     VARCHAR(100)
is_interpolated BOOLEAN DEFAULT false
recorded_at     TIMESTAMPTZ
```

### 3.2 索引策略

- `assets(user_id, category)`, `liabilities(user_id)`
- `debt_milestones(liability_id, month_index)`
- `transactions(user_id, occurred_at DESC)`
- `price_history(asset_type, recorded_at DESC)`

---

## 4. 核心业务逻辑

### 4.1 金价实时联动模块 (GoldService)

**抓取策略**:
- `@nestjs/schedule` 每小时执行 `fetchGoldPrice()`
- 数据源: 上海黄金交易所 AU9999 现货，备用源: 伦敦金折算汇率
- 每次抓取后写入 `price_history`

**异常熔断**:
```typescript
if (abs(newPrice - lastPrice) / lastPrice > 0.05) {
  // 波动超过 5%，不写入，记录告警，使用上一次有效价格
  return lastPrice;
}
```

**Fallback**: 所有数据源失败时，使用 `price_history` 最近一条记录。API 响应携带 `meta.last_gold_price_sync` 时间戳。

**黄金资产价值计算**: `实时价值 = 持有克数 × 实时金价`

### 4.2 还款计划生成器 (AmortizationService)

采用 **Strategy 模式**:
```typescript
interface AmortizationStrategy {
  generateSchedule(principal: Decimal, rate: Decimal, months: number): Milestone[];
}
```

**等额本息公式**:
```
月还款额 = [本金 × 月利率 × (1+月利率)^期数] / [(1+月利率)^期数 - 1]
```

使用 `mathjs` 确保精度。

**触发时机**: 新增/修改负债时异步生成未来 12 个月 `debt_milestones`。

**多版本支持**: `scenario_type` = `base` / `rate_up_1pct` / `prepay_XXX`

### 4.3 净资产实时核算

**公式**:
```
净资产 = (流动资产 + 不动产 + 动产 + 黄金实时价值) - 总负债
```

**计算逻辑**:
1. 查询用户所有资产，黄金类调用 `GoldService.getCurrentPrice()` 实时折算
2. 负债取 `current_balance`
3. 加密字段在 Repository 层自动解密（通过 TypeORM transformer）
4. 所有计算使用 `Decimal.js`，结果保留 2 位小数

### 4.4 WACR（加权平均贷款利率）

```
WACR = Σ(单项负债余额 × 该项年利率) / 总负债余额
```

- 只计算有息负债
- 结果以百分比展示

### 4.5 现金流模拟 (ForecastService)

**输入参数**:
- `months`: 模拟月数（默认 12）
- `incomeAdjustment`: 收入变动率（默认 0%，可设 -20%）
- `rateAdjustment`: 利率变动（默认 0%，可设 +1%）
- `oneOffExpenses`: 大额支出事件数组

**输出**:
```typescript
interface CashflowForecast {
  months: {
    month: string;
    projectedIncome: Decimal;
    projectedExpense: Decimal;
    projectedSurplus: Decimal;
    cumulativeSurplus: Decimal;
  }[];
  runwayMonths: number;
  minSurplusMonth: string;
  warningLevel: 'green' | 'yellow' | 'red';
}
```

**预警逻辑**:
- 盈余率 > 20%: `green`
- 盈余率 10%~20%: `yellow`
- 盈余率 < 10% 或赤字: `red`

### 4.6 加密策略 (EncryptionService)

**简化版实现**:
- 单密钥: `ENCRYPTION_KEY` 存储于 `.env`
- 阈值: `ENCRYPTION_THRESHOLD = 500000`（50 万元，可配置）
- 金额 >= 50万: AES-256-GCM 加密，格式 `enc:<base64_iv_authTag_ciphertext>`
- 金额 < 50万: 明文存储

**TypeORM Transformer**:
```typescript
@Column({
  type: 'text',
  transformer: {
    to: (value: Decimal | null) => {
      if (!value || value.lessThan(500000)) return value?.toString();
      return 'enc:' + encryptionService.encrypt(value.toString());
    },
    from: (value: string | null) => {
      if (!value) return null;
      if (value.startsWith('enc:')) {
        return new Decimal(encryptionService.decrypt(value.slice(4)));
      }
      return new Decimal(value);
    }
  }
})
```

**密钥轮换**: 单用户数据量小（几百条），修改 `ENCRYPTION_KEY` 后启动时全表重加密，几秒完成。

---

## 5. UI/UX 设计规范

### 5.1 布局哲学: PPT 风格

- 全屏卡片化，一页一主题
- 大面积留白
- 去导航化，底部 Dock 栏指示页码
- 翻页: 键盘 `←` `→` / 滚轮 / 移动端滑动

### 5.2 五大幻灯片页面

**Slide 1: 净资产总览**
- 超大净资产数字
- 资产/负债卡片
- 净资产趋势迷你图
- 资产健康度 + 盈余率

**Slide 2: 资产配置**
- 环形图/旭日图
- 资产列表（含黄金呼吸灯卡片）

**Slide 3: 负债漏斗**
- 债务漏斗图（按利率排序）
- WACR 大数字
- 还款计划摘要

**Slide 4: 剪刀图**
- 收入线（蓝）vs 支出线（红）
- 生存线（灰虚线）
- 绿/黄/红预警区域填充
- 本月盈余 + 未来预警提示

**Slide 5: 未来预测**
- 12 个月现金流柱状图/面积图
- 生存月数、财务自由进度
- 压力测试参数调整控件

### 5.3 配色方案 (Deep Dark)

```css
theme: {
  extend: {
    colors: {
      'ledger-bg': '#0f172a',
      'ledger-surface': '#1e293b',
      'ledger-primary': '#1e3a8a',
      'ledger-accent': '#3b82f6',
      'ledger-text': '#ffffff',
      'ledger-muted': '#94a3b8',
      'ledger-success': '#10b981',
      'ledger-warning': '#f59e0b',
      'ledger-danger': '#ef4444',
    }
  }
}
```

**字体层级**:
- 页面标题: 48px, 字重 300, 白色
- 大数字: 72px, 字重 700, 白色
- 正文: 16px, `#94a3b8`
- 卡片圆角: 16px

### 5.4 核心交互

**黄金呼吸灯卡片**:
```css
@keyframes breathe {
  0%, 100% { box-shadow: 0 0 10px rgba(59, 130, 246, 0.2); }
  50% { box-shadow: 0 0 25px rgba(59, 130, 246, 0.6); }
}
.gold-card { animation: breathe 3s ease-in-out infinite; }
```

**金额展示**:
- 默认格式: `¥123,456.78`
- 敏感金额脱敏: `¥12*,***.**`，点击眼睛图标临时展示
- 输入框: 自动千分位格式化

**动画**:
- 页面切换: 淡入淡出 300ms
- 数字更新: CountUp 滚动动画
- 图表: 渐进绘制动画

### 5.5 响应式策略

- **桌面端** (>1024px): 完整 PPT 全屏体验
- **平板端** (768px~1024px): 保持布局，图表自适应缩小
- **移动端** (<768px): 底部 Tab 简化导航，图表可展开/收起

---

## 6. API 设计

### 6.1 统一响应格式

```typescript
interface ApiResponse<T> {
  data: T;
  meta: {
    timestamp: string;
    requestId: string;
    lastGoldPriceSync?: string;
  };
}
```

### 6.2 接口清单

#### 认证
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/auth/register` | 注册 |
| POST | `/auth/login` | 登录，返回 JWT |
| POST | `/auth/refresh` | 刷新 Token |

#### 资产
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/assets` | 资产列表（含实时黄金价值） |
| POST | `/assets` | 新增资产 |
| GET | `/assets/:id` | 资产详情 |
| PATCH | `/assets/:id` | 更新资产 |
| DELETE | `/assets/:id` | 删除资产 |
| GET | `/assets/summary` | 资产汇总 |

#### 负债
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/liabilities` | 负债列表 |
| POST | `/liabilities` | 新增负债（自动触发还款计划生成） |
| GET | `/liabilities/:id` | 负债详情 |
| PATCH | `/liabilities/:id` | 更新负债 |
| DELETE | `/liabilities/:id` | 删除负债 |
| GET | `/liabilities/:id/schedule` | 还款计划 |

#### 流水
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/transactions` | 流水列表（支持按月份、分类筛选） |
| POST | `/transactions` | 记一笔 |
| GET | `/transactions/summary` | 月度收支汇总 |

#### 预测
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/forecast/cashflow` | 现金流预测 |
| POST | `/forecast/cashflow` | 带参数的现金流模拟 |
| GET | `/forecast/wacr` | 加权平均贷款利率 |
| GET | `/forecast/runway` | 生存月数 |

#### 金价
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/gold/price` | 当前金价 |
| GET | `/gold/history` | 金价历史 |

### 6.3 关键请求示例

**新增资产**:
```json
POST /assets
{
  "name": "工商银行纸黄金",
  "category": "gold",
  "balance": "150.50",
  "currency": "CNY",
  "liquidityTier": "T+1"
}
```

**现金流模拟**:
```json
POST /forecast/cashflow
{
  "months": 12,
  "incomeAdjustment": -0.20,
  "rateAdjustment": 0.01,
  "oneOffExpenses": [
    { "month": 3, "amount": "50000", "description": "子女学费" }
  ]
}
```

---

## 7. 安全与部署

### 7.1 安全策略

| 层级 | 措施 |
|---|---|
| 传输层 | HTTPS Only，TLS 1.3 |
| 认证 | JWT（Access Token 15分钟 + Refresh Token 7天） |
| 密码存储 | bcrypt，cost factor 12 |
| 敏感数据 | 金额 >= 50万 AES-256-GCM 加密 |
| 前端展示 | 默认脱敏，点击显示完整金额 |
| 请求限流 | `@nestjs/throttler`：每 IP 100 请求/分钟 |
| CORS | 白名单制 |

### 7.2 部署架构

单服务器 Docker Compose 起步:

```
Nginx (反向代理 + SSL 终止)
├── NestJS API (:3000)
├── React SPA (:80)
└── PostgreSQL (:5432)
```

**环境变量**:
```bash
DATABASE_URL=postgresql://user:pass@postgres:5432/ledger
ENCRYPTION_KEY=your-32-byte-key-here
JWT_SECRET=your-jwt-secret
JWT_EXPIRATION=15m
GOLD_API_KEY=your-api-key
GOLD_API_URL=https://api.gold.com/price
PORT=3000
NODE_ENV=production
```

---

## 8. 错误处理

### 8.1 统一错误响应

```typescript
{
  "error": {
    "code": "LIABILITY_NOT_FOUND",
    "message": "负债记录不存在",
    "details": { "liabilityId": "xxx" }
  }
}
```

### 8.2 错误码定义

| 错误码 | 场景 | HTTP 状态 |
|---|---|---|
| `UNAUTHORIZED` | 未登录或 Token 过期 | 401 |
| `FORBIDDEN` | 无权访问他人数据 | 403 |
| `VALIDATION_ERROR` | 请求参数非法 | 400 |
| `INSUFFICIENT_FUNDS` | 操作导致净资产为负 | 422 |
| `GOLD_API_UNAVAILABLE` | 金价接口不可用 | 503 |
| `INTERNAL_ERROR` | 服务器内部错误 | 500 |

---

## 9. 测试策略

| 测试类型 | 范围 | 工具 |
|---|---|---|
| 单元测试 | Service 层业务逻辑 | Jest |
| 集成测试 | API 端到端 | Jest + Supertest |
| E2E 测试 | 关键用户流程 | Playwright |

### 9.1 核心测试用例

- **AmortizationService**: 等额本息 100万、30年、4.9%，月供应为 ¥5,307.27（与银行标准计算器对比）
- **EncryptionService**: 加密后解密，金额精度不变（Decimal 等价性验证）
- **GoldService**: 异常价格（波动 > 5%）触发熔断，不写入数据库
- **ForecastService**: 收入下降 20% + 利率上升 1% 场景下，预测结果符合预期

---

## 10. 前端技术栈

```json
{
  "react": "^18.2.0",
  "react-router-dom": "^6.20.0",
  "tailwindcss": "^3.4.0",
  "echarts": "^5.4.3",
  "echarts-for-react": "^3.0.2",
  "decimal.js-light": "^2.5.1",
  "axios": "^1.6.0",
  "react-hook-form": "^7.48.0",
  "zustand": "^4.4.0"
}
```

**状态管理 (Zustand)**:
```typescript
interface FinanceState {
  netWorth: Decimal;
  goldPrice: Decimal;
  lastSync: string;
  currentSlide: number;
  setNetWorth: (value: Decimal) => void;
  nextSlide: () => void;
  prevSlide: () => void;
}
```
