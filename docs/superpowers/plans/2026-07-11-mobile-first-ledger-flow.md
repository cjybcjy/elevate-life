# Mobile-First Ledger Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Google Play 优先的 Android 手机尺寸上跑通“协议确认 → 登录 → 记一笔 → 新流水出现”的真实闭环，同时保持桌面端现有行为。

**Architecture:** 保留单一 Next.js App Router 应用和现有 Server Actions。手机导航从桌面 `Sidebar` 中拆成一个独立 Client Component；快速记账只负责把本地解析草稿填入现有流水表单，最终仍由 `createTransaction` 写库。Playwright 使用真实本地服务、审核账号和临时流水完成端到端验证，并在结束时删除测试流水。

**Tech Stack:** Next.js 16.2.6 App Router、React 19.2.4、TypeScript 5、Tailwind CSS 4、SWR 2.4.1、Node test runner、tsx、Playwright 1.61.0。

## Global Constraints

- 唯一开发地址：`http://localhost:3000`。
- 主验收 viewport：`360 × 800`；短屏：`360 × 640`；Pixel 7：`412 × 839`；键盘压力：`360 × 520`；桌面回归：`1440 × 900`。
- Google Play 竖屏截图输出：`1080 × 1920`，比例 `9:16`。
- 手机布局边界保持为 `< 768px`；桌面侧边栏在 `>= 768px` 保持现状。
- 不修改 Prisma schema、认证协议、API 路由、Capacitor、Android 工程、iOS 工程或依赖版本。
- 不创建第二套移动客户端；手机和桌面继续共享 Next.js 页面、Server Actions 和数据库。
- 不修改或回退现有用户改动。已知脏文件包括 `src/app/globals.css`、`src/app/layout.tsx`、`src/app/(auth)/login/page.tsx`、Dashboard/资产/目标/图表/主题相关文件；已知未跟踪依赖包括 `src/components/widgets/LedgerAgentQuickEntry.tsx`、`src/lib/ledger-agent.ts` 及其测试。
- 不使用 `git add .`、`git add -A`、`git commit -a`。实施任务先以 path-scoped diff 作为检查点；涉及上述用户文件时，不提交，直到用户明确授权如何处理既有改动。
- 写代码前已核对本仓库 Next.js 16 文档：`usePathname` 仅用于 Client Component，内部导航使用 `<Link>`，表单继续使用现有 Client Component handler + Server Action，浏览器验证使用 Playwright。
- Browser 插件在当前会话不可用；渲染验证使用仓库已有 Playwright，并在最终报告中记录这一回退原因。

## File Structure

### Create

- `src/lib/mobile-navigation.ts`：手机主导航/更多菜单的纯数据和 active 判定。
- `src/lib/mobile-navigation.test.ts`：导航项目、顺序和 active 规则的 Node 单元测试。
- `src/components/layout/MobileNavigation.tsx`：手机顶栏、五项底栏和“更多”菜单。
- `src/components/layout/MobileNavigation.test.tsx`：手机导航静态结构的服务端渲染测试。
- `src/lib/ledger-quick-entry.ts`：`LedgerAgentDraft` 到现有创建表单值的纯映射。
- `src/lib/ledger-quick-entry.test.ts`：草稿映射测试。
- `scripts/check-mobile-ledger-flow.ts`：真实浏览器端到端检查和临时流水清理。

### Modify

- `src/components/layout/Sidebar.tsx`：保留桌面侧边栏，手机部分改为调用 `MobileNavigation`。
- `src/app/management/ledger/LedgerManager.tsx`：在 `focus=create` 时显示快速输入、填充现有表单、刷新相关 SWR 缓存并暴露稳定 QA selector。
- `src/components/common/LegalConsentGate.tsx`：让协议弹层在短屏和安全区内可滚动、按钮可触达。
- `package.json`：新增 `mobile:flow:check` 命令。

### Explicitly Do Not Modify

- `src/app/globals.css`：已有用户改动；五列导航通过组件内联 grid 和现有类组合完成。
- `src/app/layout.tsx`：已有用户改动，当前 viewport/safe-area metadata 已满足本阶段。
- `src/app/(auth)/login/page.tsx`：已有登录错误处理改动，端到端验证复用当前实现。
- `src/components/widgets/LedgerAgentQuickEntry.tsx`、`src/lib/ledger-agent.ts`：作为已存在的工作树依赖复用，不覆盖、不重写、不擅自提交。

---

### Task 1: Replace the Seven-Item Mobile Bar with a Five-Item Shell

**Files:**
- Create: `src/lib/mobile-navigation.ts`
- Create: `src/lib/mobile-navigation.test.ts`
- Create: `src/components/layout/MobileNavigation.tsx`
- Create: `src/components/layout/MobileNavigation.test.tsx`
- Modify: `src/components/layout/Sidebar.tsx:1-242`

