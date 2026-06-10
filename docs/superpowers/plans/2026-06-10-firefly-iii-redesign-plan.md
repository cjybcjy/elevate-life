# Firefly III 风格 UI 重绘 & 极致体验优化 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 不改变任何功能逻辑，将 UI 全面重绘为 Firefly III 风格（AdminLTE/Bootstrap），同时用 SWR + useOptimistic + View Transitions 实现极致丝滑的用户体验。

**Architecture:** CSS 变量驱动双主题（data-theme 属性切换），SWR hooks 从 server actions 获取数据并全局缓存，所有 mutation 采用乐观更新（先改 UI 再同步服务器），全局左侧边栏替代顶部导航，移除 react-grid-layout 改用 CSS Grid 固定响应式卡片。

**Tech Stack:** Next.js 16, Tailwind CSS v4, SWR, echarts, server actions, useOptimistic, View Transitions API

**Spec:** `docs/superpowers/specs/2026-06-10-firefly-iii-redesign.md`

---

## 文件结构

```
Create:
  src/components/layout/Sidebar.tsx          — 全局左侧边栏导航
  src/components/common/ThemeToggle.tsx      — 亮暗主题切换按钮
  src/components/common/Toast.tsx            — Toast 通知容器 + hook
  src/hooks/useAssets.ts                     — 资产 SWR hook
  src/hooks/useLiabilities.ts                — 负债 SWR hook
  src/hooks/useTransactions.ts               — 流水 SWR hook
  src/hooks/useBudgets.ts                    — 预算 SWR hook
  src/hooks/useDashboard.ts                  — 仪表盘聚合数据 hook
  src/hooks/useForecast.ts                   — 现金流预测 SWR hook
  src/app/(dashboard)/loading.tsx            — 仪表盘骨架屏
  src/app/management/loading.tsx             — 管理页骨架屏
  src/app/management/assets/loading.tsx      — 资产页骨架屏
  src/app/management/ledger/loading.tsx      — 流水页骨架屏
  src/app/management/budget/loading.tsx      — 预算页骨架屏
  src/app/management/liabilities/loading.tsx — 负债页骨架屏

Modify:
  src/app/globals.css                        — 双主题 CSS 变量 + Tailwind @theme 桥接
  next.config.ts                             — 启用 View Transitions
  src/app/layout.tsx                         — 套入 Sidebar + Content 布局
  src/app/(dashboard)/page.tsx               — 简化，只做 auth check
  src/app/(dashboard)/DashboardClient.tsx    — SWR 替代 props，CSS Grid 替换 react-grid-layout
  src/app/management/layout.tsx              — 移除独立 sidebar
  src/app/management/assets/AssetManager.tsx — SWR + 乐观更新 + 样式重绘
  src/app/management/assets/AssetTable.tsx   — 样式重绘
  src/app/management/ledger/LedgerManager.tsx — SWR + 乐观更新 + 样式重绘
  src/app/management/budget/BudgetManager.tsx — SWR + 乐观更新 + 样式重绘
  src/app/management/liabilities/LiabilityManager.tsx — SWR + 乐观更新 + 样式重绘

Delete:
  src/components/layout/DashboardGrid.tsx
  src/components/layout/dashboard-grid-overrides.css
  src/app/management/ManagementSidebar.tsx
  src/components/layout/DashboardNav.tsx
```

---

### Task 1: 安装 SWR，卸载 react-grid-layout

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 swr**

```bash
npm install swr
```

Run: `npm install swr`
Expected: 安装成功，`package.json` 中 dependencies 增加 `"swr": "^2.3.0"`

- [ ] **Step 2: 卸载 react-grid-layout**

```bash
npm uninstall react-grid-layout
```

Run: `npm uninstall react-grid-layout`
Expected: 卸载成功，`package.json` 中 `"react-grid-layout"` 被移除

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add swr, remove react-grid-layout

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: 重写 globals.css — 双主题 CSS 变量 + Tailwind @theme 桥接

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: 用完整的双主题系统替换 globals.css**

Write `src/app/globals.css`:

```css
@import "tailwindcss";

/* ============================================================
   Theme tokens — all colors and dimensions driven by CSS vars
   Firefly III inspired palette (AdminLTE / Bootstrap 5 style)
   ============================================================ */

:root {
  /* Background & Surface */
  --color-bg: #f4f6f9;
  --color-surface: #ffffff;
  --color-surface-alt: #f8f9fa;
  --color-surface-raised: #ffffff;

  /* Brand / Accent */
  --color-primary: #1E6581;
  --color-primary-hover: #174d63;
  --color-primary-light: #e8f0f4;
  --color-primary-border: #b8d4e0;

  /* Semantic */
  --color-success: #64B624;
  --color-success-light: #eaf5dd;
  --color-success-border: #b8de8a;
  --color-danger: #CD5029;
  --color-danger-light: #fbeae5;
  --color-danger-border: #f0b8a5;
  --color-warning: #f59e0b;
  --color-warning-light: #fef5e0;
  --color-warning-border: #fcd87a;

  /* Text */
  --color-text: #212529;
  --color-text-heading: #1a1d20;
  --color-text-muted: #6c757d;
  --color-text-inverse: #ffffff;

  /* Borders & Dividers */
  --color-border: #dee2e6;
  --color-border-light: #e9ecef;
  --color-border-strong: #ced4da;

  /* Shadows & Elevation */
  --shadow-card: 0 0 1px rgba(0,0,0,.125), 0 1px 3px rgba(0,0,0,.08);
  --shadow-card-hover: 0 0 1px rgba(0,0,0,.125), 0 2px 8px rgba(0,0,0,.12);
  --shadow-dropdown: 0 2px 12px rgba(0,0,0,.15);

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-full: 9999px;

  /* Sidebar */
  --color-sidebar-bg: #1a2332;
  --color-sidebar-text: #c8d6e5;
  --color-sidebar-active-bg: rgba(30, 101, 129, 0.25);
  --color-sidebar-active-text: #5dafd2;
  --color-sidebar-hover-bg: rgba(255,255,255,0.05);
  --sidebar-width: 240px;

  /* Animations */
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;

  /* Table */
  --color-table-header-bg: #f8f9fa;
  --color-table-stripe: #fafbfc;
  --color-table-hover: #f0f9ff;
}

/* ========== Dark Theme ========== */
[data-theme="dark"] {
  --color-bg: #0f172a;
  --color-surface: #1e293b;
  --color-surface-alt: #1a2332;
  --color-surface-raised: #273548;

  --color-primary: #2d8bb5;
  --color-primary-hover: #3ba3d0;
  --color-primary-light: #132430;
  --color-primary-border: #1a4055;

  --color-success: #64B624;
  --color-success-light: #172810;
  --color-success-border: #3a6016;
  --color-danger: #e0553a;
  --color-danger-light: #2d1814;
  --color-danger-border: #6e2a1d;
  --color-warning: #f59e0b;
  --color-warning-light: #2d2410;
  --color-warning-border: #6e5616;

  --color-text: #f1f5f9;
  --color-text-heading: #ffffff;
  --color-text-muted: #94a3b8;
  --color-text-inverse: #0f172a;

  --color-border: #334155;
  --color-border-light: #2d3a4f;
  --color-border-strong: #475569;

  --shadow-card: 0 0 1px rgba(0,0,0,.3), 0 1px 3px rgba(0,0,0,.2);
  --shadow-card-hover: 0 0 1px rgba(0,0,0,.4), 0 2px 8px rgba(0,0,0,.3);
  --shadow-dropdown: 0 2px 12px rgba(0,0,0,.4);

  --color-sidebar-bg: #0c1322;
  --color-sidebar-text: #94a3b8;
  --color-sidebar-active-bg: rgba(45, 139, 181, 0.2);
  --color-sidebar-active-text: #5dafd2;
  --color-sidebar-hover-bg: rgba(255,255,255,0.05);

  --color-table-header-bg: #1a2332;
  --color-table-stripe: #1c2538;
  --color-table-hover: #1a2d40;
}

/* ============================================================
   Tailwind v4 @theme bridge — exposes CSS vars as Tailwind colors
   Tailwind v4: use the CSS var directly without @theme for colors
   that already match standard Tailwind names, or use custom names.
   Since Tailwind v4 supports arbitrary values, we reference CSS
   vars directly in utilities: bg-[var(--color-bg)] etc.
   ============================================================ */

@theme {
  --color-sidebar-bg: var(--color-sidebar-bg);
  --color-sidebar-text: var(--color-sidebar-text);
  --color-sidebar-active-bg: var(--color-sidebar-active-bg);
  --color-sidebar-active-text: var(--color-sidebar-active-text);
  --color-sidebar-hover-bg: var(--color-sidebar-hover-bg);
}

/* ============================================================
   Base styles
   ============================================================ */

body {
  margin: 0;
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-geist-sans), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  transition: background-color var(--transition-normal), color var(--transition-normal);
}

/* ============================================================
   Scrollbar — themed
   ============================================================ */

::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: var(--color-bg);
}

::-webkit-scrollbar-thumb {
  background: var(--color-border-strong);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-muted);
}

/* ============================================================
   View Transitions — animate main content between navigations
   ============================================================ */

@keyframes fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fade-out {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-8px); }
}

::view-transition-old(main-content) {
  animation: fade-out 0.15s ease-out forwards;
}

::view-transition-new(main-content) {
  animation: fade-in 0.2s ease-out forwards;
}

/* ============================================================
   Shared component styles — Bootstrap / AdminLTE flavored
   ============================================================ */

/* Card */
.card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  border: 1px solid var(--color-border-light);
  transition: box-shadow var(--transition-fast);
}
.card:hover {
  box-shadow: var(--shadow-card-hover);
}
.card-header {
  padding: 14px 18px;
  border-bottom: 1px solid var(--color-border-light);
  font-weight: 600;
  font-size: 15px;
  color: var(--color-text-heading);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.card-body {
  padding: 18px;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 500;
  padding: 7px 16px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
  gap: 6px;
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.btn-primary {
  background: var(--color-primary);
  color: #ffffff;
  border-color: var(--color-primary);
}
.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}
.btn-outline {
  background: transparent;
  color: var(--color-primary);
  border-color: var(--color-primary-border);
}
.btn-outline:hover:not(:disabled) {
  background: var(--color-primary-light);
}
.btn-danger {
  background: var(--color-danger);
  color: #ffffff;
  border-color: var(--color-danger);
}
.btn-danger:hover:not(:disabled) {
  opacity: 0.9;
}
.btn-sm {
  font-size: 12px;
  padding: 4px 10px;
}
.btn-ghost {
  background: transparent;
  color: var(--color-text-muted);
  border-color: transparent;
}
.btn-ghost:hover:not(:disabled) {
  background: var(--color-surface-alt);
  color: var(--color-text);
}

/* Form controls */
.form-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-muted);
  margin-bottom: 4px;
  text-transform: none;
}
.form-input {
  display: block;
  width: 100%;
  padding: 7px 12px;
  font-size: 13px;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  outline: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.form-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}
.form-input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.6;
}
.form-select {
  display: block;
  width: 100%;
  padding: 7px 32px 7px 12px;
  font-size: 13px;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  outline: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236c757d' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.form-input:focus,
.form-select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

/* Badge */
.badge {
  display: inline-block;
  padding: 2px 10px;
  font-size: 11px;
  font-weight: 500;
  border-radius: var(--radius-full);
  line-height: 1.6;
}
.badge-success {
  background: var(--color-success-light);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}
.badge-danger {
  background: var(--color-danger-light);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
}
.badge-info {
  background: var(--color-primary-light);
  color: var(--color-primary);
  border: 1px solid var(--color-primary-border);
}
.badge-warning {
  background: var(--color-warning-light);
  color: var(--color-warning);
  border: 1px solid var(--color-warning-border);
}

/* Table */
.table-container {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  border: 1px solid var(--color-border-light);
  overflow: hidden;
}
.table-container table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.table-container thead th {
  background: var(--color-table-header-bg);
  color: var(--color-text-muted);
  font-weight: 600;
  text-align: left;
  padding: 10px 14px;
  border-bottom: 2px solid var(--color-border);
  white-space: nowrap;
}
.table-container tbody td {
  padding: 9px 14px;
  border-bottom: 1px solid var(--color-border-light);
  color: var(--color-text);
}
.table-container tbody tr:last-child td {
  border-bottom: none;
}
.table-container tbody tr:hover {
  background: var(--color-table-hover);
}
.table-container tbody tr:nth-child(even) {
  background: var(--color-table-stripe);
}
.table-container tbody tr:nth-child(even):hover {
  background: var(--color-table-hover);
}

/* Alert */
.alert {
  padding: 12px 16px;
  border-radius: var(--radius-md);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.alert-error {
  background: var(--color-danger-light);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
}
.alert-success {
  background: var(--color-success-light);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}

/* Skeleton loading */
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-border-light) 25%,
    var(--color-surface-alt) 50%,
    var(--color-border-light) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}
@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Toast container */
.toast-container {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.toast {
  padding: 12px 20px;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  box-shadow: var(--shadow-dropdown);
  animation: toast-in 0.25s ease-out;
  max-width: 380px;
}
.toast-success {
  background: var(--color-success);
  color: #ffffff;
}
.toast-error {
  background: var(--color-danger);
  color: #ffffff;
}
@keyframes toast-in {
  from { opacity: 0; transform: translateX(40px); }
  to { opacity: 1; transform: translateX(0); }
}

/* Form row — inline form layout */
.form-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
}
.form-row > .form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Stat card */
.stat-card {
  text-align: center;
  padding: 16px 12px;
}
.stat-card .stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-heading);
}
.stat-card .stat-label {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

/* Page header */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.page-header h1 {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text-heading);
  margin: 0;
}
```

- [ ] **Step 2: 验证 Tailwind 编译无错误**

```bash
npx next build 2>&1 | tail -5
```

Expected: 构建成功，无 CSS 相关错误。

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: dual-theme CSS variables with Firefly III palette and component styles

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 启用 View Transitions

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: 修改 next.config.ts**

Write `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    viewTransitions: true,
  },
};

export default nextConfig;
```

- [ ] **Step 2: 验证配置**

```bash
npx next build 2>&1 | grep -i "view.transition\|error" || echo "Build OK"
```

Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: enable View Transitions API for smooth page navigation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 创建 ThemeToggle 组件

