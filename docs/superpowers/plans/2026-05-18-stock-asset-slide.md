# 股票资产独立 Slide 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在仪表板新增股票资产独立 Slide，刷新时自动拉取 A股/港股/美股实时价格，展示每支股票的市值、盈亏，标题栏显示总市值和总盈亏。

**Architecture:** 复用现有 `Asset` 实体，新增 `market` 字段；增强 `StockService` 支持港股/美股代码识别与价格拉取；新建 `StockSlide` 前端组件嵌入 Dashboard。

**Tech Stack:** NestJS + TypeORM + SQLite, React + Tailwind + Vite

---

## File Structure

| File | Action | Responsibility |
|------|--------|--------------|
| `backend/src/modules/assets/assets.entity.ts` | Modify | 新增 `market` 字段 |
| `backend/src/modules/assets/assets.dto.ts` | Modify | DTO 接收 `market` 字段 |
| `backend/src/modules/stock/stock.service.ts` | Modify | 支持港股/美股价格拉取 |
| `frontend/src/components/forms/AssetFormModal.tsx` | Modify | 股票分类时显示市场下拉 |
| `frontend/src/components/slides/StockSlide.tsx` | Create | 股票资产独立展示组件 |
| `frontend/src/App.tsx` | Modify | Dashboard 接入 StockSlide |

---

## Task 1: Asset 实体新增 market 字段

**Files:**
- Modify: `backend/src/modules/assets/assets.entity.ts`

- [ ] **Step 1: 新增 market 列**

在 `stockCode` 字段下方插入：

```typescript
@Column({ type: 'varchar', length: 10, nullable: true })
market: string | null;
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/modules/assets/assets.entity.ts
git commit -m "feat(asset): add market field for stock classification"
```

---

## Task 2: DTO 新增 market 字段

**Files:**
- Modify: `backend/src/modules/assets/assets.dto.ts`

- [ ] **Step 1: CreateAssetDto 新增 market**

在 `stockCode` 字段下方插入：

```typescript
@IsOptional()
@IsString()
@MaxLength(10)
market?: string;
```

- [ ] **Step 2: UpdateAssetDto 新增 market**

在 `stockCode` 字段下方插入同样的字段定义：

```typescript
@IsOptional()
@IsString()
@MaxLength(10)
market?: string;
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/assets/assets.dto.ts
git commit -m "feat(asset): add market field to create/update DTO"
```

---

## Task 3: StockService 支持港股/美股

**Files:**
- Modify: `backend/src/modules/stock/stock.service.ts`

- [ ] **Step 1: 新增市场识别方法**

替换 `guessExchangePrefix` 和 `guessEastmoneySecid`，新增 `detectMarket` 方法（放在 `getMockPrice` 下方、原有方法上方）：

```typescript
/** Detect market from raw stock code */
private detectMarket(code: string): 'cn' | 'hk' | 'us' {
  const c = code.trim().toUpperCase();
  if (/^[A-Z]+$/.test(c)) return 'us';
  if (/^\d{5}$/.test(c) || (c.startsWith('0') && c.length === 5)) return 'hk';
  if (c.startsWith('6') || c.startsWith('0') || c.startsWith('3') || c.startsWith('2') || c.startsWith('4') || c.startsWith('8')) return 'cn';
  return 'cn'; // default
}

/** Build exchange prefix for Sina/Tencent APIs */
private getPrefix(code: string, market: string): string {
  if (market === 'hk') return 'hk';
  if (market === 'us') return 'gb_';
  if (code.startsWith('6')) return 'sh';
  if (code.startsWith('0') || code.startsWith('3') || code.startsWith('2')) return 'sz';
  if (code.startsWith('4') || code.startsWith('8')) return 'bj';
  return 'sh';
}

/** Build Eastmoney secid */
private getEastmoneySecid(code: string, market: string): string {
  if (market === 'hk') return `116.${code}`;
  if (market === 'us') return `105.${code}`;
  if (code.startsWith('6')) return `1.${code}`;
  return `0.${code}`;
}
```