**Interfaces:**
- Consumes: `BirdLogo`, `ThemeToggle`, Next.js `Link`, `usePathname`, and `Sidebar.handleLogout()`.
- Produces: `MOBILE_PRIMARY_NAV_ITEMS`, `MOBILE_MORE_NAV_ITEMS`, `isMobileNavItemActive(pathname, id)`, and default component `MobileNavigation({ onLogout })`.

- [ ] **Step 1: Write the failing navigation model test**

Create `src/lib/mobile-navigation.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MOBILE_MORE_NAV_ITEMS,
  MOBILE_PRIMARY_NAV_ITEMS,
  isMobileNavItemActive,
} from './mobile-navigation';

test('mobile navigation keeps five primary actions in the approved order', () => {
  assert.deepEqual(
    MOBILE_PRIMARY_NAV_ITEMS.map((item) => [item.id, item.href]),
    [
      ['home', '/'],
      ['assets', '/management/assets'],
      ['quick-entry', '/management/ledger?focus=create'],
      ['ledger', '/management/ledger'],
      ['budget', '/management/budget'],
    ],
  );
});

test('mobile more menu preserves every low-frequency route', () => {
  assert.deepEqual(
    MOBILE_MORE_NAV_ITEMS.map((item) => item.href),
    [
      '/management/liabilities',
      '/management/goals',
      '/management/categories',
      '/account/password',
    ],
  );
});

test('mobile active state marks page tabs but not the quick-entry action', () => {
  assert.equal(isMobileNavItemActive('/', 'home'), true);
  assert.equal(isMobileNavItemActive('/management/assets', 'assets'), true);
  assert.equal(isMobileNavItemActive('/management/ledger', 'ledger'), true);
  assert.equal(isMobileNavItemActive('/management/ledger', 'quick-entry'), false);
  assert.equal(isMobileNavItemActive('/management/budget/history', 'budget'), true);
});
```

- [ ] **Step 2: Run the model test and verify the missing module failure**

Run:

```bash
npx tsx --test src/lib/mobile-navigation.test.ts
```

Expected: FAIL with `Cannot find module './mobile-navigation'`.

- [ ] **Step 3: Implement the navigation model**

Create `src/lib/mobile-navigation.ts`:

```ts
export type MobilePrimaryNavId = 'home' | 'assets' | 'quick-entry' | 'ledger' | 'budget';

export type MobileNavItem = {
  id: MobilePrimaryNavId;
  label: string;
  href: string;
  icon: string;
};

export type MobileMoreNavItem = {
  label: string;
  href: string;
  icon: string;
};

export const MOBILE_PRIMARY_NAV_ITEMS: MobileNavItem[] = [
  { id: 'home', label: '首页', href: '/', icon: '🏠' },
  { id: 'assets', label: '资产', href: '/management/assets', icon: '💰' },
  { id: 'quick-entry', label: '记一笔', href: '/management/ledger?focus=create', icon: '＋' },
  { id: 'ledger', label: '流水', href: '/management/ledger', icon: '📝' },
  { id: 'budget', label: '预算', href: '/management/budget', icon: '📊' },
];

export const MOBILE_MORE_NAV_ITEMS: MobileMoreNavItem[] = [
  { label: '负债管理', href: '/management/liabilities', icon: '📋' },
  { label: '目标管理', href: '/management/goals', icon: '🎯' },
  { label: '分类管理', href: '/management/categories', icon: '🏷️' },
  { label: '修改密码', href: '/account/password', icon: '🔐' },
];

export function isMobileNavItemActive(pathname: string, id: MobilePrimaryNavId) {
  if (id === 'quick-entry') return false;
  if (id === 'home') return pathname === '/';
  if (id === 'assets') return pathname.startsWith('/management/assets');
  if (id === 'ledger') return pathname.startsWith('/management/ledger');
  return pathname.startsWith('/management/budget');
}
```

- [ ] **Step 4: Run the model test and verify it passes**

Run:

```bash
npx tsx --test src/lib/mobile-navigation.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Write the failing navigation view test**

Create `src/components/layout/MobileNavigation.test.tsx`:

```tsx
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import { MobileNavigationView } from './MobileNavigation';

test('MobileNavigationView renders five primary actions and a closed more button', () => {
  const markup = renderToString(
    <MobileNavigationView
      pathname="/"
      menuOpen={false}
      onMenuToggle={() => {}}
      onMenuClose={() => {}}
      onLogout={() => {}}
    />,
  );

  assert.equal((markup.match(/data-mobile-primary-nav=/g) ?? []).length, 5);
  assert.match(markup, /href="\/management\/ledger\?focus=create"/);
  assert.match(markup, /aria-label="更多功能"/);
  assert.match(markup, /aria-expanded="false"/);
  assert.doesNotMatch(markup, /role="dialog"/);
});