**Files:**
- Create: `src/components/common/ThemeToggle.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: 创建 ThemeToggle 组件**

Write `src/components/common/ThemeToggle.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return null;
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const stored = getStoredTheme();
    const resolved = stored ?? getSystemTheme();
    setTheme(resolved);
    applyTheme(resolved);
  }, []);

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button
      onClick={toggle}
      className="btn btn-ghost btn-sm"
      title={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
      aria-label="切换主题"
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
```

- [ ] **Step 2: 在根布局中引入 ThemeToggle**

Read `src/app/layout.tsx` 确保 `<html>` 标签没有预设主题相关的类名冲突（目前有 `class="..."`）。ThemeToggle 在客户端通过 `useEffect` 设置 `data-theme` 属性，避免 hydration 不匹配。

目前 layout.tsx 的 `<html>` 标签已经使用了 Geist 字体变量，不需要修改。我们将在 Task 6 (全局布局) 中把 ThemeToggle 放入 Sidebar 中。

- [ ] **Step 3: Commit**

```bash
git add src/components/common/ThemeToggle.tsx
git commit -m "feat: add ThemeToggle with localStorage persistence and system preference detection

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: 创建 Toast 通知系统

**Files:**
- Create: `src/components/common/Toast.tsx`

- [ ] **Step 1: 创建 Toast 组件 + hook**

Write `src/components/common/Toast.tsx`:

```tsx
'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ToastType = 'success' | 'error';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const success = useCallback((message: string) => addToast(message, 'success'), [addToast]);
  const error = useCallback((message: string) => addToast(message, 'error'), [addToast]);

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === 'success' ? '✓ ' : '✗ '}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/common/Toast.tsx
git commit -m "feat: add Toast notification system with provider and useToast hook

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: 创建全局 Sidebar + 重构根布局

**Files:**
- Create: `src/components/layout/Sidebar.tsx`
- Modify: `src/app/layout.tsx`
- Delete: `src/components/layout/DashboardNav.tsx`
- Delete: `src/app/management/ManagementSidebar.tsx`

- [ ] **Step 1: 创建全局 Sidebar 组件**

Write `src/components/layout/Sidebar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/common/ThemeToggle';

const navItems = [
  { label: '仪表盘', href: '/', icon: '🏠' },
  { label: '资产管理', href: '/management/assets', icon: '💰' },
  { label: '负债管理', href: '/management/liabilities', icon: '📋' },
  { label: '流水管理', href: '/management/ledger', icon: '📝' },
  { label: '预算管理', href: '/management/budget', icon: '📊' },
  { label: '分类管理', href: '/management/categories', icon: '🏷️' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  return (
    <aside
      className="flex flex-col shrink-0 h-screen sticky top-0 overflow-hidden"
      style={{
        width: 'var(--sidebar-width)',
        background: 'var(--color-sidebar-bg)',
        color: 'var(--color-sidebar-text)',
      }}
    >
      {/* Brand */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link href="/" style={{ textDecoration: 'none', color: '#ffffff' }}>
          <span style={{ fontSize: '18px', fontWeight: 700 }}>📊 家庭账本</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {navItems.map(item => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: '14px',
                fontWeight: isActive ? 600 : 400,
                textDecoration: 'none',
                color: isActive
                  ? 'var(--color-sidebar-active-text)'
                  : 'var(--color-sidebar-text)',
                background: isActive
                  ? 'var(--color-sidebar-active-bg)'
                  : 'transparent',
                transition: 'all var(--transition-fast)',
                marginBottom: '2px',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--color-sidebar-hover-bg)';
                  e.currentTarget.style.color = '#ffffff';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--color-sidebar-text)';
                }
              }}
            >
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div
        style={{
          padding: '12px 10px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <ThemeToggle />
        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '9px 12px',
            borderRadius: 'var(--radius-md)',
            fontSize: '14px',
            border: 'none',
            cursor: 'pointer',
            background: 'transparent',
            color: 'var(--color-sidebar-text)',
            transition: 'all var(--transition-fast)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--color-sidebar-hover-bg)';
            e.currentTarget.style.color = 'var(--color-danger)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--color-sidebar-text)';
          }}
        >
          <span style={{ fontSize: '16px' }}>🚪</span>
          退出登录
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: 重写根布局**

Write `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import { ToastProvider } from "@/components/common/Toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "家庭账本",
  description: "个人家庭财务管理系统",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "家庭账本",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#1E6581" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-full flex">
        <ToastProvider>
          <Sidebar />
          <main
            className="flex-1 overflow-auto"
            style={{
              viewTransitionName: 'main-content',
              padding: '24px 28px',
              minHeight: '100vh',
              background: 'var(--color-bg)',
            }}
          >
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: 重写 management/layout.tsx — 移除独立 sidebar**

Write `src/app/management/layout.tsx`:

```tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function ManagementLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session) redirect('/login');

  return <>{children}</>;
}
```

- [ ] **Step 4: 删除废弃组件**

```bash
rm src/components/layout/DashboardNav.tsx
rm src/app/management/ManagementSidebar.tsx
```

- [ ] **Step 5: 验证构建**

```bash
npx next build 2>&1 | tail -10
```

Expected: 构建成功，无引用错误。

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/app/layout.tsx src/app/management/layout.tsx
git rm src/components/layout/DashboardNav.tsx src/app/management/ManagementSidebar.tsx
git commit -m "feat: global sidebar with Firefly III dark sidebar style, consolidate layouts

- Adds fixed left sidebar with icon + label navigation
- Sidebar includes ThemeToggle and logout button
- Root layout wraps content in Sidebar + main with ToastProvider
- Management layout simplified to auth gate only
- Removes DashboardNav and ManagementSidebar (consolidated)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: 创建 SWR hooks

**Files:**
- Create: `src/hooks/useAssets.ts`
- Create: `src/hooks/useLiabilities.ts`
- Create: `src/hooks/useTransactions.ts`
- Create: `src/hooks/useBudgets.ts`
- Create: `src/hooks/useDashboard.ts`
- Create: `src/hooks/useForecast.ts`

- [ ] **Step 1: 创建 useAssets hook**

Write `src/hooks/useAssets.ts`:

```ts
import useSWR from 'swr';
import { getAssets } from '@/lib/actions/assets';

export function useAssets() {
  return useSWR('assets', async () => {
    const res = await getAssets();
    if (!res.success) throw new Error(res.error || 'Failed to fetch assets');
    return { data: res.data ?? [], pricesStale: (res as any).pricesStale ?? false };
  });
}
```

- [ ] **Step 2: 创建 useLiabilities hook**

Write `src/hooks/useLiabilities.ts`:

```ts
import useSWR from 'swr';
import { getLiabilities } from '@/lib/actions/liabilities';

export function useLiabilities() {
  return useSWR('liabilities', async () => {
    const res = await getLiabilities();
    if (!res.success) throw new Error(res.error || 'Failed to fetch liabilities');
    return { data: res.data ?? [] };
  });
}
```

- [ ] **Step 3: 创建 useTransactions hook**

Write `src/hooks/useTransactions.ts`:

```ts
import useSWR from 'swr';
import { getTransactions } from '@/lib/actions/ledger';

export function useTransactions(filters?: { type?: string; categoryId?: string; startDate?: string; endDate?: string }) {
  const key = ['transactions', filters].filter(Boolean).join(':');
  return useSWR(key, async () => {
    const res = await getTransactions();
    if (!res.success) throw new Error(res.error || 'Failed to fetch transactions');
    return { data: res.data ?? [] };
  });
}
```

- [ ] **Step 4: 创建 useBudgets hook**

Write `src/hooks/useBudgets.ts`:

```ts
import useSWR from 'swr';
import { getBudgetProgress } from '@/lib/actions/budget';

export function useBudgets(date: string) {
  return useSWR(['budgets', date].join(':'), async () => {
    const res = await getBudgetProgress(date);
    if (!res.success) throw new Error(res.error || 'Failed to fetch budgets');
    return { data: res.data ?? [] };
  });
}
```

- [ ] **Step 5: 创建 useForecast hook**

Write `src/hooks/useForecast.ts`:

```ts
import useSWR from 'swr';
import { getAutoForecast, simulateCashflow } from '@/lib/actions/forecast';

