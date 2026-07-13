# Category-First Quick Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在手机端 `/management/ledger?focus=create` 落地分类优先的单屏快速记账，沿用现有流水写入、预算、账户、自然语言解析和桌面表单，并让常见支出可在约 3 秒内完成。

**Architecture:** 保持单一 Next.js App Router 应用和现有 `createTransaction` Server Action。新增独立的手机快速记账 Client Component 与纯逻辑模块；`LedgerManager` 只负责提供分类/账户数据、调用写入、预算反馈、登录失效处理和 SWR 刷新。起始分类通过共享 preset、审核账号 seed 和一次性 backfill 对齐，不在页面读取时反复补齐，避免用户删除或重命名后又被自动创建。

**Tech Stack:** Next.js 16.2.6 App Router、React 19.2.4、TypeScript 5、Tailwind CSS 4、SWR 2.4.1、Prisma 7.8/PostgreSQL、lucide-react、Node test runner、tsx、Playwright 1.61.0。

## Global Constraints

- 唯一开发地址：`http://localhost:3000`。
- 手机快速入口只在 `< 768px` 且查询参数为 `focus=create` 时显示。
- `< 768px` 普通流水页只显示流水内容，不显示完整创建表单；`>= 768px` 保持现有完整表单。
- 支出起始顺序：`餐饮、房租、交通、医疗、固定支出、日用、提升品质、旅行、人情往来`。
- 收入起始顺序：`工资、理财收益、人情往来`。
- 首屏最多显示 7 个分类，第 8 项固定为“更多”；收入分类不足 7 项时按实际数量显示。
- `人情往来` 的收入与支出记录按 `type + name` 区分。
- 不修改 Prisma schema、认证协议或 `createTransaction` 返回协议；不新增第二条流水写入路径。
- 自定义金额键盘支持 `0–9`、`00`、小数点、退格、`+`、`−`；金额最多两位小数，最终结果必须大于 0。
- 所有触控目标至少 `44 × 44px`；必须支持 `360×640`、`360×800`、`390×844`、`412×839`、`360×520`，并回归桌面 `1440×900`。
- 使用现有主题 token 和 Tailwind 类，不复制竞品黄色主题，不在 `src/app/globals.css` 中扩大当前用户改动。
- 图标使用 `lucide-react`；未知分类回退 `Tags`，不使用 emoji、手写 SVG 或 CSS 图形。
- 不修改、回退或重新提交当前工作区其他暂存改动。禁止 `git add .`、`git add -A`、`git commit -a`；每个任务只提交该任务列出的路径。
- 写代码前已核对仓库内 Next.js 16 文档：Client Component 可从 `'use server'` 文件调用异步 Server Action；所有 Server Action 继续自行校验认证。

---

## File Structure

### Create

- `src/lib/ledger-category-presets.ts`：起始分类、复合键和缺失分类计算。
- `src/lib/ledger-category-presets.test.ts`：分类顺序、同名异类和幂等缺项测试。
- `scripts/backfill-ledger-categories.ts`：为现有用户一次性、可重复地补齐缺失分类。
- `src/components/ledger/FrequentCategoryGrid.tsx`：分类图标、首屏 7 项和“更多”入口。
- `src/components/ledger/FrequentCategoryGrid.test.tsx`：分类结构、图标回退和触控目标测试。
- `src/components/ledger/AmountKeypad.tsx`：金额表达式显示和触控键盘。
- `src/components/ledger/AmountKeypad.test.tsx`：键盘结构与可访问性测试。
- `src/components/ledger/QuickEntryMoreSheet.tsx`：分类全集和低频字段共用的底部面板外壳。
- `src/components/ledger/QuickEntryMoreSheet.test.tsx`：dialog、关闭按钮和触控目标测试。
- `src/components/ledger/MobileQuickEntry.tsx`：分类优先快速记账容器、默认值、预算、提交和自然语言模式。
- `src/components/ledger/MobileQuickEntry.test.tsx`：手机首屏、类型切换和隐藏字段结构测试。

### Modify

- `prisma/seed.ts`：复用起始分类并用 `type:name` 查找分类。
- `package.json`、`package-lock.json`：安装 `lucide-react`，增加分类 backfill 命令。
- `src/lib/ledger-quick-entry.ts`、`src/lib/ledger-quick-entry.test.ts`：金额表达式、分类分组、偏好恢复和反馈文案。
- `src/app/management/ledger/LedgerManager.tsx`：接入手机组件、预算反馈、正确提交 `budgetId`、隐藏手机完整表单。
- `src/lib/mobile-navigation.ts`、`src/lib/mobile-navigation.test.ts`：让 active 判定接收 `focus`。
- `src/components/layout/MobileNavigation.tsx`、`src/components/layout/MobileNavigation.test.tsx`：读取查询参数并正确选中“记一笔”。
- `scripts/check-mobile-ledger-flow.ts`：分类按钮 → 金额键盘 → 确认记账的真实回归和截图。

### Explicitly Do Not Modify

- `prisma/schema.prisma`：规格不允许 schema 变化。
- `src/lib/actions/ledger.ts`：现有 `createTransaction` 已支持全部字段，成功后预算信息由 `getBudgetProgress` 查询。
- `src/app/globals.css`：当前已有用户暂存改动，新 UI 使用局部 Tailwind。
- `src/app/layout.tsx`：现有 viewport 与 safe-area metadata 已满足要求。

---

### Task 1: Establish the Approved Category Presets and One-Time Backfill

**Files:**
- Create: `src/lib/ledger-category-presets.ts`
- Create: `src/lib/ledger-category-presets.test.ts`
- Create: `scripts/backfill-ledger-categories.ts`
- Modify: `prisma/seed.ts:55-71,119-211`
- Modify: `package.json:scripts`

**Interfaces:**
- Produces: `LedgerCategoryType`, `LedgerCategoryPreset`, `LEDGER_CATEGORY_PRESETS`, `QUICK_ENTRY_CATEGORY_ORDER`, `ledgerCategoryKey(type, name)`, `findMissingLedgerCategoryPresets(existing)`.
- Consumers: Task 2 classification logic, `prisma/seed.ts`, and the one-time backfill script.

- [ ] **Step 1: Write the failing preset tests**

Create `src/lib/ledger-category-presets.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LEDGER_CATEGORY_PRESETS,
  QUICK_ENTRY_CATEGORY_ORDER,
  findMissingLedgerCategoryPresets,
  ledgerCategoryKey,
} from './ledger-category-presets';

test('starter categories use the approved expense and income order', () => {
  assert.deepEqual(QUICK_ENTRY_CATEGORY_ORDER.EXPENSE, [
    '餐饮', '房租', '交通', '医疗', '固定支出', '日用', '提升品质', '旅行', '人情往来',
  ]);
  assert.deepEqual(QUICK_ENTRY_CATEGORY_ORDER.INCOME, ['工资', '理财收益', '人情往来']);
});

test('income and expense 人情往来 are separate starter records', () => {
  const social = LEDGER_CATEGORY_PRESETS.filter((item) => item.name === '人情往来');
  assert.deepEqual(social.map((item) => item.type).sort(), ['EXPENSE', 'INCOME']);
  assert.notEqual(ledgerCategoryKey('EXPENSE', '人情往来'), ledgerCategoryKey('INCOME', '人情往来'));
});

test('missing calculation is idempotent for an already complete account', () => {
  const complete = LEDGER_CATEGORY_PRESETS.map(({ name, type }) => ({ name, type }));
  assert.deepEqual(findMissingLedgerCategoryPresets(complete), []);
});

test('missing calculation adds only absent name and type combinations', () => {
  const existing = LEDGER_CATEGORY_PRESETS
    .filter((item) => !(item.name === '日用' && item.type === 'EXPENSE'))
    .filter((item) => !(item.name === '人情往来' && item.type === 'INCOME'));
  assert.deepEqual(
    findMissingLedgerCategoryPresets(existing)
      .map((item) => ledgerCategoryKey(item.type, item.name))
      .sort(),
    ['EXPENSE:日用', 'INCOME:人情往来'],
  );
});
```

