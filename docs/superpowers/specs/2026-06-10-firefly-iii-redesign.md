# Firefly III 风格 UI 重绘 & 极致体验优化

**日期:** 2026-06-10
**分支:** `accounting_system`
**目标:** 不改变任何功能逻辑，纯视觉重绘 + 用户体验优化

---

## 1. 设计目标

### 1.1 视觉风格

对标 Firefly III（AdminLTE / Bootstrap 5 风格），配色方案：

| Token | 亮色模式 | 暗色模式 |
|-------|---------|---------|
| 页面背景 | `#f4f6f9` (浅灰) | `#0f172a` (深蓝黑) |
| 卡片背景 | `#ffffff` (白) | `#1e293b` (暗蓝灰) |
| 主色 | `#1E6581` (青蓝) | `#2d8bb5` (浅青蓝) |
| 成功色 | `#64B624` (绿) | `#64B624` (同绿) |
| 危险色 | `#CD5029` (锈红) | `#e0553a` (浅锈红) |
| 警告色 | `#f59e0b` (琥珀) | `#f59e0b` (同琥珀) |
| 主文字 | `#212529` (深灰) | `#f1f5f9` (浅灰白) |
| 辅助文字 | `#6c757d` (中灰) | `#94a3b8` (中灰蓝) |
| 边框 | `#dee2e6` (浅灰) | `#334155` (暗灰蓝) |

### 1.2 交互体验

- **页面切换:** 瞬间展示缓存数据 + View Transitions 平滑过渡动画
- **数据变更:** 全量乐观更新，先改 UI 再同步服务器
- **导航:** 全局左侧边栏，hover 预加载目标页
- **数据新鲜度:** SWR 静默轮询，用户无需手动刷新

---

## 2. 技术架构

### 2.1 主题系统

**CSS 变量 → Tailwind v4 @theme 桥接 → data-theme 切换**

```css
/* globals.css */
:root {
  --color-bg: #f4f6f9;
  --color-surface: #ffffff;
  --color-primary: #1E6581;
  /* ... 所有 token */
}

[data-theme="dark"] {
  --color-bg: #0f172a;
  --color-surface: #1e293b;
  --color-primary: #2d8bb5;
  /* ... 暗色覆盖 */
}

@theme {
  --color-bg: var(--color-bg-ref);
  --color-surface: var(--color-surface-ref);
  --color-primary: var(--color-primary-ref);
  /* 桥接到 Tailwind 类名 */
}
```

ThemeProvider 组件读取 localStorage + 系统偏好，设置 `<html data-theme="...">`。

### 2.2 数据层改造：SWR + Server Actions

**服务端组件只做 auth check，数据获取全部交给客户端 SWR hooks。**

SWR 的 fetcher 直接用现有 server actions，无需创建 API routes：

```tsx
// src/hooks/useAssets.ts
import useSWR from 'swr';
import { getAssets } from '@/lib/actions/assets';

export function useAssets() {
  return useSWR('assets', () => getAssets().then(r => r.data ?? []));
}
```

**页面改造：**

```
现在:  page.tsx (await getAssets()) → props → DashboardClient
改为:  page.tsx (只做 auth check) → DashboardClient → useSWR('assets', () => getAssets())
```

所有管理页面已经是 `'use client'`，数据获取从 props 改为 SWR hooks。

- `useAssets()` — 资产列表
- `useLiabilities()` — 负债列表
- `useTransactions(filters?)` — 流水列表
- `useBudgets(date)` — 预算及进度
- `useForecast()` — 现金流预测
- `useDashboard()` — 仪表盘聚合数据

**SWR 缓存优势：** 在任何页面做了修改 → `mutate('transactions')` → 切换到仪表盘时 useDashboard 自动使用最新数据。

### 2.3 乐观更新模式

每个 mutation 遵循三阶段模式：

```
1. 乐观阶段 — useOptimistic 立即更新 UI state
2. 发送请求 — 调用 server action
3. 确认/回滚 — 成功则 SWR mutate 刷新；失败则 toast 通知 + 回滚 UI
```

示例（删除交易）：

```tsx
const [optimisticTx, deleteOptimistic] = useOptimistic(
  transactions,
  (state, txId) => state.filter(t => t.id !== txId)
);

async function handleDelete(txId: string) {
  deleteOptimistic(txId);                    // 1. 立刻消失
  const result = await deleteTransaction(txId); // 2. 后台删
  if (result.success) {
    mutate();                                 // 3. SWR 静默同步
  } else {
    toast.error('删除失败，数据已恢复');
    mutate();                                 // 回滚
  }
}
```

### 2.4 导航优化

**三个层次：**

1. **loading.tsx** — 首次进入页面时的骨架屏（每个路由目录放一个）
2. **View Transitions** — CSS `view-transition-name` + Next.js 配置，页面切换平滑过渡
3. **Link prefetch** — 侧边栏 `<Link prefetch={true}>` hover 时预加载目标页 JS + 数据

---

## 3. 组件改动

### 3.1 全局布局

**`src/app/layout.tsx`** — 根布局改为 Sidebar + Content 结构：