export function useForecast(months: number = 12) {
  return useSWR(['forecast', months].join(':'), async () => {
    const autoRes = await getAutoForecast(months);
    const forecastData = autoRes.success
      ? autoRes.data!
      : { monthlyIncome: '20000', monthlyExpense: '15000', activeMonths: 0, recurringExpenses: [] };

    const simRes = await simulateCashflow({
      monthlyIncome: forecastData.monthlyIncome,
      monthlyExpense: forecastData.monthlyExpense,
      months,
    });

    return {
      autoForecast: forecastData,
      forecast: simRes.success ? simRes.data! : { months: [], warningLevel: 'green' },
      forexRates: (autoRes as any).forexRates ?? { usdToCny: 7.2, hkdToCny: 0.92, jpyToCny: 0.048 },
    };
  });
}
```

- [ ] **Step 6: 创建 useDashboard hook**

Write `src/hooks/useDashboard.ts`:

```ts
import useSWR from 'swr';
import { useAssets } from './useAssets';
import { useLiabilities } from './useLiabilities';
import { useTransactions } from './useTransactions';
import { useForecast } from './useForecast';

export function useDashboard(budgetDate: string) {
  const assets = useAssets();
  const liabilities = useLiabilities();
  const transactions = useTransactions();
  const forecast = useForecast();

  const isLoading =
    assets.isLoading || liabilities.isLoading || transactions.isLoading || forecast.isLoading;

  return {
    assets: assets.data?.data ?? [],
    liabilities: liabilities.data?.data ?? [],
    transactions: transactions.data?.data ?? [],
    forecast: forecast.data?.forecast ?? { months: [], warningLevel: 'green' },
    autoForecast: forecast.data?.autoForecast ?? {
      monthlyIncome: '20000', monthlyExpense: '15000', activeMonths: 0, recurringExpenses: [],
    },
    forexRates: forecast.data?.forexRates ?? { usdToCny: 7.2, hkdToCny: 0.92, jpyToCny: 0.048 },
    pricesStale: assets.data?.pricesStale ?? false,
    isLoading,
    error: assets.error || liabilities.error || transactions.error || forecast.error,
  };
}
```

- [ ] **Step 7: 验证 TypeScript 编译**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 无类型错误（或仅预先存在的错误）。

- [ ] **Step 8: Commit**

```bash
git add src/hooks/
git commit -m "feat: add SWR hooks for all data entities (assets, liabilities, transactions, budgets, forecast, dashboard)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: 重写仪表盘页面 — SWR + CSS Grid 固定卡片

**Files:**
- Modify: `src/app/(dashboard)/page.tsx`
- Modify: `src/app/(dashboard)/DashboardClient.tsx`
- Delete: `src/components/layout/DashboardGrid.tsx`
- Delete: `src/components/layout/dashboard-grid-overrides.css`

- [ ] **Step 1: 简化 page.tsx 为只做 auth check**

Write `src/app/(dashboard)/page.tsx`:

```tsx
export const dynamic = 'force-dynamic';

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const currentDate = new Date().toISOString().slice(0, 10);

  return <DashboardClient currentDate={currentDate} />;
}
```

- [ ] **Step 2: 重写 DashboardClient.tsx — SWR 数据获取 + CSS Grid 固定卡片**