- [ ] **Step 2: Run the test and verify the module is missing**

Run:

```bash
npx tsx --test src/lib/ledger-category-presets.test.ts
```

Expected: FAIL with `Cannot find module './ledger-category-presets'`.

- [ ] **Step 3: Implement the shared preset module**

Create `src/lib/ledger-category-presets.ts`:

```ts
export type LedgerCategoryType = 'EXPENSE' | 'INCOME';

export type LedgerCategoryPreset = {
  name: string;
  type: LedgerCategoryType;
  icon: string;
  color: string;
  isEssential?: boolean;
};

export const QUICK_ENTRY_CATEGORY_ORDER: Record<LedgerCategoryType, readonly string[]> = {
  EXPENSE: ['餐饮', '房租', '交通', '医疗', '固定支出', '日用', '提升品质', '旅行', '人情往来'],
  INCOME: ['工资', '理财收益', '人情往来'],
};

export const LEDGER_CATEGORY_PRESETS: readonly LedgerCategoryPreset[] = [
  { name: '工资', type: 'INCOME', icon: '薪', color: '#10b981' },
  { name: '理财收益', type: 'INCOME', icon: '收', color: '#14b8a6' },
  { name: '人情往来', type: 'INCOME', icon: '礼', color: '#ec4899' },
  { name: '餐饮', type: 'EXPENSE', icon: '餐', color: '#ef4444', isEssential: true },
  { name: '房租', type: 'EXPENSE', icon: '住', color: '#f59e0b', isEssential: true },
  { name: '交通', type: 'EXPENSE', icon: '行', color: '#3b82f6' },
  { name: '医疗', type: 'EXPENSE', icon: '医', color: '#ef4444' },
  { name: '固定支出', type: 'EXPENSE', icon: '固', color: '#f59e0b', isEssential: true },
  { name: '日用', type: 'EXPENSE', icon: '用', color: '#64748b' },
  { name: '提升品质', type: 'EXPENSE', icon: '品', color: '#8b5cf6' },
  { name: '旅行', type: 'EXPENSE', icon: '旅', color: '#06b6d4' },
  { name: '人情往来', type: 'EXPENSE', icon: '礼', color: '#ec4899' },
];

export function ledgerCategoryKey(type: string, name: string) {
  return `${type}:${name}`;
}

export function findMissingLedgerCategoryPresets(
  existing: ReadonlyArray<{ name: string; type: string }>,
) {
  const existingKeys = new Set(existing.map((item) => ledgerCategoryKey(item.type, item.name)));
  return LEDGER_CATEGORY_PRESETS.filter(
    (item) => !existingKeys.has(ledgerCategoryKey(item.type, item.name)),
  );
}
```

- [ ] **Step 4: Run preset tests**

Run:

```bash
npx tsx --test src/lib/ledger-category-presets.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Reuse presets in the demo seed without ambiguous name lookup**

In `prisma/seed.ts`, import the preset module and replace the inline category array:

```ts
import { LEDGER_CATEGORY_PRESETS, ledgerCategoryKey } from '../src/lib/ledger-category-presets';

await prisma.category.createMany({
  data: LEDGER_CATEGORY_PRESETS.map((category) => ({ ...category, userId: user.id })),
});

const categoryList = await prisma.category.findMany({ where: { userId: user.id } });
const categoryByKey = new Map(
  categoryList.map((category) => [ledgerCategoryKey(category.type, category.name), category.id]),
);
```

Replace every seed lookup with its explicit type, for example:

```ts
categoryId: categoryByKey.get(ledgerCategoryKey('EXPENSE', '餐饮')),
categoryId: categoryByKey.get(ledgerCategoryKey('EXPENSE', '交通')),
categoryId: categoryByKey.get(ledgerCategoryKey('EXPENSE', '固定支出')),
categoryId: categoryByKey.get(ledgerCategoryKey('INCOME', '工资')),
categoryId: categoryByKey.get(ledgerCategoryKey('INCOME', '理财收益')),
categoryId: categoryByKey.get(ledgerCategoryKey('EXPENSE', '提升品质')),
```

- [ ] **Step 6: Add an idempotent, sequential backfill for existing users**

Create `scripts/backfill-ledger-categories.ts`:

```ts
import { loadEnvConfig } from '@next/env';
import { findMissingLedgerCategoryPresets } from '../src/lib/ledger-category-presets';

let prismaClient: Awaited<typeof import('../src/lib/prisma')>['prisma'] | undefined;