test('MobileNavigationView exposes all approved more-menu actions', () => {
  const markup = renderToString(
    <MobileNavigationView
      pathname="/management/ledger"
      menuOpen
      onMenuToggle={() => {}}
      onMenuClose={() => {}}
      onLogout={() => {}}
    />,
  );

  assert.match(markup, /role="dialog"/);
  assert.match(markup, /aria-label="更多功能菜单"/);
  assert.match(markup, /负债管理/);
  assert.match(markup, /目标管理/);
  assert.match(markup, /分类管理/);
  assert.match(markup, /修改密码/);
  assert.match(markup, /退出登录/);
});
```

- [ ] **Step 6: Run the view test and verify the missing component failure**

Run:

```bash
npx tsx --test src/components/layout/MobileNavigation.test.tsx
```

Expected: FAIL with `Cannot find module './MobileNavigation'`.

- [ ] **Step 7: Implement the mobile navigation component**

Create `src/components/layout/MobileNavigation.tsx` with this public structure and behavior:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BirdLogo from '@/components/common/BirdLogo';
import ThemeToggle from '@/components/common/ThemeToggle';
import {
  MOBILE_MORE_NAV_ITEMS,
  MOBILE_PRIMARY_NAV_ITEMS,
  isMobileNavItemActive,
} from '@/lib/mobile-navigation';

type MobileNavigationViewProps = {
  pathname: string;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onMenuClose: () => void;
  onLogout: () => void | Promise<void>;
};

export function MobileNavigationView({
  pathname,
  menuOpen,
  onMenuToggle,
  onMenuClose,
  onLogout,
}: MobileNavigationViewProps) {
  return (
    <>
      <header className="mobile-topbar">
        <Link href="/" className="mobile-brand" aria-label="回到首页">
          <BirdLogo size={30} />
          <span>家庭账本</span>
        </Link>
        <button
          type="button"
          className="mobile-icon-button"
          aria-label="更多功能"
          aria-expanded={menuOpen}
          aria-controls="mobile-more-menu"
          onClick={onMenuToggle}
        >
          ☰
        </button>
      </header>

      {menuOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[90] border-0 bg-black/40 md:hidden"
            aria-label="关闭更多功能"
            onClick={onMenuClose}
          />
          <section
            id="mobile-more-menu"
            role="dialog"
            aria-modal="true"
            aria-label="更多功能菜单"
            className="fixed right-3 left-3 z-[100] grid gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-container)] p-3 shadow-xl md:hidden"
            style={{ bottom: 'calc(78px + env(safe-area-inset-bottom))' }}
          >
            <div className="grid grid-cols-2 gap-2">
              {MOBILE_MORE_NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onMenuClose}
                  className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border-tertiary)] px-3 py-2 text-sm text-[var(--color-text-primary)] no-underline"
                >
                  <span aria-hidden>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
            <ThemeToggle />
            <button
              type="button"
              className="min-h-11 rounded-lg border border-[var(--border-tertiary)] px-3 py-2 text-left text-sm text-[var(--color-danger)]"
              onClick={async () => {
                onMenuClose();
                await onLogout();
              }}
            >
              🚪 退出登录
            </button>
          </section>
        </>
      ) : null}

      <nav
        className="mobile-bottom-nav"
        aria-label="主要导航"
        style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}
      >
        {MOBILE_PRIMARY_NAV_ITEMS.map((item) => {
          const active = isMobileNavItemActive(pathname, item.id);
          const primary = item.id === 'quick-entry';
          return (
            <Link
              key={item.id}
              href={item.href}
              prefetch
              data-mobile-primary-nav={item.id}
              aria-current={active ? 'page' : undefined}
              className={active
                ? 'mobile-bottom-nav__item mobile-bottom-nav__item--active'
                : 'mobile-bottom-nav__item'}
              style={primary ? {
                background: 'var(--color-accent)',
                color: 'var(--color-text-inverse)',
                transform: 'translateY(-8px)',
                boxShadow: 'var(--shadow-md)',
              } : undefined}
            >
              <span className="mobile-bottom-nav__icon" aria-hidden>{item.icon}</span>
              <span className="mobile-bottom-nav__label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export default function MobileNavigation({ onLogout }: { onLogout: () => void | Promise<void> }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  return (
    <MobileNavigationView
      pathname={pathname}
      menuOpen={menuOpen}
      onMenuToggle={() => setMenuOpen((current) => !current)}
      onMenuClose={() => setMenuOpen(false)}
      onLogout={onLogout}
    />
  );
}
```

- [ ] **Step 8: Replace only the mobile fragment in Sidebar**

In `src/components/layout/Sidebar.tsx`:

1. Add this import:

```tsx
import MobileNavigation from '@/components/layout/MobileNavigation';
```

2. Keep the desktop `<aside>` and desktop `ThemeToggle` unchanged.
3. Delete the complete mobile header block that starts with `<header className="mobile-topbar">` and ends at its matching `</header>`.
4. Delete the complete mobile navigation block that starts with `<nav className="mobile-bottom-nav" aria-label="主要导航">` and ends at its matching `</nav>`.
5. Insert immediately after `</aside>`:

```tsx
<MobileNavigation onLogout={handleLogout} />
```

- [ ] **Step 9: Run navigation tests and lint**

Run:

```bash
npx tsx --test src/lib/mobile-navigation.test.ts src/components/layout/MobileNavigation.test.tsx
npm run lint -- src/lib/mobile-navigation.ts src/lib/mobile-navigation.test.ts src/components/layout/MobileNavigation.tsx src/components/layout/MobileNavigation.test.tsx src/components/layout/Sidebar.tsx
```

Expected: 5 tests PASS; ESLint exits 0.

- [ ] **Step 10: Record a path-scoped checkpoint**

Run:

```bash
git diff --check -- src/components/layout/Sidebar.tsx
if rg -n '[[:blank:]]+$' src/lib/mobile-navigation.ts src/lib/mobile-navigation.test.ts src/components/layout/MobileNavigation.tsx src/components/layout/MobileNavigation.test.tsx; then exit 1; fi
git status --short -- src/lib/mobile-navigation.ts src/lib/mobile-navigation.test.ts src/components/layout/MobileNavigation.tsx src/components/layout/MobileNavigation.test.tsx src/components/layout/Sidebar.tsx
```

Expected: no whitespace errors; status shows only the five named paths in this checkpoint. Do not stage unrelated working-tree files.

---

### Task 2: Fill the Existing Ledger Form from the Local Quick-Entry Draft

**Files:**
- Create: `src/lib/ledger-quick-entry.ts`
- Create: `src/lib/ledger-quick-entry.test.ts`
- Modify: `src/app/management/ledger/LedgerManager.tsx:1-384,640-826,977-1039`
- Consume without modifying: `src/components/widgets/LedgerAgentQuickEntry.tsx`
- Consume without modifying: `src/lib/ledger-agent.ts`

**Interfaces:**
- Consumes: `LedgerAgentDraft`, `LedgerAgentQuickEntry({ categories, assets, onApply })`, `createTransaction`, SWR `mutate`.
- Produces: `LedgerCreateFormValues`, `buildLedgerCreateFormValues(draft)`, `data-ledger-create-form`, and `data-transaction-list`.

- [ ] **Step 1: Write the failing draft-to-form mapping test**

Create `src/lib/ledger-quick-entry.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLedgerCreateFormValues } from './ledger-quick-entry';

test('buildLedgerCreateFormValues maps an agent draft into the existing create form', () => {
  assert.deepEqual(
    buildLedgerCreateFormValues({
      type: 'EXPENSE',
      amount: '32',
      currency: 'CNY',
      categoryId: 'cat-food',
      fromAccountId: 'asset-cash',
      toAccountId: '',
      description: '今天午饭 用现金',
      occurredAt: '2026-07-11',
      confidence: 0.86,
      notes: ['已识别金额、日期、分类和来源账户'],
    }),
    {
      type: 'EXPENSE',
      amount: '32',
      currency: 'CNY',
      categoryId: 'cat-food',
      budgetId: '',
      fromAccountId: 'asset-cash',
      toAccountId: '',
      description: '今天午饭 用现金',
      occurredAt: '2026-07-11',
    },
  );
});
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run:

```bash
npx tsx --test src/lib/ledger-quick-entry.test.ts
```

Expected: FAIL with `Cannot find module './ledger-quick-entry'`.

- [ ] **Step 3: Implement the pure form mapper**

Create `src/lib/ledger-quick-entry.ts`:

```ts
import type { LedgerAgentDraft } from '@/lib/ledger-agent';

export type LedgerCreateFormValues = {
  type: string;
  amount: string;
  currency: string;
  categoryId: string;
  budgetId: string;
  fromAccountId: string;
  toAccountId: string;
  description: string;
  occurredAt: string;
};

export function buildLedgerCreateFormValues(draft: LedgerAgentDraft): LedgerCreateFormValues {
  return {
    type: draft.type,
    amount: draft.amount,
    currency: draft.currency,
    categoryId: draft.categoryId,
    budgetId: '',
    fromAccountId: draft.fromAccountId,
    toAccountId: draft.toAccountId,
    description: draft.description,
    occurredAt: draft.occurredAt,
  };
}
```

- [ ] **Step 4: Run the mapper and existing ledger-agent tests**

Run:

```bash
npx tsx --test src/lib/ledger-quick-entry.test.ts src/lib/ledger-agent.test.ts src/components/widgets/LedgerAgentQuickEntry.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 5: Wire quick entry into LedgerManager without bypassing the form**

In `src/app/management/ledger/LedgerManager.tsx`, add imports:

```tsx
import LedgerAgentQuickEntry from '@/components/widgets/LedgerAgentQuickEntry';
import { buildLedgerCreateFormValues } from '@/lib/ledger-quick-entry';
```

Inside `LedgerManager()`, next to the existing form state, add:

```tsx
const createFormRef = useRef<HTMLFormElement>(null);
const [quickEntryResetKey, setQuickEntryResetKey] = useState(0);
```

Immediately before the existing create form, render:

```tsx
{isCreateFocus ? (
  <section className="mb-4 md:hidden" aria-label="快速记一笔">
    <LedgerAgentQuickEntry
      key={quickEntryResetKey}
      categories={categories}
      assets={assets}
      onApply={(draft) => {
        setFormValues(buildLedgerCreateFormValues(draft));
        requestAnimationFrame(() => {
          const form = createFormRef.current;
          form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          form?.querySelector<HTMLInputElement>('input[name="amount"]')?.focus({ preventScroll: true });
        });
      }}
    />
  </section>
) : null}
```

Change the create form opening element to:

```tsx
<form
  ref={createFormRef}
  id="create-form"
  data-ledger-create-form="true"
  action={handleCreate}
  className={`mb-4 grid grid-cols-1 items-end gap-3 rounded-xl bg-ledger-surface p-4 md:flex md:flex-wrap ${
    isCreateFocus ? 'border border-ledger-accent/30' : ''
  }`}
>
```

Apply the following exact class matrix only to the first, transaction-create form; do not change the later edit or recurring forms:

| Element in the create form | Exact class change |
|---|---|
| Direct wrapper containing `type` | Set `className="min-w-0 w-full md:w-auto"` |
| Direct wrapper containing `currency` | Set `className="min-w-0 w-full md:w-auto"` |
| Direct wrapper containing `amount` | Set `className="min-w-0 w-full md:w-auto"` |
| Direct wrapper containing `categoryId` | Set `className="min-w-0 w-full md:w-auto"` |
| Conditional direct wrapper containing `budgetId` | Set `className="min-w-0 w-full md:w-auto"` |
| Direct wrapper containing `fromAccountId` | Set `className="min-w-0 w-full md:w-auto"` |
| Direct wrapper containing `toAccountId` | Set `className="min-w-0 w-full md:w-auto"` |
| Direct wrapper containing `occurredAt` | Set `className="min-w-0 w-full md:w-auto"` |
| Direct wrapper containing `description` | Set `className="min-w-0 w-full md:w-auto"` |
| The nine named `<input>` / `<select>` controls above | Append `w-full min-h-11 md:w-auto` to each existing class string |

Change the action wrapper to:

```tsx
<div className="flex min-w-0 w-full items-end gap-2 md:w-auto">
```

Change the submit button classes so it remains reachable and full-width on narrow screens:

```tsx
className="min-h-11 flex-1 rounded-md bg-ledger-accent px-4 py-2 text-sm font-medium text-[var(--color-text-inverse)] transition-opacity hover:opacity-90 disabled:opacity-50 md:flex-none"
```

Add `data-transaction-list="true"` to the transaction table wrapper:

```tsx
<div data-transaction-list="true" className="rounded-xl bg-ledger-surface overflow-hidden">
```

- [ ] **Step 6: Make success reset only after the server confirms the write**

Replace the current `if (result.success)` body in `handleCreate` with:

```tsx
if (result.success) {
  createFormRef.current?.reset();
  setFormValues({
    type: 'EXPENSE',
    amount: '',
    currency: 'CNY',
    categoryId: '',
    budgetId: '',
    fromAccountId: '',
    toAccountId: '',
    description: '',
    occurredAt: new Date().toISOString().split('T')[0],
  });
  setQuickEntryResetKey((current) => current + 1);
  toast.success('已记账');
  await Promise.all([
    mutate('transactions'),
    mutate('assets'),
    mutate((key) => typeof key === 'string' && (key.startsWith('budgets') || key.startsWith('forecast'))),
  ]);
} else if (result.error?.includes('会话密钥')) {
  window.location.href = '/login';
} else {
  setError(result.error || '创建失败');
}
```

Keep `setLoading(false)` after the conditional so failures preserve the populated form and successful writes cannot be double-submitted.

- [ ] **Step 7: Run focused tests, lint, and type/build checks**

Run:

```bash
npx tsx --test src/lib/ledger-quick-entry.test.ts src/lib/ledger-agent.test.ts src/components/widgets/LedgerAgentQuickEntry.test.tsx
npm run lint -- src/lib/ledger-quick-entry.ts src/lib/ledger-quick-entry.test.ts src/app/management/ledger/LedgerManager.tsx
npm run build
```

Expected: tests PASS, ESLint exits 0, Next.js production build exits 0 with no missing Suspense boundary or type errors.

- [ ] **Step 8: Record a path-scoped checkpoint without staging user-owned quick-entry files**

Run:

```bash
git diff --check -- src/app/management/ledger/LedgerManager.tsx
if rg -n '[[:blank:]]+$' src/lib/ledger-quick-entry.ts src/lib/ledger-quick-entry.test.ts; then exit 1; fi
git status --short -- src/lib/ledger-quick-entry.ts src/lib/ledger-quick-entry.test.ts src/app/management/ledger/LedgerManager.tsx
```

Expected: no whitespace errors. Do not stage `LedgerAgentQuickEntry.tsx`, `ledger-agent.ts`, their tests, or any pre-existing dirty file.

---

### Task 3: Make Consent Usable on Short Screens and Add a Repeatable Browser Flow Check

**Files:**
- Modify: `src/components/common/LegalConsentGate.tsx:65-115`
- Create: `scripts/check-mobile-ledger-flow.ts`
- Modify: `package.json:5-46`