Write `src/app/(dashboard)/DashboardClient.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Decimal from 'decimal.js';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AnimatedNumber } from '@/components/common/AnimatedNumber';
import { AmountDisplay } from '@/components/common/AmountDisplay';
import AssetRingChart from '@/components/charts/AssetRingChart';
import DebtFunnelChart from '@/components/charts/DebtFunnelChart';
import ScissorChart from '@/components/charts/ScissorChart';
import CashflowForecastChart from '@/components/charts/CashflowForecastChart';
import TargetCashflow from '@/components/widgets/TargetCashflow';
import StockTable from '@/components/widgets/StockTable';
import LiabilityCards from '@/components/widgets/LiabilityCards';
import DebtStrategyComparison from '@/components/widgets/DebtStrategyComparison';
import BudgetTracker from '@/components/widgets/BudgetTracker';
import GoalTracker from '@/components/widgets/GoalTracker';
import MonthFlow from '@/components/widgets/MonthFlow';
import { ExpandableDetail, isCollapsibleCat } from '@/components/widgets/SpecialAccountsPanel';
import { PriceRefresher } from '@/components/widgets/PriceRefresher';
import { useDashboard } from '@/hooks/useDashboard';
import { useBudgets } from '@/hooks/useBudgets';
import { getGoals } from '@/lib/actions/goals';
import useSWR from 'swr';

const categoryConfig: Record<string, { icon: string; color: string; label: string }> = {
  real_estate: { icon: '🏠', color: '#3b82f6', label: '房产' },
  cash: { icon: '💰', color: '#10b981', label: '现金' },
  provident_fund: { icon: '🏦', color: '#06b6d4', label: '公积金' },
  pension: { icon: '🏛️', color: '#8b5cf6', label: '养老保险' },
  gold_physical: { icon: '🟡', color: '#f59e0b', label: '实物黄金' },
  gold_paper: { icon: '📄', color: '#eab308', label: '纸黄金' },
  stock: { icon: '📈', color: '#ef4444', label: '股票' },
  fund: { icon: '📊', color: '#8b5cf6', label: '基金' },
  bond: { icon: '📜', color: '#06b6d4', label: '债券' },
  vehicle: { icon: '🚗', color: '#f97316', label: '车辆' },
  current_deposit: { icon: '💳', color: '#14b8a6', label: '银行活期' },
  other: { icon: '📦', color: '#94a3b8', label: '其他' },
};

export default function DashboardClient({ currentDate }: { currentDate: string }) {
  const {
    assets, liabilities, transactions, forecast, autoForecast,
    forexRates, pricesStale, isLoading,
  } = useDashboard(currentDate);

  const { data: budgetProgressData } = useBudgets(currentDate);
  const budgetProgress = budgetProgressData?.data ?? [];

  const { data: goalsData } = useSWR('goals', () => getGoals().then(r => r.success ? (r.data ?? []) : []));
  const goals = goalsData ?? [];

  if (isLoading) {
    return (
      <div style={{ padding: '24px 0' }}>
        <div className="skeleton" style={{ height: 60, marginBottom: 16 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="skeleton" style={{ height: 240 }} />
          <div className="skeleton" style={{ height: 240 }} />
          <div className="skeleton" style={{ height: 240 }} />
          <div className="skeleton" style={{ height: 240 }} />
        </div>
      </div>
    );
  }

  const totalAssets = assets.reduce((sum: Decimal, a: any) => sum.plus(new Decimal(a.balance || 0)), new Decimal(0));
  const totalLiabilities = liabilities.reduce((sum: Decimal, l: any) => sum.plus(new Decimal(l.currentBalance || 0)), new Decimal(0));
  const netWorth = totalAssets.minus(totalLiabilities).toNumber();
  const surplusRate = totalAssets.gt(0) ? netWorth / totalAssets.toNumber() * 100 : 0;

  const stocks = assets.filter((a: any) => a.category === 'stock');

  const catTotals: Record<string, number> = {};
  for (const a of assets) {
    const v = parseFloat(a.balance || '0');
    catTotals[a.category || 'other'] = (catTotals[a.category || 'other'] || 0) + v;
  }
  const ringData = Object.entries(catTotals)
    .map(([cat, value]) => ({ name: categoryConfig[cat]?.label || cat, value, itemStyle: { color: categoryConfig[cat]?.color || '#94a3b8' } }))
    .sort((a, b) => b.value - a.value);

  const funnelData = liabilities.map((l: any) => ({ name: l.name, value: parseFloat(l.currentBalance) || 0, rate: l.interestRate * 100 }));
  const wacr = liabilities.length > 0 ? liabilities.reduce((sum: number, l: any) => sum + (parseFloat(l.currentBalance) || 0) * l.interestRate, 0) / (totalLiabilities.toNumber() || 1) : 0;

  const now = new Date();
  const months: string[] = [], incomeData: number[] = [], expenseData: number[] = [];
  const cnyRate: Record<string, number> = { CNY: 1, USD: forexRates.usdToCny, HKD: forexRates.hkdToCny, JPY: forexRates.jpyToCny };
  function toCny(amount: number | string, currency?: string): number {
    const cur = currency || 'CNY';
    return parseFloat(amount as string) * (cnyRate[cur] || 1);
  }
  function toBeijingDate(v: any): Date {
    const ts = v instanceof Date ? v.getTime() : new Date(typeof v === 'string' && v.endsWith('Z') ? v : v + 'Z').getTime();
    return new Date(ts + 8 * 3600_000);
  }
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getMonth() + 1}月`);
    const mi = transactions.filter((t: any) => { const td = toBeijingDate(t.occurredAt); return (t.type === 'INCOME' || t.type === 'income') && td.getUTCFullYear() === d.getFullYear() && td.getUTCMonth() === d.getMonth(); }).reduce((s: number, t: any) => s + toCny(t.amount || '0', t.currency), 0);
    const me = transactions.filter((t: any) => { const td = toBeijingDate(t.occurredAt); return (t.type === 'EXPENSE' || t.type === 'expense') && td.getUTCFullYear() === d.getFullYear() && td.getUTCMonth() === d.getMonth(); }).reduce((s: number, t: any) => s + toCny(t.amount || '0', t.currency), 0);
    incomeData.push(mi); expenseData.push(me);
  }
  const curIncome = incomeData[11] || 0, curExpense = expenseData[11] || 0;
  const fmonths = forecast.months?.map((m: any) => m.month) || [];
  const fsurplus = forecast.months?.map((m: any) => parseFloat(m.projectedSurplus) || 0) || [];
  const fcumulative = forecast.months?.map((m: any) => parseFloat(m.cumulativeSurplus) || 0) || [];
  const runwayMonths = fcumulative.filter((v: number) => v >= 0).length;
  const freedomProgress = Math.min(100, (netWorth / (20000 * 12 * 25)) * 100);
  const currentCash = assets.filter((a: any) => a.category === 'cash' || a.category === 'current_deposit').reduce((s: number, a: any) => s + parseFloat(a.balance || '0'), 0);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '16px',
      maxWidth: 1400,
      margin: '0 auto',
    }}>
      {/* Net Worth — full width */}
      <ErrorBoundary name="NetWorth">
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>净资产</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-text-heading)' }}>
                  <AnimatedNumber value={netWorth} prefix="¥" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                <div><span style={{ color: 'var(--color-text-muted)' }}>总资产 </span><AmountDisplay amount={totalAssets.toNumber()} className="font-medium" sensitive style={{ color: 'var(--color-success)' }} /></div>
                <div><span style={{ color: 'var(--color-text-muted)' }}>总负债 </span><AmountDisplay amount={totalLiabilities.toNumber()} className="font-medium" sensitive style={{ color: 'var(--color-danger)' }} /></div>
                <div><span style={{ color: 'var(--color-text-muted)' }}>净资产率 </span><span style={{ fontWeight: 500, color: 'var(--color-text-heading)' }}>{surplusRate.toFixed(1)}%</span></div>
              </div>
            </div>
            <Link href="/management/assets" className="btn btn-outline btn-sm">管理</Link>
          </div>
        </div>
      </ErrorBoundary>

      {/* MonthFlow */}
      <ErrorBoundary name="MonthFlow">
        <MonthFlow curIncome={curIncome} curExpense={curExpense} transactions={transactions} />
      </ErrorBoundary>

      {/* Assets */}
      <ErrorBoundary name="Assets">
        <div className="card">
          <div className="card-header">
            <span>资产配置</span>
            <Link href="/management/assets" className="btn btn-outline btn-sm">管理</Link>
          </div>
          <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0 }}>
              {ringData.length > 0 ? <AssetRingChart data={ringData} /> : (
                <div style={{ width: 260, height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>暂无数据</div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {Object.entries(catTotals).sort(([, a], [, b]) => b - a).map(([cat, total]) => {
                const cfg = categoryConfig[cat] || categoryConfig.other;
                const pct = totalAssets.gt(0) ? (total / totalAssets.toNumber() * 100).toFixed(1) : '0';
                const count = assets.filter((a: any) => (a.category || 'other') === cat).length;
                const isCollapsible = isCollapsibleCat(cat);
                const isGoldCat = cat === 'gold_physical' || cat === 'gold_paper';
                return (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '3px 0' }}>
                    {isCollapsible && <ExpandableDetail cat={cat} assets={assets} />}
                    <span>{cfg.icon}</span>
                    <span style={{ color: 'var(--color-text)' }}>{cfg.label}</span>
                    {!isCollapsible && count > 1 && <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>({count}项)</span>}
                    {isGoldCat && (() => {
                      const grams = assets.filter((a: any) => (a.category||'other') === cat).reduce((s: number, a: any) => s + (a.quantity || 0), 0);
                      return <span style={{ color: 'var(--color-text-muted)', fontSize: 11, width: 48, textAlign: 'right' }}>{Number(grams).toFixed(0)}克</span>;
                    })()}
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 11, width: 40, textAlign: 'right', marginLeft: 'auto' }}>{pct}%</span>
                    <AmountDisplay amount={total} className="text-sm" sensitive style={{ width: 96, textAlign: 'right' }} />
                  </div>
                );
              })}
              {assets.length === 0 && <div style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>暂无资产</div>}
            </div>
          </div>
        </div>
      </ErrorBoundary>

      {/* Debts */}
      <ErrorBoundary name="Debts">
        <div className="card">
          <div className="card-header">
            <span>负债总览</span>
            <Link href="/management/liabilities" className="btn btn-outline btn-sm">管理</Link>
          </div>
          <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0, width: 240 }}>
              {funnelData.length > 0 ? <DebtFunnelChart data={funnelData} /> : (
                <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>暂无负债</div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                总额 <AmountDisplay amount={totalLiabilities.toNumber()} className="font-bold" sensitive style={{ color: 'var(--color-text-heading)' }} /> · WACR <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>{(wacr * 100).toFixed(2)}%</span>
              </div>
              <LiabilityCards liabilities={liabilities} transactions={transactions} />
            </div>
          </div>
        </div>
      </ErrorBoundary>

      {/* Debt Strategy */}
      {liabilities.length >= 2 && (
        <ErrorBoundary name="DebtStrategy">
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-body">
              <DebtStrategyComparison liabilities={liabilities} />
            </div>
          </div>
        </ErrorBoundary>
      )}

      {/* Stocks */}
      <ErrorBoundary name="Stocks">
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <span>股票持仓</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <PriceRefresher pricesStale={pricesStale} />
              <Link href="/management/assets" className="btn btn-outline btn-sm">管理</Link>
            </div>
          </div>
          <div className="card-body">
            <StockTable stocks={stocks} forexRates={forexRates} />
          </div>
        </div>
      </ErrorBoundary>

      {/* Budget */}
      {budgetProgress.length > 0 && (
        <ErrorBoundary name="Budget">
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-body">
              <BudgetTracker progress={budgetProgress} transactions={transactions} />
            </div>
          </div>
        </ErrorBoundary>
      )}

      {/* Goals */}
      {goals.length > 0 && (
        <ErrorBoundary name="Goals">
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-body">
              <GoalTracker goals={goals} />
            </div>
          </div>
        </ErrorBoundary>
      )}

      {/* Scissor */}
      <ErrorBoundary name="Scissor">
        <div className="card">
          <div className="card-header">
            <span>收支剪刀图</span>
            <Link href="/management/ledger" className="btn btn-outline btn-sm">管理</Link>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 16, fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: 'var(--color-text-muted)' }}>本月收入 <AmountDisplay amount={curIncome} className="font-medium" sensitive style={{ color: 'var(--color-success)' }} /></span>
              <span style={{ color: 'var(--color-text-muted)' }}>支出 <AmountDisplay amount={curExpense} className="font-medium" sensitive style={{ color: 'var(--color-danger)' }} /></span>
              <span style={{ color: 'var(--color-text-muted)' }}>盈余率 <span style={{ fontWeight: 500, color: 'var(--color-text-heading)' }}>{curIncome > 0 ? ((curIncome - curExpense) / curIncome * 100).toFixed(1) : '0'}%</span></span>
            </div>
            <ScissorChart months={months} income={incomeData} expense={expenseData} survivalLine={curIncome * 0.5} />
          </div>
        </div>
      </ErrorBoundary>

      {/* Forecast */}
      <ErrorBoundary name="Forecast">
        <div className="card">
          <div className="card-header">
            <span>现金流预测</span>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--color-text-muted)' }}>
              <span>生存月数 <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{runwayMonths}</span></span>
              <span>财务自由 <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{freedomProgress.toFixed(1)}%</span></span>
              <span>预警 <span style={{ fontWeight: 700, color: forecast.warningLevel === 'red' ? 'var(--color-danger)' : forecast.warningLevel === 'yellow' ? 'var(--color-warning)' : 'var(--color-text-heading)' }}>{forecast.warningLevel === 'red' ? '危险' : forecast.warningLevel === 'yellow' ? '预警' : '健康'}</span></span>
            </div>
          </div>
          <div className="card-body">
            <CashflowForecastChart months={fmonths} surplus={fsurplus} cumulative={fcumulative} />
            <TargetCashflow monthlyIncome={curIncome} monthlyExpense={curExpense} currentCash={currentCash} />
          </div>
        </div>
      </ErrorBoundary>
    </div>
  );
}
```

- [ ] **Step 3: 删除 react-grid-layout 相关文件**

```bash
rm src/components/layout/DashboardGrid.tsx
rm src/components/layout/dashboard-grid-overrides.css
```

- [ ] **Step 4: 验证构建**

```bash
npx next build 2>&1 | tail -10
```

Expected: 构建成功，无 import 错误。

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/page.tsx src/app/\(dashboard\)/DashboardClient.tsx
git rm src/components/layout/DashboardGrid.tsx src/components/layout/dashboard-grid-overrides.css
git commit -m "feat: SWR-powered dashboard with CSS Grid fixed cards

- Replaces server-side data fetching with SWR hooks
- Switches from react-grid-layout to CSS Grid 2-column layout
- Applies Firefly III card styling (card-header, card-body)
- Removes DashboardGrid component
- Shows skeleton loading state during data fetch

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: 改造 AssetManager + AssetTable — SWR + 乐观更新 + 样式重绘

**Files:**
- Modify: `src/app/management/assets/AssetManager.tsx`
- Modify: `src/app/management/assets/AssetTable.tsx`

- [ ] **Step 1: 重写 AssetManager.tsx**

Write `src/app/management/assets/AssetManager.tsx`:

```tsx
'use client';