async function main() {
  loadEnvConfig(process.cwd());
  const { prisma } = await import('../src/lib/prisma');
  prismaClient = prisma;
  const users = await prisma.user.findMany({ select: { id: true, username: true } });
  let created = 0;

  for (const user of users) {
    const existing = await prisma.category.findMany({
      where: { userId: user.id },
      select: { name: true, type: true },
    });
    const missing = findMissingLedgerCategoryPresets(existing);
    if (missing.length === 0) continue;

    const result = await prisma.category.createMany({
      data: missing.map((category) => ({ ...category, userId: user.id })),
    });
    created += result.count;
    console.log(`${user.username || user.id}: added ${result.count} ledger categories`);
  }

  console.log(`Ledger category backfill complete: ${created} categories added.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prismaClient?.$disconnect());
```

Add to `package.json`:

```json
"ledger:categories:backfill": "npx tsx scripts/backfill-ledger-categories.ts"
```

Run twice against the scoped local test database:

```bash
npm run ledger:categories:backfill
npm run ledger:categories:backfill
```

Expected: first run adds only missing combinations; second run ends with `0 categories added`.

- [ ] **Step 7: Commit Task 1 only**

```bash
git add src/lib/ledger-category-presets.ts src/lib/ledger-category-presets.test.ts scripts/backfill-ledger-categories.ts prisma/seed.ts package.json
git commit -m "feat: align ledger starter categories"
```

---

### Task 2: Add Pure Quick-Entry State and Amount Logic

**Files:**
- Modify: `src/lib/ledger-quick-entry.ts`
- Modify: `src/lib/ledger-quick-entry.test.ts`

**Interfaces:**
- Consumes: `QUICK_ENTRY_CATEGORY_ORDER` from Task 1.
- Produces: `QuickEntryCategory`, `QuickEntryType`, `partitionQuickEntryCategories`, `applyAmountKey`, `evaluateAmountExpression`, `parseQuickEntryPreferences`, `serializeQuickEntryPreferences`, and `buildQuickEntryFeedback`.

- [ ] **Step 1: Add failing tests for classification, amount, preferences, and feedback**

Append to `src/lib/ledger-quick-entry.test.ts`:

```ts
import {
  applyAmountKey,
  buildQuickEntryFeedback,
  evaluateAmountExpression,
  parseQuickEntryPreferences,
  partitionQuickEntryCategories,
  serializeQuickEntryPreferences,
} from './ledger-quick-entry';

test('expense categories use approved order and reserve the eighth cell for 更多', () => {
  const categories = [
    ['extra', '其他', 'EXPENSE'], ['social-in', '人情往来', 'INCOME'],
    ['travel', '旅行', 'EXPENSE'], ['quality', '提升品质', 'EXPENSE'],
    ['daily', '日用', 'EXPENSE'], ['fixed', '固定支出', 'EXPENSE'],
    ['medical', '医疗', 'EXPENSE'], ['transit', '交通', 'EXPENSE'],
    ['rent', '房租', 'EXPENSE'], ['food', '餐饮', 'EXPENSE'],
    ['social-out', '人情往来', 'EXPENSE'],
  ].map(([id, name, type]) => ({ id, name, type }));
  const result = partitionQuickEntryCategories(categories, 'EXPENSE');
  assert.deepEqual(result.primary.map((item) => item.name), [
    '餐饮', '房租', '交通', '医疗', '固定支出', '日用', '提升品质',
  ]);
  assert.deepEqual(result.all.map((item) => item.name), [
    '餐饮', '房租', '交通', '医疗', '固定支出', '日用', '提升品质', '旅行', '人情往来', '其他',
  ]);
});

test('income 人情往来 never resolves to the expense record', () => {
  const result = partitionQuickEntryCategories([
    { id: 'expense-social', name: '人情往来', type: 'EXPENSE' },
    { id: 'income-social', name: '人情往来', type: 'INCOME' },
    { id: 'salary', name: '工资', type: 'INCOME' },
  ], 'INCOME');
  assert.deepEqual(result.primary.map((item) => item.id), ['salary', 'income-social']);
});

test('amount keypad evaluates simple addition and subtraction without eval', () => {
  let expression = '';
  for (const key of ['2', '8', '+', '6', '-', '4'] as const) expression = applyAmountKey(expression, key);
  assert.deepEqual(evaluateAmountExpression(expression), { valid: true, amount: '30', result: 30 });
});

test('amount keypad blocks a third decimal and rejects zero or trailing operators', () => {
  assert.equal(applyAmountKey('12.34', '5'), '12.34');
  assert.equal(evaluateAmountExpression('0').valid, false);
  assert.equal(evaluateAmountExpression('12+').valid, false);
});

test('quick-entry preferences tolerate invalid storage and round trip valid values', () => {
  assert.deepEqual(parseQuickEntryPreferences('{bad'), { categoryByType: {}, accountByType: {} });
  const preferences = {
    categoryByType: { EXPENSE: 'food', INCOME: 'salary' },
    accountByType: { EXPENSE: 'cash', INCOME: 'bank' },
  };
  assert.deepEqual(parseQuickEntryPreferences(serializeQuickEntryPreferences(preferences)), preferences);
});

test('feedback includes budget remaining only when available', () => {
  assert.equal(buildQuickEntryFeedback({ amount: '32', currency: 'CNY', categoryName: '餐饮' }), '已记 ¥32 · 餐饮');
  assert.equal(
    buildQuickEntryFeedback({ amount: '32', currency: 'CNY', categoryName: '餐饮', budgetRemaining: 568 }),
    '已记 ¥32 · 餐饮预算还剩 ¥568',
  );
});
```

- [ ] **Step 2: Run the focused tests and verify missing exports**

Run:

```bash
npx tsx --test src/lib/ledger-quick-entry.test.ts
```

Expected: FAIL because the new helpers are not exported.

- [ ] **Step 3: Implement the pure helpers**

Append the following exported model to `src/lib/ledger-quick-entry.ts`; retain the existing draft mapping, cache refresh, and loading helpers:

```ts
import { QUICK_ENTRY_CATEGORY_ORDER } from '@/lib/ledger-category-presets';

export type QuickEntryType = 'EXPENSE' | 'INCOME' | 'TRANSFER';
export type QuickEntryCategory = { id: string; name: string; type?: string | null };
export type AmountKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '00' | '.' | '+' | '-' | 'backspace';

export type QuickEntryPreferences = {
  categoryByType: Partial<Record<'EXPENSE' | 'INCOME', string>>;
  accountByType: Partial<Record<'EXPENSE' | 'INCOME', string>>;
};

export const QUICK_ENTRY_PREFERENCES_KEY = 'ledger-mobile-quick-entry-preferences-v1';

export function partitionQuickEntryCategories(
  categories: QuickEntryCategory[],
  type: 'EXPENSE' | 'INCOME',
) {
  const filtered = categories.filter((category) => category.type === type);
  const rank = new Map(QUICK_ENTRY_CATEGORY_ORDER[type].map((name, index) => [name, index]));
  const all = [...filtered].sort((left, right) => {
    const leftRank = rank.get(left.name) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rank.get(right.name) ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank || left.name.localeCompare(right.name, 'zh-CN');
  });
  return { primary: all.slice(0, 7), all };
}

function currentOperand(expression: string) {
  return expression.split(/[+-]/).at(-1) ?? '';
}

export function applyAmountKey(expression: string, key: AmountKey) {
  if (key === 'backspace') return expression.slice(0, -1);
  if (key === '+' || key === '-') {
    if (!expression) return expression;
    if (/[+-]$/.test(expression)) return `${expression.slice(0, -1)}${key}`;
    if (!/^\d+(?:\.\d{0,2})?(?:[+-]\d+(?:\.\d{0,2})?)*$/.test(expression)) return expression;
    return `${expression}${key}`;
  }

  const operand = currentOperand(expression);
  if (key === '.') {
    if (operand.includes('.')) return expression;
    return `${expression}${operand ? '' : '0'}.`;
  }
  const decimal = operand.split('.')[1];
  if (decimal !== undefined && decimal.length + key.length > 2) return expression;
  if (operand === '0' && !operand.includes('.') && key !== '00') {
    return `${expression.slice(0, -1)}${key}`;
  }
  return `${expression}${key}`;
}

export function evaluateAmountExpression(expression: string) {
  if (!/^\d+(?:\.\d{1,2})?(?:[+-]\d+(?:\.\d{1,2})?)*$/.test(expression)) {
    return { valid: false, amount: '', result: 0 };
  }
  const tokens = expression.match(/\d+(?:\.\d{1,2})?|[+-]/g) ?? [];
  let result = Number(tokens[0]);
  for (let index = 1; index < tokens.length; index += 2) {
    const value = Number(tokens[index + 1]);
    result = tokens[index] === '+' ? result + value : result - value;
  }
  result = Math.round((result + Number.EPSILON) * 100) / 100;
  const amount = result.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  return { valid: Number.isFinite(result) && result > 0, amount, result };
}

const emptyPreferences: QuickEntryPreferences = { categoryByType: {}, accountByType: {} };

export function parseQuickEntryPreferences(raw: string | null): QuickEntryPreferences {
  if (!raw) return emptyPreferences;
  try {
    const parsed = JSON.parse(raw);
    return {
      categoryByType: parsed?.categoryByType && typeof parsed.categoryByType === 'object' ? parsed.categoryByType : {},
      accountByType: parsed?.accountByType && typeof parsed.accountByType === 'object' ? parsed.accountByType : {},
    };
  } catch {
    return emptyPreferences;
  }
}

export function serializeQuickEntryPreferences(preferences: QuickEntryPreferences) {
  return JSON.stringify(preferences);
}

const currencySymbol: Record<string, string> = { CNY: '¥', USD: '$', HKD: 'HK$', JPY: 'JP¥' };

export function buildQuickEntryFeedback(input: {
  amount: string;
  currency: string;
  categoryName: string;
  budgetRemaining?: number;
}) {
  const symbol = currencySymbol[input.currency] ?? input.currency;
  const base = `已记 ${symbol}${input.amount} · ${input.categoryName}`;
  return input.budgetRemaining === undefined
    ? base
    : `${base}预算还剩 ${symbol}${Math.round(input.budgetRemaining * 100) / 100}`;
}
```

- [ ] **Step 4: Run quick-entry and parser regression tests**

```bash
npx tsx --test src/lib/ledger-quick-entry.test.ts src/lib/ledger-agent.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit Task 2 only**

```bash
git add src/lib/ledger-quick-entry.ts src/lib/ledger-quick-entry.test.ts
git commit -m "feat: add mobile quick entry logic"
```

---

### Task 3: Build the Category Grid, Amount Keypad, and Accessible Sheet

**Files:**
- Create: `src/components/ledger/FrequentCategoryGrid.tsx`
- Create: `src/components/ledger/FrequentCategoryGrid.test.tsx`
- Create: `src/components/ledger/AmountKeypad.tsx`
- Create: `src/components/ledger/AmountKeypad.test.tsx`
- Create: `src/components/ledger/QuickEntryMoreSheet.tsx`
- Create: `src/components/ledger/QuickEntryMoreSheet.test.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `QuickEntryCategory`, `QuickEntryType`, `AmountKey`, `partitionQuickEntryCategories`.
- Produces: `CategoryIcon`, `FrequentCategoryGrid`, `AmountKeypad`, and `QuickEntryMoreSheet`.

- [ ] **Step 1: Install the approved icon library**

```bash
npm install lucide-react
```

Expected: `lucide-react` appears in `package.json` and the exact resolved version appears in `package-lock.json`.

- [ ] **Step 2: Write failing static component tests**

Create the three `.test.tsx` files with these assertions:

```tsx
// FrequentCategoryGrid.test.tsx
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import FrequentCategoryGrid from './FrequentCategoryGrid';

test('category grid renders seven categories plus 更多 with 44px targets', () => {
  const categories = ['餐饮', '房租', '交通', '医疗', '固定支出', '日用', '提升品质', '旅行']
    .map((name, index) => ({ id: String(index), name, type: 'EXPENSE' }));
  const markup = renderToString(
    <FrequentCategoryGrid categories={categories} type="EXPENSE" selectedId="0" onSelect={() => {}} onMore={() => {}} />,
  );
  assert.equal((markup.match(/data-quick-category=/g) ?? []).length, 7);
  assert.match(markup, /aria-pressed="true"/);
  assert.match(markup, /aria-label="更多分类"/);
  assert.equal((markup.match(/min-h-11/g) ?? []).length, 8);
});

// AmountKeypad.test.tsx
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import AmountKeypad from './AmountKeypad';

test('amount keypad exposes every approved key as a touch target', () => {
  const markup = renderToString(<AmountKeypad onKey={() => {}} />);
  for (const label of ['0', '00', '小数点', '加', '减', '退格']) assert.match(markup, new RegExp(`aria-label="${label}"`));
  assert.equal((markup.match(/data-amount-key=/g) ?? []).length, 15);
  assert.equal((markup.match(/min-h-11/g) ?? []).length, 15);
});

// QuickEntryMoreSheet.test.tsx
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import QuickEntryMoreSheet from './QuickEntryMoreSheet';

test('open sheet has modal semantics and an accessible close control', () => {
  const markup = renderToString(
    <QuickEntryMoreSheet open title="更多记账选项" onClose={() => {}}><button>内容</button></QuickEntryMoreSheet>,
  );
  assert.match(markup, /role="dialog"/);
  assert.match(markup, /aria-modal="true"/);
  assert.match(markup, /aria-label="关闭更多记账选项"/);
  assert.match(markup, /min-h-11/);
});
```

- [ ] **Step 3: Verify tests fail because the components are missing**

```bash
npx tsx --test \
  src/components/ledger/FrequentCategoryGrid.test.tsx \
  src/components/ledger/AmountKeypad.test.tsx \
  src/components/ledger/QuickEntryMoreSheet.test.tsx
```

Expected: FAIL with missing component modules.

- [ ] **Step 4: Implement the category grid with Lucide icons**

Create `src/components/ledger/FrequentCategoryGrid.tsx` with this public mapping and structure:

```tsx
'use client';

import type { ComponentType } from 'react';
import {
  Bus, ChartNoAxesCombined, CircleEllipsis, Gift, HeartPulse, House,
  Plane, ReceiptText, ShoppingBasket, Sparkles, Tags, Utensils, WalletCards,
} from 'lucide-react';
import { partitionQuickEntryCategories, type QuickEntryCategory } from '@/lib/ledger-quick-entry';

const categoryIcons: Record<string, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  餐饮: Utensils, 房租: House, 交通: Bus, 医疗: HeartPulse, 固定支出: ReceiptText,
  日用: ShoppingBasket, 提升品质: Sparkles, 旅行: Plane, 人情往来: Gift,
  工资: WalletCards, 理财收益: ChartNoAxesCombined,
};

export function CategoryIcon({ name, size = 24 }: { name: string; size?: number }) {
  const Icon = categoryIcons[name] ?? Tags;
  return <Icon size={size} strokeWidth={1.8} aria-hidden />;
}

export default function FrequentCategoryGrid({ categories, type, selectedId, onSelect, onMore }: {
  categories: QuickEntryCategory[];
  type: 'EXPENSE' | 'INCOME';
  selectedId: string;
  onSelect: (id: string) => void;
  onMore: () => void;
}) {
  const { primary } = partitionQuickEntryCategories(categories, type);
  return (
    <div className="grid grid-cols-4 gap-2" aria-label="常用分类">
      {primary.map((category) => (
        <button key={category.id} type="button" data-quick-category={category.name}
          aria-pressed={selectedId === category.id} onClick={() => onSelect(category.id)}
          className="flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-[var(--border-tertiary)] bg-[var(--color-container)] px-1 py-2 text-xs text-[var(--color-text-primary)] aria-pressed:border-[var(--color-accent)] aria-pressed:bg-[var(--color-sidebar-active-bg)]">
          <CategoryIcon name={category.name} /><span className="w-full truncate">{category.name}</span>
        </button>
      ))}
      <button type="button" aria-label="更多分类" onClick={onMore}
        className="flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-[var(--border-tertiary)] bg-[var(--color-container)] px-1 py-2 text-xs text-[var(--color-text-secondary)]">
        <CircleEllipsis size={24} strokeWidth={1.8} aria-hidden /><span>更多</span>
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Implement the amount keypad**

Create `src/components/ledger/AmountKeypad.tsx`:

```tsx
'use client';
import { Delete } from 'lucide-react';
import type { AmountKey } from '@/lib/ledger-quick-entry';

const keys: Array<{ key: AmountKey; label: string; aria: string }> = [
  { key: '1', label: '1', aria: '1' }, { key: '2', label: '2', aria: '2' }, { key: '3', label: '3', aria: '3' },
  { key: '+', label: '+', aria: '加' }, { key: 'backspace', label: '', aria: '退格' },
  { key: '4', label: '4', aria: '4' }, { key: '5', label: '5', aria: '5' }, { key: '6', label: '6', aria: '6' },
  { key: '-', label: '−', aria: '减' }, { key: '.', label: '.', aria: '小数点' },
  { key: '7', label: '7', aria: '7' }, { key: '8', label: '8', aria: '8' }, { key: '9', label: '9', aria: '9' },
  { key: '0', label: '0', aria: '0' }, { key: '00', label: '00', aria: '00' },
];

export default function AmountKeypad({ onKey }: { onKey: (key: AmountKey) => void }) {
  return (
    <div className="grid grid-cols-5 gap-2" aria-label="金额键盘">
      {keys.map((item) => (
        <button key={item.key} type="button" data-amount-key={item.key} aria-label={item.aria}
          onClick={() => onKey(item.key)}
          className="min-h-11 rounded-xl border border-[var(--border-tertiary)] bg-[var(--color-container)] text-lg font-semibold text-[var(--color-text-primary)] active:scale-95">
          {item.key === 'backspace' ? <Delete className="mx-auto" size={20} aria-hidden /> : item.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Implement an accessible reusable bottom sheet**

Create `src/components/ledger/QuickEntryMoreSheet.tsx` as a Client Component. Mirror the existing `MobileNavigationView` focus containment: remember `document.activeElement` when opening, focus the panel after opening, close on Escape/backdrop, keep Tab inside the dialog, and restore focus to the remembered element after closing. The rendered shell must be:

```tsx
<>
  <button type="button" className="fixed inset-0 z-[90] border-0 bg-black/45 md:hidden" aria-label={`关闭${title}`} onClick={onClose} />
  <section ref={panelRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
    className="fixed inset-x-0 bottom-0 z-[100] max-h-[82dvh] overflow-y-auto rounded-t-2xl border border-[var(--color-border)] bg-[var(--color-container)] p-4 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-xl md:hidden">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-bold text-[var(--color-text-primary)]">{title}</h2>
      <button type="button" aria-label={`关闭${title}`} onClick={onClose}
        className="min-h-11 min-w-11 rounded-lg border border-[var(--border-tertiary)]">关闭</button>
    </div>
    {children}
  </section>
</>
```

When `open` is false, return `null`.

- [ ] **Step 7: Run components tests and lint**

```bash
npx tsx --test src/components/ledger/*.test.tsx
npm run lint -- src/components/ledger
```

Expected: component tests PASS and ESLint reports no errors.

- [ ] **Step 8: Commit Task 3 only**

```bash
git add package.json package-lock.json src/components/ledger/FrequentCategoryGrid.tsx src/components/ledger/FrequentCategoryGrid.test.tsx src/components/ledger/AmountKeypad.tsx src/components/ledger/AmountKeypad.test.tsx src/components/ledger/QuickEntryMoreSheet.tsx src/components/ledger/QuickEntryMoreSheet.test.tsx
git commit -m "feat: add quick entry controls"
```

---

### Task 4: Build the Mobile Quick Entry Container and Natural-Language Mode

**Files:**
- Create: `src/components/ledger/MobileQuickEntry.tsx`
- Create: `src/components/ledger/MobileQuickEntry.test.tsx`
- Modify: `src/components/widgets/LedgerAgentQuickEntry.tsx`
- Modify: `src/components/widgets/LedgerAgentQuickEntry.test.tsx`

**Interfaces:**
- Consumes: Task 2 helpers, Task 3 controls, existing `buildLedgerAgentDraft` and `buildLedgerCreateFormValues`.
- Produces: `QuickEntrySubmitValues`, `QuickEntrySubmitResult`, and default `MobileQuickEntry`.
- Parent callbacks: `loadBudgets(date, categoryId): Promise<QuickEntryBudgetOption[]>`, `onSubmit(values): Promise<QuickEntrySubmitResult>`, and `onSaveTemplate(name, values): void`.

- [ ] **Step 1: Write the failing container test**

Create `src/components/ledger/MobileQuickEntry.test.tsx`:

```tsx
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import MobileQuickEntry from './MobileQuickEntry';

const categories = [
  { id: 'food', name: '餐饮', type: 'EXPENSE' },
  { id: 'daily', name: '日用', type: 'EXPENSE' },
  { id: 'salary', name: '工资', type: 'INCOME' },
  { id: 'social-in', name: '人情往来', type: 'INCOME' },
];

test('mobile quick entry renders the approved single-screen hierarchy', () => {
  const markup = renderToString(
    <MobileQuickEntry categories={categories} assets={[{ id: 'cash', name: '现金' }]}
      loadBudgets={async () => []}
      onSubmit={async () => ({ success: true, feedback: '已记 ¥32 · 餐饮' })}
      onSaveTemplate={() => {}} />,
  );
  assert.match(markup, /data-mobile-quick-entry="true"/);
  assert.match(markup, /<h1[^>]*>记一笔<\/h1>/);
  assert.match(markup, /aria-label="交易类型"/);
  assert.match(markup, /aria-label="常用分类"/);
  assert.match(markup, /aria-label="金额键盘"/);
  assert.match(markup, />确认记账<\/button>/);
  assert.match(markup, />说一句记账<\/button>/);
  assert.match(markup, />更多选项<\/button>/);
});
```

- [ ] **Step 2: Run the test and verify the component is missing**

```bash
npx tsx --test src/components/ledger/MobileQuickEntry.test.tsx
```

Expected: FAIL with a missing module error.

- [ ] **Step 3: Make the natural-language widget embeddable without copying its parser**

Add optional props to `LedgerAgentQuickEntry`:

```ts
type LedgerAgentQuickEntryProps = {
  categories: Array<{ id: string; name: string; type?: string | null }>;
  assets: Array<{ id: string; name: string }>;
  onApply: (draft: LedgerAgentDraft) => void;
  examples?: string[];
  title?: string;
  actionLabel?: string;
  embedded?: boolean;
};
```

Default `title="Agent 记一笔"`, `actionLabel="生成草稿"`, `embedded=false`; use `title` and `actionLabel` in the existing markup. When embedded, omit the outer bottom margin while preserving the input, original text on failure, concrete error message, example buttons and 44px targets. Add a test rendering `title="说一句记账" actionLabel="识别并填入" embedded` and assert both strings appear.

- [ ] **Step 4: Implement the container state and submission contract**

Create `src/components/ledger/MobileQuickEntry.tsx` with these exported contracts:

```ts
export type QuickEntrySubmitValues = {
  type: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  amount: string;
  currency: string;
  categoryId: string;
  budgetId: string;
  fromAccountId: string;
  toAccountId: string;
  description: string;
  occurredAt: string;
};

export type QuickEntrySubmitResult =
  | { success: true; feedback: string }
  | { success: false; error: string; sessionExpired?: boolean };

export type QuickEntryBudgetOption = { id: string; name: string };
```

The component must implement the following exact state flow:

1. Default type is `EXPENSE`, date is local today, currency is `CNY`.
2. After hydration, read `QUICK_ENTRY_PREFERENCES_KEY`; accept the remembered category/account only if it still exists for the selected type.
3. Without a valid remembered category, select the first item from `partitionQuickEntryCategories(categories, type).primary`.
4. For expense, the account shortcut writes `fromAccountId`; for income it writes `toAccountId`; transfer requires both.
5. On category/date change call the injected `loadBudgets`; zero results clears `budgetId`, one result auto-selects it, multiple results leave the choice in “更多选项”.
6. `onSubmit` receives `evaluateAmountExpression(expression).amount`; invalid/zero amount, missing expense/income category, or incomplete transfer shows an inline `role="alert"` and does not call the parent.
7. On failure keep every field. On success clear only the expression and natural-language input, show `role="status"`, save category/account preferences, and call `onSaveTemplate` only when the checkbox and non-empty template name are present.
8. The natural-language mode renders the existing `LedgerAgentQuickEntry` with `title="说一句记账"` and `actionLabel="识别并填入"`; `onApply` copies the parsed draft into the same state and returns to the category/keypad view.
9. The full category sheet uses `partitionQuickEntryCategories(categories, type).all` and `CategoryIcon`; the options sheet contains type/transfer, currency, budget, source account, target account, date, remarks and save-template controls.
10. Both sheets include a `完成` button that closes the current sheet; the remarks field has the accessible label `备注`.

The top-level JSX hierarchy must be:

```tsx
<section data-mobile-quick-entry="true" className="mx-auto w-full max-w-md space-y-4 pb-4">
  <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">记一笔</h1>
  <div role="group" aria-label="交易类型" className="grid grid-cols-2 rounded-xl bg-[var(--color-container)] p-1">
    <button type="button" aria-pressed={type === 'EXPENSE'} onClick={() => selectType('EXPENSE')} className="min-h-11 rounded-lg aria-pressed:bg-[var(--color-accent)] aria-pressed:text-[var(--color-text-inverse)]">支出</button>
    <button type="button" aria-pressed={type === 'INCOME'} onClick={() => selectType('INCOME')} className="min-h-11 rounded-lg aria-pressed:bg-[var(--color-accent)] aria-pressed:text-[var(--color-text-inverse)]">收入</button>
  </div>
  {type === 'TRANSFER' ? <div role="status">转账模式</div> : (
    <FrequentCategoryGrid categories={categories} type={type} selectedId={categoryId} onSelect={setCategoryId} onMore={() => setCategorySheetOpen(true)} />
  )}
  <div className="rounded-2xl bg-[var(--color-container)] p-4 text-right">
    <div className="text-xs text-[var(--color-text-secondary)]">{expression || '0'}</div>
    <output aria-label="金额" className="text-4xl font-bold">¥{evaluation.valid ? evaluation.amount : '0'}</output>
  </div>
  <AmountKeypad onKey={(key) => setExpression((current) => applyAmountKey(current, key))} />
  <div className="grid grid-cols-2 gap-2">
    <button type="button" onClick={() => setOptionsOpen(true)} className="min-h-11 rounded-xl border border-[var(--border-tertiary)]">{selectedAccountName || '不指定账户'}</button>
    <button type="button" onClick={() => setOptionsOpen(true)} className="min-h-11 rounded-xl border border-[var(--border-tertiary)]">{occurredAt === today ? '今天' : occurredAt}</button>
  </div>
  <button type="button" onClick={() => setOptionsOpen(true)} className="min-h-11 w-full">更多选项</button>
  <button type="button" disabled={submitting || !evaluation.valid} onClick={submit}
    className="min-h-12 w-full rounded-xl bg-[var(--color-accent)] font-bold text-[var(--color-text-inverse)] disabled:opacity-50">
    {submitting ? '记账中…' : '确认记账'}
  </button>
  <button type="button" onClick={() => setAgentOpen((open) => !open)} className="min-h-11 w-full">说一句记账</button>
  {agentOpen ? (
    <LedgerAgentQuickEntry embedded title="说一句记账" actionLabel="识别并填入" categories={categories} assets={assets} onApply={applyAgentDraft} />
  ) : null}
  <QuickEntryMoreSheet open={categorySheetOpen} title="选择分类" onClose={() => setCategorySheetOpen(false)}>
    <div className="grid grid-cols-3 gap-2">
      {categorySections.all.map((category) => (
        <button key={category.id} type="button" onClick={() => { setCategoryId(category.id); setCategorySheetOpen(false); }} className="min-h-11 rounded-xl border border-[var(--border-tertiary)]">
          <CategoryIcon name={category.name} /><span>{category.name}</span>
        </button>
      ))}
    </div>
    <button type="button" onClick={() => setCategorySheetOpen(false)} className="mt-3 min-h-11 w-full rounded-xl">完成</button>
  </QuickEntryMoreSheet>
  <QuickEntryMoreSheet open={optionsOpen} title="更多记账选项" onClose={() => setOptionsOpen(false)}>
    <label>记账方式<select aria-label="记账方式" value={type} onChange={(event) => selectType(event.target.value as QuickEntryType)}><option value="EXPENSE">支出</option><option value="INCOME">收入</option><option value="TRANSFER">转账</option></select></label>
    <label>币种<select aria-label="币种" value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="CNY">人民币</option><option value="USD">美元</option><option value="HKD">港币</option><option value="JPY">日元</option></select></label>
    <label>预算<select aria-label="预算" value={budgetId} onChange={(event) => setBudgetId(event.target.value)}><option value="">不关联预算</option>{budgets.map((budget) => <option key={budget.id} value={budget.id}>{budget.name}</option>)}</select></label>
    <label>来源账户<select aria-label="来源账户" value={fromAccountId} onChange={(event) => setFromAccountId(event.target.value)}><option value="">不指定</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
    <label>目标账户<select aria-label="目标账户" value={toAccountId} onChange={(event) => setToAccountId(event.target.value)}><option value="">不指定</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
    <label>日期<input aria-label="日期" type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} /></label>
    <label>备注<input aria-label="备注" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
    <label><input type="checkbox" checked={saveAsTemplate} onChange={(event) => setSaveAsTemplate(event.target.checked)} />保存为模板</label>
    {saveAsTemplate ? <label>模板名称<input aria-label="模板名称" value={templateName} onChange={(event) => setTemplateName(event.target.value)} /></label> : null}
    <button type="button" onClick={() => setOptionsOpen(false)} className="mt-3 min-h-11 w-full rounded-xl">完成</button>
  </QuickEntryMoreSheet>
</section>
```

- [ ] **Step 5: Run component and parser tests**

```bash
npx tsx --test \
  src/components/ledger/MobileQuickEntry.test.tsx \
  src/components/widgets/LedgerAgentQuickEntry.test.tsx \
  src/lib/ledger-agent.test.ts \
  src/lib/ledger-quick-entry.test.ts
npm run lint -- src/components/ledger/MobileQuickEntry.tsx src/components/widgets/LedgerAgentQuickEntry.tsx
```

Expected: all tests PASS and lint reports no errors.

- [ ] **Step 6: Commit Task 4 only**

```bash
git add src/components/ledger/MobileQuickEntry.tsx src/components/ledger/MobileQuickEntry.test.tsx src/components/widgets/LedgerAgentQuickEntry.tsx src/components/widgets/LedgerAgentQuickEntry.test.tsx
git commit -m "feat: build mobile category-first entry"
```

---

### Task 5: Integrate Quick Entry, Budget Feedback, Desktop Boundaries, and Navigation State

**Files:**
- Modify: `src/app/management/ledger/LedgerManager.tsx:1-205,291-394,615-856`
- Modify: `src/lib/mobile-navigation.ts:1-37`
- Modify: `src/lib/mobile-navigation.test.ts`
- Modify: `src/components/layout/MobileNavigation.tsx:1-199`
- Modify: `src/components/layout/MobileNavigation.test.tsx`
- Modify: `src/lib/ledger-quick-entry.test.ts`

**Interfaces:**
- Consumes: `MobileQuickEntry`, `QuickEntrySubmitValues`, `QuickEntrySubmitResult`, `createTransaction`, `getBudgetProgress`, `refreshLedgerCaches`, and existing template storage functions.
- Produces: mobile-only quick entry, desktop-only full create form under `focus=create`, budget-aware feedback, and query-aware navigation active state.

- [ ] **Step 1: Write failing navigation query tests**

Update the active-state test in `src/lib/mobile-navigation.test.ts`:

```ts
test('focus=create selects only quick-entry while normal ledger selects ledger', () => {
  assert.equal(isMobileNavItemActive('/management/ledger', 'quick-entry', 'create'), true);
  assert.equal(isMobileNavItemActive('/management/ledger', 'ledger', 'create'), false);
  assert.equal(isMobileNavItemActive('/management/ledger', 'quick-entry', null), false);
  assert.equal(isMobileNavItemActive('/management/ledger', 'ledger', null), true);
});
```

Run `npx tsx --test src/lib/mobile-navigation.test.ts`; expected FAIL because the function ignores `focus`.

- [ ] **Step 2: Make navigation active state query-aware**

Change the pure function:

```ts
export function isMobileNavItemActive(
  pathname: string,
  id: MobilePrimaryNavId,
  focus: string | null = null,
) {
  const quickEntryFocused = pathname === '/management/ledger' && focus === 'create';
  if (id === 'quick-entry') return quickEntryFocused;
  if (id === 'ledger') return pathname.startsWith('/management/ledger') && !quickEntryFocused;
  if (id === 'home') return pathname === '/';
  if (id === 'assets') return pathname.startsWith('/management/assets');
  return pathname.startsWith('/management/budget');
}
```

In `MobileNavigation`, call `useSearchParams()`, pass `focus={searchParams.get('focus')}` into `MobileNavigationView`, and pass that value to `isMobileNavItemActive`. Update static tests to provide `focus={null}` or `focus="create"`, then assert the quick-entry link has `aria-current="page"` only in the focused case.

- [ ] **Step 3: Add the mobile submission adapter in LedgerManager**

Import `getBudgetProgress`, `getBudgetsForCategory`, `MobileQuickEntry`, and its types. Add:

```ts
async function submitMobileQuickEntry(values: QuickEntrySubmitValues): Promise<QuickEntrySubmitResult> {
  setError('');
  const result = await createTransaction({
    ...values,
    categoryId: values.categoryId || undefined,
    budgetId: values.budgetId || undefined,
    fromAccountId: values.fromAccountId || undefined,
    toAccountId: values.toAccountId || undefined,
    description: values.description || undefined,
  });
  if (!result.success) {
    if (result.error?.includes('会话密钥')) {
      window.location.href = '/login';
      return { success: false, error: result.error, sessionExpired: true };
    }
    return { success: false, error: result.error || '创建失败' };
  }

  await refreshLedgerCaches(mutate);
  const categoryName = categories.find((category: any) => category.id === values.categoryId)?.name
    ?? (values.type === 'TRANSFER' ? '转账' : '未分类');
  let budgetRemaining: number | undefined;
  if (values.budgetId) {
    const progress = await getBudgetProgress(values.occurredAt);
    budgetRemaining = progress.success
      ? progress.data?.find((item: any) => item.id === values.budgetId)?.remaining
      : undefined;
  }
  const feedback = buildQuickEntryFeedback({
    amount: values.amount,
    currency: values.currency,
    categoryName,
    budgetRemaining,
  });
  toast.success(feedback);
  return { success: true, feedback };
}
```

Also add the currently missing desktop field to `handleCreate`:

```ts
budgetId: (formData.get('budgetId') as string) || undefined,
```

- [ ] **Step 4: Replace the mobile focused form while preserving desktop**

In the `activeTab === 'transactions'` branch:

1. Hide the template quick bar and “先补齐本月流水” intro below `md` when `isCreateFocus`.
2. Replace the old standalone `LedgerAgentQuickEntry` block with:

```tsx
{isCreateFocus ? (
  <section className="mb-4 md:hidden" aria-label="快速记一笔">
    <MobileQuickEntry
      categories={categories}
      assets={assets}
      loadBudgets={async (date, categoryId) => {
        const result = await getBudgetsForCategory(date, categoryId);
        return result.success ? (result.data ?? []).map(({ id, name }) => ({ id, name })) : [];
      }}
      onSubmit={submitMobileQuickEntry}
      onSaveTemplate={(name, values) => {
        saveTemplates([
          ...templates.filter((template) => template.name !== name),
          {
            name,
            type: values.type,
            amount: values.amount,
            categoryId: values.categoryId,
            fromAccountId: values.fromAccountId,
            toAccountId: values.toAccountId,
            description: values.description,
          },
        ]);
      }}
    />
  </section>
) : null}
```

3. Give the full form this responsive boundary:

```ts
className="mb-4 hidden items-end gap-3 rounded-xl bg-ledger-surface p-4 md:flex md:flex-wrap"
```

The intentional outcome is: full create form is hidden at every mobile ledger URL and remains visible at `>=768px`; only `focus=create` receives `MobileQuickEntry`.

4. Remove `quickEntryResetKey` and the direct `LedgerAgentQuickEntry` import from `LedgerManager` after the new container owns that mode.

- [ ] **Step 5: Run integration-focused tests and lint**

```bash
npx tsx --test \
  src/lib/mobile-navigation.test.ts \
  src/components/layout/MobileNavigation.test.tsx \
  src/lib/ledger-quick-entry.test.ts \
  src/lib/ledger-agent.test.ts \
  src/components/widgets/LedgerAgentQuickEntry.test.tsx \
  src/components/ledger/*.test.tsx

npm run lint -- \
  src/app/management/ledger/LedgerManager.tsx \
  src/lib/mobile-navigation.ts \
  src/components/layout/MobileNavigation.tsx \
  src/lib/ledger-quick-entry.ts
```

Expected: all tests PASS and lint reports no errors.

- [ ] **Step 6: Commit Task 5 only**

```bash
git add src/app/management/ledger/LedgerManager.tsx src/lib/mobile-navigation.ts src/lib/mobile-navigation.test.ts src/components/layout/MobileNavigation.tsx src/components/layout/MobileNavigation.test.tsx src/lib/ledger-quick-entry.test.ts
git commit -m "feat: integrate mobile quick entry flow"
```

---

### Task 6: Update Real Mobile Flow QA and Perform Visual Comparison

**Files:**
- Modify: `scripts/check-mobile-ledger-flow.ts`
- Reference: `docs/superpowers/specs/assets/2026-07-12-category-first-quick-entry.png`
- Runtime output: `/tmp/elevate-life-mobile-qa/*.png` (do not commit)

**Interfaces:**
- Consumes: `data-mobile-quick-entry`, `data-quick-category`, `data-amount-key`, existing review credentials, and `data-transaction-list`.
- Produces: persisted/cleaned real transaction evidence, responsive screenshots, no-overflow assertions, and a side-by-side visual comparison.

- [ ] **Step 1: Replace the old agent-to-full-form E2E path**

Replace `createAndRemoveMobileTransaction` with a flow that:

```ts
async function createAndRemoveMobileTransaction(page: Page) {
  const marker = `手机极速记账-${Date.now()}`;
  try {
    await page.getByRole('link', { name: /记一笔/ }).click();
    await page.waitForURL((url) => url.pathname === '/management/ledger' && url.searchParams.get('focus') === 'create');
    const quick = page.locator('[data-mobile-quick-entry="true"]');
    await quick.waitFor({ state: 'visible' });
    await quick.locator('[data-quick-category="餐饮"]').click();
    await quick.getByRole('button', { name: '更多选项' }).click();
    const sheet = page.getByRole('dialog', { name: '更多记账选项' });
    await sheet.getByLabel('备注').fill(marker);
    await sheet.getByRole('button', { name: '完成' }).click();
    await quick.locator('[data-amount-key="3"]').click();
    await quick.locator('[data-amount-key="2"]').click();
    await quick.getByRole('button', { name: '确认记账' }).click();
    await quick.getByText(/已记 ¥32 · 餐饮/).waitFor({ state: 'visible' });

    const row = page.locator('[data-transaction-list="true"] tbody tr').filter({ hasText: marker });
    await row.waitFor({ state: 'visible' });
    await page.screenshot({ path: resolve(outputDir, '360x800-category-first-success.png'), fullPage: false });
  } finally {
    await removeTransactionIfPresent(page, marker);
  }
}
```

The options sheet must expose a `完成` button and label its description input `备注`; align the component if this check reveals a mismatch.

- [ ] **Step 2: Add category/type and natural-language assertions without a second write**

Before the real submit, assert:

```ts
await quick.getByRole('button', { name: '收入' }).click();
assert.equal(await quick.locator('[data-quick-category="人情往来"]').count(), 1);
await quick.getByRole('button', { name: '支出' }).click();
await quick.getByRole('button', { name: '说一句记账' }).click();
await quick.locator('#ledger-agent-input').fill('今天午饭 32 用现金');
await quick.getByRole('button', { name: '识别并填入' }).click();
assert.match(await quick.getByLabel('金额').textContent() ?? '', /32/);
await page.reload({ waitUntil: 'domcontentloaded' });
await settle(page);
await page.locator('[data-mobile-quick-entry="true"]').waitFor({ state: 'visible' });
```

Then reacquire the quick-entry locator and continue the category-button/keypad persisted transaction path and cleanup from a fresh empty amount state.

- [ ] **Step 3: Update keyboard-pressure and viewport checks**

At `360×520`, enter `32` through `data-amount-key`, scroll `确认记账` into view, assert it is hit-testable and do not submit. Add screenshot-only quick-entry checks at `360×640`, `390×844`, and `412×839`; each must assert no horizontal overflow and capture the same initial expense state. Add a `1440×900` context that asserts:

```ts
assert.equal(await page.locator('[data-mobile-quick-entry="true"]').count(), 0);
await page.locator('[data-ledger-create-form="true"]').waitFor({ state: 'visible' });
```

- [ ] **Step 4: Run the real flow against localhost:3000**

Start or reuse the app on port 3000, then run:

```bash
MOBILE_QA_USERNAME=demo \
MOBILE_QA_PASSWORD=demo123 \
MOBILE_QA_BASE_URL=http://localhost:3000 \
npm run mobile:flow:check
```

Expected: `Mobile ledger flow passed`, the created transaction is deleted in `finally`, and browser diagnostics are empty.

- [ ] **Step 5: Compare source and implementation in one image**

```bash
convert docs/superpowers/specs/assets/2026-07-12-category-first-quick-entry.png -resize 390x844 /tmp/elevate-life-mobile-qa/reference-390x844.png
montage /tmp/elevate-life-mobile-qa/reference-390x844.png /tmp/elevate-life-mobile-qa/390x844-category-first.png -tile 2x1 -geometry 390x844+16+0 /tmp/elevate-life-mobile-qa/category-first-comparison.png
```

Open `/tmp/elevate-life-mobile-qa/category-first-comparison.png` with `view_image`. Check category grid count, amount hierarchy, spacing, borders, radii, type switch, keypad density, primary button, clipping and bottom navigation. Fix visible mismatches in the owning component, rerun the targeted component tests, rerun this viewport, and rebuild the comparison once.

- [ ] **Step 6: Run the full verification gate**

```bash
npx tsx --test \
  src/lib/ledger-category-presets.test.ts \
  src/lib/ledger-quick-entry.test.ts \
  src/lib/ledger-agent.test.ts \
  src/lib/mobile-navigation.test.ts \
  src/components/widgets/LedgerAgentQuickEntry.test.tsx \
  src/components/layout/MobileNavigation.test.tsx \
  src/components/ledger/*.test.tsx

npm run lint
npm run review:check
npm run build
```

Expected: all tests PASS, lint has no errors, review account readiness passes, and the production build completes.

- [ ] **Step 7: Commit Task 6 only**

```bash
git add scripts/check-mobile-ledger-flow.ts
git commit -m "test: verify category-first mobile entry"
```

---

## Execution Order and Review Gates

1. Task 1 and Task 2 are pure/data foundations and must land first.
2. Task 3 consumes Task 2 types and is independently reviewable as presentation primitives.
3. Task 4 composes those primitives and reuses the existing natural-language parser.
4. Task 5 is the only task that alters the main ledger page and mobile navigation.
5. Task 6 is required before completion; screenshots alone do not replace the persisted-flow and cleanup assertions.

For subagent-driven execution, dispatch one fresh implementation subagent per task. After every task, run a spec-compliance review followed by a code-quality review before moving to the next task.