**Interfaces:**
- Consumes: `http://localhost:3000`, `MOBILE_QA_USERNAME`, `MOBILE_QA_PASSWORD`, mobile navigation selectors, ledger form selectors, and existing review account data.
- Produces: `npm run mobile:flow:check`, screenshots under `MOBILE_QA_OUTPUT_DIR` or `/tmp/elevate-life-mobile-qa`, and automatic cleanup of the temporary transaction.

- [ ] **Step 1: Prove the QA command does not exist yet**

Run:

```bash
npm run mobile:flow:check
```

Expected: FAIL with `Missing script: "mobile:flow:check"`.

- [ ] **Step 2: Make the legal consent dialog scroll-safe**

In `src/components/common/LegalConsentGate.tsx`, change the backdrop style object to include:

```tsx
padding: 'max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom))',
overflowY: 'auto',
```

Remove the old numeric `padding: 20` entry. Change the dialog section style to include:

```tsx
maxHeight: 'calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
overflowY: 'auto',
```

Change the two action buttons to:

```tsx
<button
  type="button"
  className="btn btn-outline min-h-11 flex-1 sm:flex-none"
  onClick={() => setDeclined(true)}
>
  不同意
</button>
<button
  type="button"
  className="btn btn-primary min-h-11 flex-1 sm:flex-none"
  onClick={acceptConsent}
>
  同意并继续
</button>
```

- [ ] **Step 3: Add the package command**

Add to the `scripts` object in `package.json`:

```json
"mobile:flow:check": "npx tsx scripts/check-mobile-ledger-flow.ts"
```

- [ ] **Step 4: Create the Playwright flow checker**

Create `scripts/check-mobile-ledger-flow.ts`:

```ts
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const baseUrl = process.env.MOBILE_QA_BASE_URL || 'http://localhost:3000';
const username = process.env.MOBILE_QA_USERNAME || '';
const password = process.env.MOBILE_QA_PASSWORD || '';
const outputDir = process.env.MOBILE_QA_OUTPUT_DIR || '/tmp/elevate-life-mobile-qa';

if (!username || !password) {
  throw new Error('Set MOBILE_QA_USERNAME and MOBILE_QA_PASSWORD before running mobile:flow:check.');
}

async function settle(page: Page) {
  await page.locator('body').waitFor({ state: 'visible' });
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
}

async function assertNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  assert.ok(
    dimensions.document <= dimensions.viewport + 1,
    `horizontal overflow: document=${dimensions.document}, viewport=${dimensions.viewport}`,
  );
}

async function acceptConsent(page: Page) {
  const dialog = page.getByRole('dialog', { name: '请先阅读并同意' });
  if (await dialog.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: '同意并继续' }).click();
    await dialog.waitFor({ state: 'hidden' });
  }
}

async function login(page: Page) {
  await page.goto(new URL('/login', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
  await settle(page);
  await acceptConsent(page);

  await page.locator('#username').fill('__mobile_invalid__');
  await page.locator('#password').fill('invalid-password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByText(/Invalid credentials|登录失败/).waitFor({ state: 'visible' });

  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/', { timeout: 15000 }),
    page.getByRole('button', { name: 'Sign In' }).click(),
  ]);
  await settle(page);
}

async function assertMobileShell(page: Page) {
  const nav = page.getByRole('navigation', { name: '主要导航' });
  await nav.waitFor({ state: 'visible' });
  assert.equal(await nav.locator('[data-mobile-primary-nav]').count(), 5);
  await page.getByRole('button', { name: '更多功能' }).click();
  const menu = page.getByRole('dialog', { name: '更多功能菜单' });
  await menu.waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'hidden' });
  await assertNoHorizontalOverflow(page);
}

async function removeTransactionIfPresent(page: Page, marker: string) {
  await page.goto(new URL('/management/ledger', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
  await settle(page);
  const row = page.locator('[data-transaction-list="true"] tbody tr').filter({ hasText: marker });
  if (await row.isVisible({ timeout: 5000 }).catch(() => false)) {
    await row.getByRole('button', { name: '删除' }).click();
    await row.waitFor({ state: 'detached' });
  }
}

async function createAndRemoveMobileTransaction(page: Page) {
  const marker = `手机验收-${Date.now()}`;
  try {
    await page.getByRole('link', { name: /记一笔/ }).click();
    await page.waitForURL((url) => url.pathname === '/management/ledger' && url.searchParams.get('focus') === 'create');

    await page.locator('#ledger-agent-input').fill(`今天午饭 32 用现金 ${marker}`);
    await page.getByRole('button', { name: '生成草稿' }).click();

    const form = page.locator('[data-ledger-create-form="true"]');
    await form.waitFor({ state: 'visible' });
    assert.equal(await form.locator('input[name="amount"]').inputValue(), '32');
    assert.match(await form.locator('input[name="description"]').inputValue(), new RegExp(marker));

    await form.getByRole('button', { name: '创建' }).click();
    await page.getByText('已记账').waitFor({ state: 'visible' });

    const row = page.locator('[data-transaction-list="true"] tbody tr').filter({ hasText: marker });
    await row.waitFor({ state: 'visible' });
    await page.screenshot({ path: resolve(outputDir, '360x800-ledger-success.png'), fullPage: false });
  } finally {
    await removeTransactionIfPresent(page, marker);
  }
}

async function screenshotViewport(
  browser: Browser,
  storageState: Awaited<ReturnType<BrowserContext['storageState']>>,
  viewport: { name: string; width: number; height: number },
  browserErrors: string[],
) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: true,
    hasTouch: true,
    locale: 'zh-CN',
    storageState,
  });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`[${viewport.name}] ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`[${viewport.name}] ${error.message}`));
  await page.goto(new URL('/', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
  await settle(page);
  await assertMobileShell(page);
  await page.screenshot({ path: resolve(outputDir, `${viewport.name}.png`), fullPage: false });
  await context.close();
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const browserErrors: string[] = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 360, height: 800 },
      isMobile: true,
      hasTouch: true,
      locale: 'zh-CN',
    });
    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));

    await login(page);
    await assertMobileShell(page);
    await createAndRemoveMobileTransaction(page);
    const storageState = await context.storageState();
    await context.close();

    for (const viewport of [
      { name: '360x640-short', width: 360, height: 640 },
      { name: '412x839-pixel-7', width: 412, height: 839 },
      { name: '360x520-keyboard-pressure', width: 360, height: 520 },
    ]) {
      await screenshotViewport(browser, storageState, viewport, browserErrors);
    }

    assert.deepEqual(browserErrors, []);
    console.log(`Mobile ledger flow passed. Screenshots: ${outputDir}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
```

- [ ] **Step 5: Run the mobile flow against the existing review account**

Ensure port 3000 is running, then run:

```bash
MOBILE_QA_USERNAME=demo \
MOBILE_QA_PASSWORD=demo123 \
npm run mobile:flow:check
```

Expected output:

```text
Mobile ledger flow passed. Screenshots: /tmp/elevate-life-mobile-qa
```

Expected artifacts:

```text
/tmp/elevate-life-mobile-qa/360x800-ledger-success.png
/tmp/elevate-life-mobile-qa/360x640-short.png
/tmp/elevate-life-mobile-qa/412x839-pixel-7.png
/tmp/elevate-life-mobile-qa/360x520-keyboard-pressure.png
```

Expected database state: the temporary `手机验收-*` transaction has been deleted.

- [ ] **Step 6: Run focused tests and lint**

Run:

```bash
npx tsx --test src/lib/login-submit.test.ts src/lib/mobile-navigation.test.ts src/components/layout/MobileNavigation.test.tsx src/lib/ledger-quick-entry.test.ts src/lib/ledger-agent.test.ts src/components/widgets/LedgerAgentQuickEntry.test.tsx
npm run lint -- src/components/common/LegalConsentGate.tsx scripts/check-mobile-ledger-flow.ts
```

Expected: all tests PASS; ESLint exits 0.

- [ ] **Step 7: Record a path-scoped checkpoint**

Run:

```bash
git diff --check -- src/components/common/LegalConsentGate.tsx package.json
if rg -n '[[:blank:]]+$' scripts/check-mobile-ledger-flow.ts; then exit 1; fi
git status --short -- src/components/common/LegalConsentGate.tsx scripts/check-mobile-ledger-flow.ts package.json
```

Expected: no whitespace errors; only the three named paths appear.

---

### Task 4: Final Google Play Size Matrix and Desktop Regression

**Files:**
- Verify: all Task 1-3 paths
- Verify without modifying: `scripts/capture-store-screenshots.ts:11-17`
- Verify without modifying: `docs/superpowers/specs/2026-07-11-mobile-first-ledger-flow-design.md`

**Interfaces:**
- Consumes: `npm run mobile:flow:check`, `npm run screenshots:check`, `npm run build`, and the approved viewport matrix.
- Produces: browser evidence for mobile/desktop, a complete verification log, and an exact path list for user-approved staging.

- [ ] **Step 1: Run the complete focused test set**

Run:

```bash
npx tsx --test \
  src/lib/mobile-navigation.test.ts \
  src/components/layout/MobileNavigation.test.tsx \
  src/lib/ledger-quick-entry.test.ts \
  src/lib/ledger-agent.test.ts \
  src/components/widgets/LedgerAgentQuickEntry.test.tsx \
  src/lib/login-submit.test.ts
```

Expected: all tests PASS.

- [ ] **Step 2: Run lint and the Next.js production build**

Run:

```bash
npm run lint
npm run build
```

Expected: both commands exit 0; the build contains no framework overlay, missing Suspense boundary, type, or route errors.

- [ ] **Step 3: Run the real mobile flow at all approved viewports**

Run:

```bash
MOBILE_QA_USERNAME=demo \
MOBILE_QA_PASSWORD=demo123 \
npm run mobile:flow:check
```

Expected: PASS and four screenshots in `/tmp/elevate-life-mobile-qa`.

- [ ] **Step 4: Verify the existing Google Play screenshot preset**

Run:

```bash
npm run screenshots:check
rg -n "Google Play phone.*cssWidth: 360.*cssHeight: 640.*outputWidth: 1080.*outputHeight: 1920" scripts/capture-store-screenshots.ts
```

Expected: screenshot readiness PASS; `rg` returns the Google Play preset line.

- [ ] **Step 5: Capture the store-sized screenshots**

Run:

```bash
STORE_SCREENSHOT_BASE_URL=http://localhost:3000 \
STORE_SCREENSHOT_USERNAME=demo \
STORE_SCREENSHOT_PASSWORD=demo123 \
npm run screenshots:store
```

Expected: five `google-play-phone-*.png` images under `store-screenshots/`, each `1080 × 1920`.

- [ ] **Step 6: Run a desktop Playwright smoke at 1440 × 900**

Create `/tmp/elevate-life-desktop-smoke.mjs` with the following complete script:

```js
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '/home/kyrie/workspace/elevate-life/node_modules/playwright/index.mjs';

const baseUrl = process.env.MOBILE_QA_BASE_URL || 'http://localhost:3000';
const username = process.env.MOBILE_QA_USERNAME || '';
const password = process.env.MOBILE_QA_PASSWORD || '';
const outputDir = '/tmp/elevate-life-mobile-qa';

if (!username || !password) throw new Error('Missing MOBILE_QA_USERNAME or MOBILE_QA_PASSWORD.');

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(new URL('/login', baseUrl).toString(), { waitUntil: 'domcontentloaded' });

  const consent = page.getByRole('dialog', { name: '请先阅读并同意' });
  if (await consent.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: '同意并继续' }).click();
  }

  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/', { timeout: 15000 }),
    page.getByRole('button', { name: 'Sign In' }).click(),
  ]);

  const result = await page.evaluate(() => {
    function visible(selector) {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element).display !== 'none' : false;
    }
    return {
      sidebarVisible: visible('.app-sidebar'),
      mobileTopbarVisible: visible('.mobile-topbar'),
      mobileBottomNavVisible: visible('.mobile-bottom-nav'),
    };
  });

  assert.deepEqual(result, {
    sidebarVisible: true,
    mobileTopbarVisible: false,
    mobileBottomNavVisible: false,
  });
  await page.screenshot({ path: `${outputDir}/1440x900-desktop.png`, fullPage: false });
  console.log('Desktop smoke passed.');
} finally {
  await browser.close();
}
```

Create this temporary file with `apply_patch`; do not add it to the repository.

Run:

```bash
MOBILE_QA_USERNAME=demo MOBILE_QA_PASSWORD=demo123 node /tmp/elevate-life-desktop-smoke.mjs
```

Expected: exit 0 and a desktop screenshot at `/tmp/elevate-life-mobile-qa/1440x900-desktop.png`.

- [ ] **Step 7: Review only the implementation-owned diff**

Run:

```bash
git diff --check -- \
  src/components/layout/Sidebar.tsx \
  src/app/management/ledger/LedgerManager.tsx \
  src/components/common/LegalConsentGate.tsx \
  package.json
if rg -n '[[:blank:]]+$' \
  src/lib/mobile-navigation.ts \
  src/lib/mobile-navigation.test.ts \
  src/components/layout/MobileNavigation.tsx \
  src/components/layout/MobileNavigation.test.tsx \
  src/lib/ledger-quick-entry.ts \
  src/lib/ledger-quick-entry.test.ts \
  scripts/check-mobile-ledger-flow.ts; then exit 1; fi
git status --short -- \
  src/lib/mobile-navigation.ts \
  src/lib/mobile-navigation.test.ts \
  src/components/layout/MobileNavigation.tsx \
  src/components/layout/MobileNavigation.test.tsx \
  src/components/layout/Sidebar.tsx \
  src/lib/ledger-quick-entry.ts \
  src/lib/ledger-quick-entry.test.ts \
  src/app/management/ledger/LedgerManager.tsx \
  src/components/common/LegalConsentGate.tsx \
  scripts/check-mobile-ledger-flow.ts \
  package.json
```

Expected: no whitespace errors. Present this exact path list and the preserved pre-existing dirty paths to the user before staging or committing implementation work.

## Execution Completion Criteria

- `360 × 800` 完整记账闭环通过。
- `360 × 640`、`412 × 839` 和 `360 × 520` 无页面级横向溢出，五项导航可用。
- 协议弹层在短屏可滚动，两枚按钮都可触达。
- 创建成功后显示“已记账”，SWR 更新后新流水出现，QA 流水随后被删除。
- `1080 × 1920` Google Play 截图可以由现有脚本生成。
- `1440 × 900` 桌面侧边栏仍显示，手机顶栏/底栏隐藏。
- focused tests、全量 lint、Next.js production build、Playwright flow 全部通过。
- 未修改 Capacitor、Android、iOS、Prisma 或 API 边界；未覆盖或提交用户原有脏文件。