```
┌──────────┬──────────────────────────┐
│          │  ThemeToggle · UserMenu  │
│ Sidebar  │──────────────────────────│
│          │                          │
│ 🏠 仪表盘 │     <main>{children}    │
│ 💰 资产  │                          │
│ 📋 负债  │    页面内容              │
│ 📝 流水  │                          │
│ 📊 预算  │                          │
│ 🏷️ 分类  │                          │
│          │                          │
└──────────┴──────────────────────────┘
```

### 3.2 仪表盘

- 移除 `react-grid-layout` 依赖和 `DashboardGrid` 组件
- 改为 CSS Grid 固定响应式布局：
  - 2 列（桌面）/ 1 列（移动端）
  - 卡片顺序固定，通过 CSS Grid 的 `grid-template-areas` 控制
- 每张卡片：白色背景 + 微妙阴影 + 顶部边框色条 + 标题栏
- 统计数字：更大字号、Firefly III 同款青蓝色

### 3.3 管理页面

**资产管理、负债管理、流水管理、预算管理：**

- 表头：浅灰背景 + 加粗 + 2px 底边框（Bootstrap 风格）
- 表格行：hover 高亮 + 交替浅色背景
- 表单：统一 input/select 样式，圆角 4px（不是现在的 6-8px）
- 按钮：`btn-primary`（青蓝实心）、`btn-outline`（边框）、`btn-danger`（红）
- 标签：`.badge` 风格圆角药丸标签（收入=绿、支出=红、转账=蓝）

### 3.4 组件清理

| 操作 | 文件 | 原因 |
|------|------|------|
| 删除 | `src/components/layout/DashboardGrid.tsx` | react-grid-layout 移除 |
| 删除 | `src/components/layout/dashboard-grid-overrides.css` | 关联样式 |
| 删除 | `src/app/management/ManagementSidebar.tsx` | 合并到全局 Sidebar |
| 删除 | `src/components/layout/DashboardNav.tsx` | 合并到全局 Sidebar |
| 新增 | `src/components/layout/Sidebar.tsx` | 全局侧边栏 |
| 新增 | `src/components/common/ThemeToggle.tsx` | 亮暗切换按钮 |
| 新增 | `src/components/common/Toast.tsx` | Toast 通知组件 |
| 新增 | `src/hooks/useAssets.ts` | SWR hook |
| 新增 | `src/hooks/useLiabilities.ts` | SWR hook |
| 新增 | `src/hooks/useTransactions.ts` | SWR hook |
| 新增 | `src/hooks/useBudgets.ts` | SWR hook |
| 新增 | `src/hooks/useDashboard.ts` | SWR hook |
| 新增 | `src/app/(dashboard)/loading.tsx` | 仪表盘骨架屏 |
| 新增 | `src/app/management/loading.tsx` | 管理页骨架屏 |
| 新增 | `src/app/management/assets/loading.tsx` | 资产页骨架屏 |
| 新增 | `src/app/management/ledger/loading.tsx` | 流水页骨架屏 |
| 新增 | `src/app/management/budget/loading.tsx` | 预算页骨架屏 |
| 新增 | `src/app/management/liabilities/loading.tsx` | 负债页骨架屏 |

---

## 4. 依赖变更

```diff
  dependencies:
-   "react-grid-layout": "^2.2.3",
+   "swr": "^2.3.0",
```

---

## 5. 配置文件变更

**`next.config.ts`：**

```ts
const nextConfig: NextConfig = {
  experimental: {
    viewTransitions: true,
  },
};
```

---

## 6. 实施步骤

### Phase 1: 基础设施
1. 安装 swr，卸载 react-grid-layout
2. 重写 `globals.css`：双主题 CSS 变量 + Tailwind @theme 桥接
3. 创建 `ThemeProvider` + `ThemeToggle`
4. 修改 `next.config.ts` 启用 View Transitions

### Phase 2: 全局布局
5. 创建全局 `Sidebar` 组件
6. 修改 `app/layout.tsx`：根布局套入 Sidebar + Content
7. 修改 `management/layout.tsx`：移除独立 sidebar
8. 删除 `DashboardNav`、`ManagementSidebar`、`DashboardGrid`

### Phase 3: 数据层
9. 创建 SWR hooks（`src/hooks/use*.ts`）
10. 改造各管理页面：用 SWR + useOptimistic 替换 router.refresh()
11. 创建 Toast 通知组件

### Phase 4: 页面重绘
13. 仪表盘：CSS Grid 固定卡片 + View Transitions
14. 资产管理页：表格 + 表单重绘
15. 流水管理页：表格 + 表单重绘
16. 预算管理页：表格 + 表单重绘
17. 负债管理页：表格 + 表单重绘

### Phase 5: 收尾
18. 各路由添加 loading.tsx 骨架屏
19. 验证所有功能正常，无回归
20. 测试亮暗切换

---

## 7. 不变更事项

- 所有 server action 文件（`src/lib/actions/*.ts`）功能逻辑不动
- 数据库 schema 不动
- 认证逻辑（next-auth）不动
- echarts 图表组件保留，仅调整配色
- 所有 widget 组件的功能逻辑不动
- Prisma 查询逻辑不动