import { useState, useOptimistic } from 'react';
import { AmountDisplay } from '@/components/common/AmountDisplay';
import { PriceRefresher } from '@/components/widgets/PriceRefresher';
import { AssetTable } from './AssetTable';
import { useAssets } from '@/hooks/useAssets';
import { useToast } from '@/components/common/Toast';
import { createAsset, updateAsset, deleteAsset } from '@/lib/actions/assets';
import { useSWRConfig } from 'swr';

export default function AssetManager() {
  const { data, isLoading, error: fetchError } = useAssets();
  const { mutate } = useSWRConfig();
  const toast = useToast();

  const assets = data?.data ?? [];
  const pricesStale = data?.pricesStale ?? false;

  const [optimisticAssets, addOptimistic] = useOptimistic(assets, (state, newAsset: any) => [newAsset, ...state]);
  const [formError, setFormError] = useState('');
  const [showDepreciation, setShowDepreciation] = useState(false);

  async function handleCreate(formData: FormData) {
    setFormError('');
    const newAsset = {
      id: 'optimistic-' + Date.now(),
      name: formData.get('name') as string,
      category: formData.get('category') as string,
      balance: formData.get('balance') as string || '0',
      currency: (formData.get('currency') as string) || 'CNY',
      isOptimistic: true,
    };
    addOptimistic(newAsset);
    (document.getElementById('create-form') as HTMLFormElement)?.reset();

    const result = await createAsset({
      name: formData.get('name') as string,
      category: formData.get('category') as string,
      balance: (formData.get('balance') as string) || undefined,
      currency: (formData.get('currency') as string) || 'CNY',
      quantity: (formData.get('quantity') as string) || undefined,
      stockCode: (formData.get('stockCode') as string) || undefined,
      market: (formData.get('market') as string) || undefined,
      costUnitPrice: (formData.get('costUnitPrice') as string) || undefined,
      costPrice: (formData.get('costPrice') as string) || undefined,
      purchaseDate: (formData.get('purchaseDate') as string) || undefined,
      scrapDate: (formData.get('scrapDate') as string) || undefined,
      scrapValue: (formData.get('scrapValue') as string) || undefined,
    });

    if (result.success) {
      mutate('assets');
      toast.success('资产已创建');
    } else if (result.error?.includes('会话密钥')) {
      window.location.href = '/login';
    } else {
      setFormError(result.error || '创建失败');
      mutate('assets');
    }
  }

  async function handleUpdate(formData: FormData) {
    setFormError('');
    const id = formData.get('id') as string;
    const result = await updateAsset(id, {
      name: (formData.get('name') as string) || undefined,
      balance: (formData.get('balance') as string) || undefined,
      quantity: (formData.get('quantity') as string) || undefined,
      stockCode: (formData.get('stockCode') as string) || undefined,
      market: (formData.get('market') as string) || undefined,
      costUnitPrice: (formData.get('costUnitPrice') as string) || undefined,
      purchaseDate: (formData.get('purchaseDate') as string) || undefined,
      scrapDate: (formData.get('scrapDate') as string) || undefined,
      scrapValue: (formData.get('scrapValue') as string) || undefined,
    });
    if (result.success) {
      mutate('assets');
      toast.success('资产已更新');
    } else {
      setFormError(result.error || '更新失败');
    }
  }

  async function handleDelete(formData: FormData) {
    setFormError('');
    const id = formData.get('id') as string;
    mutate('assets', (current: any) => ({
      ...current,
      data: current?.data?.filter((a: any) => a.id !== id) ?? [],
    }), false);

    const result = await deleteAsset(id);
    if (result.success) {
      mutate('assets');
      toast.success('资产已删除');
    } else {
      setFormError(result.error || '删除失败');
      mutate('assets');
    }
  }

  if (isLoading) {
    return (
      <div>
        <div className="skeleton" style={{ height: 36, width: 180, marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 80, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 400 }} />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>资产管理</h1>
        <PriceRefresher pricesStale={pricesStale} />
      </div>

      {formError && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <span>{formError}</span>
          <button onClick={() => setFormError('')} className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>✕</button>
        </div>
      )}

      {/* Special Accounts Summary */}
      {(() => {
        const specialMap: Record<string, { icon: string; label: string }> = {
          provident_fund: { icon: '🏦', label: '公积金' },
          pension: { icon: '🏛️', label: '养老保险' },
          current_deposit: { icon: '💳', label: '银行活期' },
        };
        const specialAssets = assets.filter((a: any) => specialMap[a.category]);
        if (specialAssets.length === 0) return null;
        const groups: Record<string, { icon: string; label: string; assets: any[]; total: number }> = {};
        for (const a of specialAssets) {
          const cfg = specialMap[a.category];
          if (!groups[a.category]) groups[a.category] = { ...cfg, assets: [], total: 0 };
          groups[a.category].assets.push(a);
          groups[a.category].total += parseFloat(a.balance || '0');
        }
        return (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">专项账户总览</div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {Object.entries(groups).map(([cat, g]) => (
                  <div key={cat} style={{ background: 'var(--color-surface-alt)', borderRadius: 'var(--radius-md)', padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontWeight: 500 }}>
                      <span>{g.icon} {g.label}</span>
                      <AmountDisplay amount={g.total} className="text-sm" sensitive />
                    </div>
                    {g.assets.map((a: any) => (
                      <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-muted)', padding: '1px 0' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                        <AmountDisplay amount={parseFloat(a.balance || '0')} className="shrink-0" sensitive />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border-light)', fontSize: 12, color: 'var(--color-text-muted)' }}>
                小计 ¥{Object.values(groups).reduce((s: number, g: any) => s + g.total, 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Create Form */}
      <form id="create-form" action={handleCreate} className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">新增资产</div>
        <div className="card-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">名称</label>
              <input name="name" required className="form-input" placeholder="资产名称" style={{ width: 140 }} />
            </div>
            <div className="form-group">
              <label className="form-label">分类</label>
              <select name="category" required className="form-select" style={{ width: 140 }}>
                <option value="">选择分类</option>
                <option value="real_estate">🏠 房产</option>
                <option value="cash">💰 现金</option>
                <option value="current_deposit">💳 银行活期</option>
                <option value="provident_fund">🏦 公积金账户</option>
                <option value="pension">🏛️ 养老账户</option>
                <option value="gold_physical">🟡 实物黄金</option>
                <option value="gold_paper">📄 纸黄金</option>
                <option value="stock">📈 股票</option>
                <option value="fund">📊 基金</option>
                <option value="bond">📜 债券</option>
                <option value="vehicle">🚗 车辆</option>
                <option value="other">📦 其他</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">币种</label>
              <input name="currency" defaultValue="CNY" className="form-input" style={{ width: 80 }} />
            </div>
            {showDepreciation ? (
              <div className="form-group">
                <label className="form-label">买入总价</label>
                <input name="costPrice" type="number" step="0.01" required className="form-input" placeholder="折旧前原价" style={{ width: 130 }} />
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">余额/金额</label>
                <input name="balance" type="number" step="0.01" className="form-input" placeholder="手动金额" style={{ width: 130 }} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input type="checkbox" checked={showDepreciation} onChange={e => setShowDepreciation(e.target.checked)} />
                折旧
              </label>
            </div>
            {showDepreciation && (
              <>
                <div className="form-group">
                  <label className="form-label">买入日期</label>
                  <input name="purchaseDate" type="date" className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">报废日期</label>
                  <input name="scrapDate" type="date" className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">报废残值</label>
                  <input name="scrapValue" type="number" step="0.01" defaultValue="0" className="form-input" placeholder="0" style={{ width: 100 }} />
                </div>
              </>
            )}
            <button type="submit" className="btn btn-primary">创建</button>
          </div>
        </div>
      </form>

      {/* Table */}
      <AssetTable assets={optimisticAssets} handleDelete={handleDelete} handleUpdate={handleUpdate} />
    </div>
  );
}
```

- [ ] **Step 2: 重写 AssetTable.tsx 样式**

Write `src/app/management/assets/AssetTable.tsx` — 保留所有现有编辑和内联表单逻辑，只替换 className：

将所有 `className="rounded-xl bg-ledger-surface overflow-hidden overflow-x-auto"` 改为 `className="table-container"`。

将所有 `className="border-b border-ledger-bg text-left text-ledger-muted"` (thead tr) 的样式依赖现在由 `.table-container thead th` 提供。

将所有 `<td>` 和 `<th>` 的 `className="px-4 py-3 ..."` 改为依赖 `.table-container` 的 CSS 规则（全局设置 padding）。但 Tailwind 的工具类会覆盖，所以可以保留内联 style 或使用全局 table 类。

**实际做法：** 将 AssetTable 的最外层 div 改为 `<div className="table-container">`，移除 table 上的 `className="w-full text-sm"`（由 .table-container 全局样式提供），移除 thead tr 上的 border/color 类，移除 tbody tr 上的 border 类。

保留内联编辑表单中的所有功能逻辑和输入元素，只将输入/选择的 className 改为 `form-input` / `form-select`，将保存按钮的 className 改为 `btn btn-primary btn-sm`，将编辑/删除按钮改为 `btn btn-ghost btn-sm` 和 `btn btn-danger btn-sm`。

- [ ] **Step 3: 删除 DashboardGrid 和 dashboard-grid-overrides.css（如果尚未删除）**

```bash
rm -f src/components/layout/DashboardGrid.tsx src/components/layout/dashboard-grid-overrides.css
```

- [ ] **Step 4: 验证构建**

```bash
npx next build 2>&1 | tail -10
```

Expected: 构建成功。

- [ ] **Step 5: Commit**

```bash
git add src/app/management/assets/
git rm -f src/components/layout/DashboardGrid.tsx src/components/layout/dashboard-grid-overrides.css
git commit -m "feat: optimistic updates and Firefly III styling for AssetManager

- SWR-based data fetching with useOptimistic for instant create/delete
- Card-based form layout matching Bootstrap/AdminLTE style
- Toast notifications for success/error feedback
- Table styling via .table-container global CSS class
- Removes react-grid-layout leftovers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: 重写 LedgerManager — SWR + 乐观更新 + 样式重绘

**Files:**
- Modify: `src/app/management/ledger/LedgerManager.tsx`

- [ ] **Step 1: 重写 LedgerManager.tsx**

将数据加载改为 SWR：

```tsx
'use client';

import { useState, useEffect, useCallback, useOptimistic } from 'react';
import { useSWRConfig } from 'swr';
import { useTransactions } from '@/hooks/useTransactions';
import { useAssets } from '@/hooks/useAssets';
import { useToast } from '@/components/common/Toast';
import { createTransaction, deleteTransaction, updateTransactionReconciled, updateTransaction } from '@/lib/actions/ledger';
import {
  getRecurringRules,
  createRecurringRule,
  updateRecurringRule,
  toggleRecurringRule,
  deleteRecurringRule,
} from '@/lib/actions/recurring';
// ... (keep existing type definitions and utility functions)
```

替换数据获取：移除 props，用 hooks：

```tsx
export default function LedgerManager() {
  const { data: txData, isLoading: txLoading } = useTransactions();
  const transactions = txData?.data ?? [];
  const { data: assetData } = useAssets();
  const assets = assetData?.data ?? [];
  const { mutate } = useSWRConfig();
  const toast = useToast();
  // ... keep rest of state and logic
```

将所有 `router.refresh()` 替换为 `mutate('transactions')` + toast 通知。

将所有 `router.push('/login')` 替换为 `window.location.href = '/login'`。

将所有 className 替换为新的全局 CSS 类：
- `rounded-xl bg-ledger-surface overflow-hidden` → `table-container`
- `rounded-xl bg-ledger-surface p-4 flex flex-wrap gap-3 items-end` → `card` + `card-body` + `form-row`
- 输入和选择框 → `form-input` / `form-select`
- 按钮 → `btn btn-primary` / `btn btn-outline` / `btn btn-danger`
- 标签 → `badge badge-success` / `badge badge-danger` / `badge badge-info`
- 错误提示 → `alert alert-error`

添加骨架屏加载：当 `txLoading` 为 true 时展示骨架屏。

- [ ] **Step 2: 添加乐观删除**

```tsx
const [optimisticTx, deleteOptimistic] = useOptimistic(
  transactions,
  (state, txId: string) => state.filter((t: any) => t.id !== txId)
);

async function handleDelete(formData: FormData) {
  setError('');
  const id = formData.get('id') as string;
  deleteOptimistic(id);
  const result = await deleteTransaction(id);
  if (result.success) {
    mutate('transactions');
    toast.success('交易已删除');
  } else if (result.error?.includes('会话密钥')) {
    window.location.href = '/login';
  } else {
    setError(result.error || '删除失败');
    mutate('transactions');
  }
}
```

类似地为创建添加乐观更新。

- [ ] **Step 3: 验证构建**

```bash
npx next build 2>&1 | tail -10
```

Expected: 构建成功。

- [ ] **Step 4: Commit**

```bash
git add src/app/management/ledger/LedgerManager.tsx
git commit -m "feat: SWR + optimistic updates + Firefly III styling for LedgerManager

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: 重写 BudgetManager — SWR + 乐观更新 + 样式重绘

**Files:**
- Modify: `src/app/management/budget/BudgetManager.tsx`

- [ ] **Step 1: 改造 BudgetManager.tsx**

按照与 LedgerManager 相同的模式：

1. 移除 props，改用 `useBudgets(currentDate)` hook
2. 保留所有创建/编辑/删除/记录支出功能逻辑
3. 将所有 `router.refresh()` 替换为 `mutate('budgets')` + toast
4. 将所有 className 替换为新 CSS 类
5. 添加乐观更新到删除和创建操作
6. 添加骨架屏加载状态

- [ ] **Step 2: 验证构建**

```bash
npx next build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/app/management/budget/BudgetManager.tsx
git commit -m "feat: SWR + optimistic updates + Firefly III styling for BudgetManager

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: 重写 LiabilityManager — SWR + 乐观更新 + 样式重绘

**Files:**
- Modify: `src/app/management/liabilities/LiabilityManager.tsx`

- [ ] **Step 1: 改造 LiabilityManager.tsx**

按照相同模式：
1. 移除 props，改用 `useLiabilities()` + `useTransactions()` hooks
2. 保留所有创建/编辑/删除/还款功能逻辑
3. 将所有 `router.refresh()` 替换为 `mutate()` + toast
4. 将所有 className 替换为新 CSS 类
5. 添加乐观更新
6. 添加骨架屏加载状态

- [ ] **Step 2: 验证构建**

```bash
npx next build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/app/management/liabilities/LiabilityManager.tsx
git commit -m "feat: SWR + optimistic updates + Firefly III styling for LiabilityManager

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 13: 创建 loading.tsx 骨架屏

**Files:**
- Create: `src/app/(dashboard)/loading.tsx`
- Create: `src/app/management/loading.tsx`
- Create: `src/app/management/assets/loading.tsx`
- Create: `src/app/management/ledger/loading.tsx`
- Create: `src/app/management/budget/loading.tsx`
- Create: `src/app/management/liabilities/loading.tsx`

- [ ] **Step 1: 创建所有 loading.tsx 文件**

每个文件的骨架屏内容应匹配对应页面的布局结构。使用全局 `.skeleton` CSS 类。

Write `src/app/(dashboard)/loading.tsx`:

```tsx
export default function DashboardLoading() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, maxWidth: 1400, margin: '0 auto' }}>
      <div className="skeleton" style={{ gridColumn: '1 / -1', height: 60 }} />
      <div className="skeleton" style={{ gridColumn: '1 / -1', height: 140 }} />
      <div className="skeleton" style={{ height: 280 }} />
      <div className="skeleton" style={{ height: 280 }} />
      <div className="skeleton" style={{ gridColumn: '1 / -1', height: 280 }} />
      <div className="skeleton" style={{ height: 260 }} />
      <div className="skeleton" style={{ height: 260 }} />
    </div>
  );
}
```

Write `src/app/management/loading.tsx`:

```tsx
export default function ManagementLoading() {
  return (
    <div>
      <div className="skeleton" style={{ height: 36, width: 180, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 400 }} />
    </div>
  );
}
```

Write `src/app/management/assets/loading.tsx`:

```tsx
export default function AssetsLoading() {
  return (
    <div>
      <div className="skeleton" style={{ height: 36, width: 180, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 80, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 400 }} />
    </div>
  );
}
```

Write `src/app/management/ledger/loading.tsx`:

```tsx
export default function LedgerLoading() {
  return (
    <div>
      <div className="skeleton" style={{ height: 36, width: 180, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 80, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 500 }} />
    </div>
  );
}
```

Write `src/app/management/budget/loading.tsx`:

```tsx
export default function BudgetLoading() {
  return (
    <div>
      <div className="skeleton" style={{ height: 36, width: 180, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 200, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 80, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 400 }} />
    </div>
  );
}
```

Write `src/app/management/liabilities/loading.tsx`:

```tsx
export default function LiabilitiesLoading() {
  return (
    <div>
      <div className="skeleton" style={{ height: 36, width: 180, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 80, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 400 }} />
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

```bash
npx next build 2>&1 | tail -10
```

Expected: 构建成功，所有 loading.tsx 被识别。

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/loading.tsx src/app/management/loading.tsx src/app/management/*/loading.tsx
git commit -m "feat: add skeleton loading states for all routes

Skeleton screens provide instant feedback during page navigation
and SWR data fetching. Styled with shimmer animation matching the
Firefly III design language.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 14: 最终验证

- [ ] **Step 1: 完整构建**

```bash
npx next build 2>&1
```

Expected: 构建完全成功，零错误。

- [ ] **Step 2: 检查所有 import 引用**

```bash
grep -rn "DashboardGrid\|DashboardNav\|ManagementSidebar\|react-grid-layout" src/ --include="*.tsx" --include="*.ts" 2>/dev/null
```

Expected: 无结果（所有引用已清理）。

- [ ] **Step 3: 检查 router.refresh 是否已替换**

```bash
grep -rn "router.refresh" src/app/ --include="*.tsx" | grep -v node_modules
```

Expected: 输出应大幅减少（auth 相关的 login/register 页面保留 router.refresh 是可以的）。

- [ ] **Step 4: 启动开发服务器进行手动验证**

```bash
npm run dev &
sleep 5
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

Expected: HTTP 200。

- [ ] **Step 5: 测试亮暗切换**

打开浏览器访问 http://localhost:3000，点击侧边栏底部的 ThemeToggle 按钮，验证主题在亮色/暗色之间切换，且 localStorage 中 theme 值正确持久化。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: final verification — all routes build cleanly, all old imports cleaned

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## 注意事项

1. **认证页面不改造** — `/login` 和 `/register` 页面保持原样，它们的 `router.refresh()` 和 `router.push()` 保留不变
2. **Server actions 不动** — 所有 `src/lib/actions/*.ts` 文件的功能逻辑完全不变
3. **Widget 组件改动最小** — `MonthFlow`、`BudgetTracker`、`StockTable` 等 widget 组件保留功能逻辑，只替换样式 className
4. **echarts 图表不受影响** — 图表组件仅通过 CSS 变量调整主题色
5. **管理页面的分类管理** (`/management/categories`) 画面保持现有逻辑，只需替换样式类名