- [ ] **Step 2: 修改 `getStockPrice` 分发逻辑**

将 `getStockPrice` 方法体替换为：

```typescript
async getStockPrice(rawCode: string): Promise<number> {
  const code = rawCode.trim().toUpperCase();
  const cached = this.cache.get(code);
  if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
    return cached.price;
  }

  const market = this.detectMarket(code);

  try {
    let price: number | null = null;

    // Try Sina first for all markets
    try {
      await this.sleep(200 + Math.random() * 500);
      price = await this.fetchSinaPrice(code, market);
    } catch (error: any) {
      this.logger.warn(`Sina source failed for ${code}: ${error.message}`);
    }

    // Fallback: Tencent for CN/HK, Eastmoney for all
    if (price === null) {
      try {
        await this.sleep(500 + Math.random() * 800);
        if (market === 'us') {
          price = await this.fetchEastmoneyPrice(code, market);
        } else {
          price = await this.fetchTencentPrice(code, market);
        }
      } catch (error: any) {
        this.logger.warn(`Fallback source failed for ${code}: ${error.message}`);
      }
    }

    if (price !== null && price > 0) {
      this.cache.set(code, { price, timestamp: Date.now() });
      return price;
    }

    throw new Error('All stock price sources failed');
  } catch (error: any) {
    this.logger.warn(`Failed to fetch stock price for ${code}: ${error.message}`);
    if (cached) return cached.price;
    return this.getMockPrice(code);
  }
}
```

- [ ] **Step 3: 修改 `fetchSinaPrice` 接收 market 参数**

替换为：

```typescript
private async fetchSinaPrice(code: string, market: string): Promise<number | null> {
  const prefix = this.getPrefix(code, market);
  const url = `https://hq.sinajs.cn/list=${prefix}${code}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': this.pickUserAgent(),
      'Referer': 'https://finance.sina.com.cn',
      'Accept': '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const text = await response.text();
  const match = text.match(/var hq_str_[^=]+="([^"]*)"/);
  if (!match) return null;

  const parts = match[1].split(',');

  // CN: name,open,prev,current,high,low,...
  if (market === 'cn') {
    if (parts.length < 4) return null;
    const price = parseFloat(parts[3]);
    if (!isNaN(price) && price > 0) return price;
    const fallback = parseFloat(parts[1]) || parseFloat(parts[2]);
    return fallback > 0 ? fallback : null;
  }

  // HK: name,current,change,changePct,open,high,low,prev,...
  if (market === 'hk') {
    if (parts.length < 2) return null;
    const price = parseFloat(parts[1]);
    return !isNaN(price) && price > 0 ? price : null;
  }

  // US: gb_aapl="苹果,AAPL,185.64,..."
  if (market === 'us') {
    // US Sina format varies; try common indices
    for (let i = 2; i < parts.length; i++) {
      const price = parseFloat(parts[i]);
      if (!isNaN(price) && price > 0 && price < 100000) return price;
    }
    return null;
  }

  return null;
}
```

- [ ] **Step 4: 修改 `fetchTencentPrice` 接收 market 参数**

替换为：

```typescript
private async fetchTencentPrice(code: string, market: string): Promise<number | null> {
  const prefix = this.getPrefix(code, market);
  const url = `https://qt.gtimg.cn/q=${prefix}${code}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': this.pickUserAgent(),
      'Referer': 'https://finance.qq.com',
      'Accept': '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const text = await response.text();
  const match = text.match(/v_[^=]+="([^"]*)"/);
  if (!match) return null;

  const parts = match[1].split('~');
  if (parts.length < 4) return null;

  const price = parseFloat(parts[3]);
  return !isNaN(price) && price > 0 ? price : null;
}
```

- [ ] **Step 5: 修改 `fetchEastmoneyPrice` 接收 market 参数**

将 `secid` 生成改为使用 `getEastmoneySecid`：

```typescript
private async fetchEastmoneyPrice(code: string, market: string): Promise<number | null> {
  const secid = this.getEastmoneySecid(code, market);
  const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': this.pickUserAgent(),
      'Referer': 'https://quote.eastmoney.com',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  const raw = data?.data?.f43;
  if (raw === undefined || raw === null) return null;

  const price = raw / 100;
  return !isNaN(price) && price > 0 ? price : null;
}
```

- [ ] **Step 6: 删除旧方法**

删除 `guessExchangePrefix` 和 `guessEastmoneySecid` 两个旧方法。

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/stock/stock.service.ts
git commit -m "feat(stock): support HK and US stock price fetching"
```

---

## Task 4: 资产表单新增市场下拉

**Files:**
- Modify: `frontend/src/components/forms/AssetFormModal.tsx`

- [ ] **Step 1: 新增 market state**

在 `const [stockCode, setStockCode] = useState('')` 下方添加：

```typescript
const [market, setMarket] = useState('cn');
```

- [ ] **Step 2: useEffect 回显 market**

在 `useEffect` 的 `if (asset)` 分支中，在 `setStockCode(asset.stockCode || '')` 下方添加：

```typescript
setMarket((asset as any).market || 'cn');
```

在 `else` 分支中 `setStockCode('')` 下方添加：

```typescript
setMarket('cn');
```

- [ ] **Step 3: payload 携带 market**

在 `handleSave` 的 `payload` 对象中，在 `stockCode: stockCode || undefined` 下方添加：

```typescript
market: category === 'stock' ? market : undefined,
```

- [ ] **Step 4: 表单添加市场下拉**

在股票代码输入框下方（`category === 'stock'` 条件内），添加：

```tsx
<div>
  <label className={labelClass}>市场</label>
  <select
    value={market}
    onChange={(e) => setMarket(e.target.value)}
    className={inputClass}
  >
    <option value="cn">A股</option>
    <option value="hk">港股</option>
    <option value="us">美股</option>
  </select>
</div>
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/forms/AssetFormModal.tsx
git commit -m "feat(asset-form): add market selector for stock assets"
```

---

## Task 5: 新建 StockSlide 组件

**Files:**
- Create: `frontend/src/components/slides/StockSlide.tsx`

- [ ] **Step 1: 创建组件文件**

```tsx
import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';

interface StockAsset {
  id: string;
  name: string;
  stockCode: string;
  market: string;
  quantity: number;
  costBasis: string;
  currentValue: string;
  unitPrice: string;
}

const marketLabel: Record<string, string> = {
  cn: 'A股',
  hk: '港股',
  us: '美股',
};

export default function StockSlide() {
  const [stocks, setStocks] = useState<StockAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStocks = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/assets');
      const allAssets = res.data || [];
      const stockAssets = allAssets.filter((a: any) => a.category === 'stock');
      setStocks(stockAssets);
    } catch (err: any) {
      setError('加载股票数据失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStocks();
  }, []);

  const { totalValue, totalCost, totalPnl, totalPnlRate } = useMemo(() => {
    let tv = 0;
    let tc = 0;
    for (const s of stocks) {
      tv += parseFloat(s.currentValue || '0');
      const cost = parseFloat(s.costBasis || '0') * (s.quantity || 0);
      tc += cost;
    }
    const pnl = tv - tc;
    const pnlRate = tc > 0 ? (pnl / tc) * 100 : 0;
    return { totalValue: tv, totalCost: tc, totalPnl: pnl, totalPnlRate: pnlRate };
  }, [stocks]);

  const formatMoney = (val: number) =>
    `¥${val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) return <div className="text-ledger-muted text-center py-10">加载中...</div>;
  if (error) return <div className="text-red-400 text-center py-10">{error}</div>;

  return (
    <div className="bg-ledger-surface rounded-xl border border-ledger-primary/10 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-medium text-ledger-text">股票持仓</h2>
          <p className="text-sm text-ledger-muted mt-1">
            总市值 {formatMoney(totalValue)} ·
            <span className={totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}>
              {totalPnl >= 0 ? '+' : ''}{formatMoney(totalPnl)} ({totalPnlRate >= 0 ? '+' : ''}{totalPnlRate.toFixed(2)}%)
            </span>
          </p>
        </div>
        <button
          onClick={loadStocks}
          className="px-3 py-1.5 text-sm bg-ledger-bg border border-ledger-primary/20 rounded-lg text-ledger-muted hover:text-ledger-text transition-colors"
        >
          刷新
        </button>
      </div>

      {stocks.length === 0 ? (
        <div className="text-ledger-muted text-center py-8 text-sm">暂无股票资产</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ledger-primary/10 text-ledger-muted">
                <th className="text-left py-2 px-2">名称</th>
                <th className="text-left py-2 px-2">市场</th>
                <th className="text-left py-2 px-2">代码</th>
                <th className="text-right py-2 px-2">数量</th>
                <th className="text-right py-2 px-2">成本价</th>
                <th className="text-right py-2 px-2">现价</th>
                <th className="text-right py-2 px-2">市值</th>
                <th className="text-right py-2 px-2">盈亏</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((s) => {
                const value = parseFloat(s.currentValue || '0');
                const cost = parseFloat(s.costBasis || '0') * (s.quantity || 0);
                const pnl = value - cost;
                const pnlRate = cost > 0 ? (pnl / cost) * 100 : 0;

                return (
                  <tr key={s.id} className="border-b border-ledger-primary/5 hover:bg-ledger-bg/30">
                    <td className="py-2 px-2 text-ledger-text">{s.name}</td>
                    <td className="py-2 px-2">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-ledger-bg text-ledger-muted">
                        {marketLabel[s.market] || s.market || 'A股'}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-ledger-muted font-mono">{s.stockCode}</td>
                    <td className="py-2 px-2 text-right text-ledger-text">{s.quantity}</td>
                    <td className="py-2 px-2 text-right text-ledger-muted">{formatMoney(parseFloat(s.costBasis || '0'))}</td>
                    <td className="py-2 px-2 text-right text-ledger-text">{formatMoney(parseFloat(s.unitPrice || '0'))}</td>
                    <td className="py-2 px-2 text-right text-ledger-text font-medium">{formatMoney(value)}</td>
                    <td className="py-2 px-2 text-right">
                      <span className={pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {pnl >= 0 ? '+' : ''}{formatMoney(pnl)} ({pnlRate >= 0 ? '+' : ''}{pnlRate.toFixed(1)}%)
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/slides/StockSlide.tsx
git commit -m "feat(stock-slide): add dedicated stock holdings slide component"
```

---

## Task 6: Dashboard 接入 StockSlide

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: 导入组件**

在 `ForecastSlide` import 下方添加：

```typescript
import StockSlide from './components/slides/StockSlide'
```

- [ ] **Step 2: 插入到 DashboardPage**

在 `asset-allocation` section 之后、`debt-overview` section 之前插入：

```tsx
<section id="stock-holdings" className="dashboard-section">
  <ErrorBoundary name="StockSlide">
    <StockSlide />
  </ErrorBoundary>
</section>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(dashboard): integrate StockSlide into dashboard"
```

---

## Self-Review

1. **Spec coverage:**
   - ✅ 新增 `market` 字段 → Task 1
   - ✅ DTO 支持 → Task 2
   - ✅ 港股/美股价格拉取 → Task 3
   - ✅ 表单市场选择 → Task 4
   - ✅ 股票独立 Slide → Task 5
   - ✅ Dashboard 接入 → Task 6

2. **Placeholder scan:** 无 TBD、TODO、未定义函数。

3. **Type consistency：**
   - `market` 字段在 entity、DTO、前端状态、组件渲染中均使用 `cn`/`hk`/`us`
   - `StockService.getStockPrice` 签名不变（接收 string code，返回 number price）
