# Budget-Transaction Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link Transaction to Budget with `budgetId`, replace `month` with `startDate`/`endDate` on Budget, update progress calculation to use `budgetId` precedence, add budget selector to ledger form, and add inline expense form to budget page.

**Architecture:** Budget gains `startDate`/`endDate` replacing `month`. Transaction gains optional `budgetId` with `onDelete: SetNull`. Progress calculation matches by `budgetId` first, falling back to `categoryId` within the budget's date range. LedgerManager fetches budgets matching the transaction's category+date and shows a dropdown. BudgetManager adds an inline expense form per budget row.

**Tech Stack:** Prisma, Next.js Server Actions, React (client components), Tailwind CSS v4

---

### Task 1: Schema Update & Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update Budget model in schema**

```prisma
model Budget {
  id         String   @id @default(uuid())
  userId     String   @map("user_id")
  name       String
  categoryId String?  @map("category_id")
  amount     Decimal  @db.Decimal(18, 4)
  startDate  DateTime @map("start_date")
  endDate    DateTime @map("end_date")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  category     Category?     @relation(fields: [categoryId], references: [id])
  transactions Transaction[]

  @@index([userId, startDate, endDate])
}
```

Key changes from current: remove `period` and `month` fields, remove `@@unique([userId, categoryId, month])`, add `startDate` and `endDate`.

- [ ] **Step 2: Add budgetId to Transaction model**

```prisma
model Transaction {
  id            String    @id @default(uuid())
  userId        String    @map("user_id")
  type          String
  amount        Decimal   @db.Decimal(18, 4)
  categoryId    String?   @map("category_id")
  budgetId      String?   @map("budget_id")
  fromAccountId String?   @map("from_account_id")
  toAccountId   String?   @map("to_account_id")
  liabilityId   String?   @map("liability_id")
  description   String?
  occurredAt    DateTime  @map("occurred_at")
  isEssential   Boolean   @default(false) @map("is_essential")
  reconciled    Boolean   @default(false)
  currency      String    @default("CNY")
  createdAt     DateTime  @default(now()) @map("created_at")

  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  category   Category?  @relation(fields: [categoryId], references: [id])
  budget     Budget?    @relation(fields: [budgetId], references: [id], onDelete: SetNull)
  fromAsset  Asset?     @relation("fromAsset", fields: [fromAccountId], references: [id])
  toAsset    Asset?     @relation("toAsset", fields: [toAccountId], references: [id])
  liability  Liability? @relation("liabilityTransactions", fields: [liabilityId], references: [id])

  @@index([userId, occurredAt])
}
```

- [ ] **Step 3: Generate and run migration**

```bash
npx prisma migrate dev --name add_budget_dates_and_transaction_budget_link
```

Verify: `npx prisma db pull` shows correct schema.

- [ ] **Step 4: Update seed script (`prisma/seed.ts`)** — change budget creation from `month` to `startDate`/`endDate`

Find budget creation calls (look for `month:` in seed), replace with `startDate:` and `endDate:`. Example:
```ts
// Old
await prisma.budget.create({
  data: { name: '餐饮', categoryId: foodCat.id, amount: 3000, period: 'monthly', month: '2026-06', userId }
})
// New
await prisma.budget.create({
  data: { name: '餐饮', categoryId: foodCat.id, amount: 3000, startDate: new Date('2026-06-01'), endDate: new Date('2026-06-30'), userId }
})
```

Commit: `git add prisma/ prisma/seed.ts && git commit -m "feat: add budget dates and transaction-budget link"`

---

### Task 2: Budget Actions Refactor

**Files:**
- Modify: `src/lib/actions/budget.ts`

- [ ] **Step 1: Update `getBudgets` — change parameter from `month` to `date`**

```ts
export async function getBudgets(date: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const targetDate = new Date(date);
  const budgets = await prisma.budget.findMany({
    where: {
      userId,
      startDate: { lte: targetDate },
      endDate: { gte: targetDate },
    },
    include: { category: true },
    orderBy: { createdAt: 'asc' },
  });

  // ... rest same as before, serialize Decimal
}
```

- [ ] **Step 2: Update `createBudget` — accept `startDate`/`endDate` instead of `month`**

```ts
export async function createBudget(data: {
  name: string;
  categoryId?: string;
  amount: string;
  startDate: string;
  endDate: string;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  try {
    const budget = await prisma.budget.create({
      data: {
        name: data.name,
        categoryId: data.categoryId || null,
        amount: new Decimal(data.amount),
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        userId,
      },
      include: { category: true },
    });

    revalidateTag(`user-${userId}`, 'default');
    return { success: true, data: serializeBudget(budget) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
```

- [ ] **Step 3: Update `updateBudget` — allow editing date range**

```ts
export async function updateBudget(id: string, data: {
  name?: string;
  amount?: string;
  startDate?: string;
  endDate?: string;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  try {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.amount !== undefined) updateData.amount = new Decimal(data.amount);
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);

    await prisma.budget.updateMany({ where: { id, userId }, data: updateData });
    revalidateTag(`user-${userId}`, 'default');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
```

- [ ] **Step 4: Update `getBudgetProgress` — use `budgetId` precedence + date range**

```ts
export async function getBudgetProgress(date: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const targetDate = new Date(date);

  const budgets = await prisma.budget.findMany({
    where: {
      userId,
      startDate: { lte: targetDate },
      endDate: { gte: targetDate },
    },
    include: { category: true },
  });

  if (budgets.length === 0) return { success: true, data: [] };

  // Get all transactions within any budget's date range for this month context
  const allStartDates = budgets.map(b => b.startDate);
  const allEndDates = budgets.map(b => b.endDate);
  const minStart = new Date(Math.min(...allStartDates.map(d => d.getTime())));
  const maxEnd = new Date(Math.max(...allEndDates.map(d => d.getTime())));

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: 'EXPENSE',
      occurredAt: { gte: minStart, lte: maxEnd },
      OR: [
        { budgetId: { not: null } },
        { categoryId: { not: null } },
      ],
    },
    select: { budgetId: true, categoryId: true, amount: true, occurredAt: true },
  });

  const progress = budgets.map(b => {
    let spent = new Decimal(0);
    for (const t of transactions) {
      // Must be within this budget's date range
      if (t.occurredAt < b.startDate || t.occurredAt > b.endDate) continue;

      // Explicit link takes priority
      if (t.budgetId === b.id) {
        spent = spent.plus(t.amount);
      } else if (t.budgetId === null && t.categoryId === b.categoryId) {
        // Fallback: unlinked transaction matches by category (historical data)
        spent = spent.plus(t.amount);
      }
    }

    const budgetAmount = Number(b.amount);
    const spentNum = spent.toNumber();
    const pct = budgetAmount > 0 ? (spentNum / budgetAmount * 100) : 0;

    return {
      id: b.id,
      name: b.name,
      categoryName: b.category?.name || '总计',
      budgetAmount,
      spent: spentNum,
      remaining: budgetAmount - spentNum,
      pct: Math.min(pct, 100),
      isOverBudget: spentNum > budgetAmount,
    };
  });

  return { success: true, data: progress };
}
```

- [ ] **Step 5: Add `getBudgetsForCategory` helper for ledger form**

```ts
export async function getBudgetsForCategory(date: string, categoryId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const targetDate = new Date(date);
  const budgets = await prisma.budget.findMany({
    where: {
      userId,
      categoryId,
      startDate: { lte: targetDate },
      endDate: { gte: targetDate },
    },
    select: { id: true, name: true, startDate: true, endDate: true },
    orderBy: { startDate: 'asc' },
  });

  return { success: true, data: budgets };
}
```

- [ ] **Step 6: Add `serializeBudget` helper at file bottom**

```ts
function serializeBudget(b: any) {
  const result: any = {
    id: b.id, userId: b.userId, name: b.name,
    categoryId: b.categoryId,
    amount: b.amount.toFixed(4),
    startDate: b.startDate, endDate: b.endDate,
    createdAt: b.createdAt, updatedAt: b.updatedAt,
    category: b.category ? { id: b.category.id, name: b.category.name, type: b.category.type, isEssential: b.category.isEssential } : null,
  };
  return result;
}
```

Update existing `getBudgets` and `createBudget` to use this helper for consistent serialization.

Commit: `git add src/lib/actions/budget.ts && git commit -m "feat: refactor budget actions for date ranges and budgetId priority"`

---

### Task 3: Ledger Actions Update

**Files:**
- Modify: `src/lib/actions/ledger.ts`

- [ ] **Step 1: Add `budgetId` to `createTransaction` params and transaction creation**

In `createTransaction`, add `budgetId` to the destructured params:
```ts
export async function createTransaction(data: {
  type: string;
  amount: string;
  currency?: string;
  categoryId?: string;
  budgetId?: string;  // NEW
  // ... rest unchanged
```

In the `tx.transaction.create` call, add:
```ts
budgetId: data.budgetId || null,
```

- [ ] **Step 2: Add `budgetId` to `updateTransaction`**

```ts
export async function updateTransaction(
  id: string,
  data: Partial<{
    amount: string;
    categoryId: string;
    budgetId: string | null;  // NEW — null to unlink
    description: string;
    occurredAt: string;
  }>
)
```

In the updateData construction:
```ts
if (data.budgetId !== undefined) updateData.budgetId = data.budgetId || null;
```

- [ ] **Step 3: Include `budgetId` in `getTransactions` response**

Add to the returned object:
```ts
budgetId: t.budgetId,
```

Commit: `git add src/lib/actions/ledger.ts && git commit -m "feat: add budgetId to ledger actions"`

---

### Task 4: Caller Updates (Dashboard + Budget Page)

**Files:**
- Modify: `src/app/management/budget/page.tsx`
- Modify: `src/app/(dashboard)/page.tsx`

- [ ] **Step 1: Update budget management page**

Change `currentMonth` to `currentDate` (full ISO date):
```ts
const currentDate = new Date().toISOString().slice(0, 10);

const [budgetsRes, progressRes, categoriesRes] = await Promise.all([
  getBudgets(currentDate),
  getBudgetProgress(currentDate),
  getCategories(),
]);
```

Pass `currentDate` to BudgetManager instead of `currentMonth`:
```tsx
<BudgetManager
  budgets={budgets}
  progress={progress}
  categories={categories}
  currentDate={currentDate}
/>
```

- [ ] **Step 2: Update dashboard page**

```ts
const currentDate = new Date().toISOString().slice(0, 10);
// ...
getAutoForecast(12), getBudgetProgress(currentDate), getGoals(),
```

Commit: `git add src/app/management/budget/page.tsx src/app/(dashboard)/page.tsx && git commit -m "feat: update budget callers to use date instead of month"`

---

### Task 5: Budget Manager UI

**Files:**
- Modify: `src/app/management/budget/BudgetManager.tsx`

- [ ] **Step 1: Update interface and state — replace `currentMonth` with `currentDate`**

```tsx
interface Props {
  budgets: Budget[];
  progress: BudgetProgress[];
  categories: any[];
  currentDate: string;
}
```

- [ ] **Step 2: Add date pickers to create form**

Before the "添加预算" button, add two date fields:
```tsx
<div>
  <label className="block text-xs text-ledger-muted mb-1">开始日期</label>
  <input
    name="startDate"
    type="date"
    required
    defaultValue={currentDate.slice(0, 7) + '-01'}
    className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
  />
</div>
<div>
  <label className="block text-xs text-ledger-muted mb-1">结束日期</label>
  <input
    name="endDate"
    type="date"
    required
    defaultValue={(() => {
      const d = new Date(currentDate);
      return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
    })()}
    className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
  />
</div>
```

- [ ] **Step 3: Update `handleCreate` to pass date params**

```ts
const result = await createBudget({
  name: formData.get('name') as string,
  categoryId: (formData.get('categoryId') as string) || undefined,
  amount: formData.get('amount') as string,
  startDate: formData.get('startDate') as string,
  endDate: formData.get('endDate') as string,
});
```

- [ ] **Step 4: Add date fields to edit form**

In the inline edit form (inside each budget row), add startDate/endDate inputs:
```tsx
<div>
  <label className="block text-xs text-ledger-muted mb-1">开始</label>
  <input
    type="date" value={editForm.startDate}
    onChange={e => setEditForm(p => ({ ...p, startDate: e.target.value }))}
    className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent"
  />
</div>
<div>
  <label className="block text-xs text-ledger-muted mb-1">结束</label>
  <input
    type="date" value={editForm.endDate}
    onChange={e => setEditForm(p => ({ ...p, endDate: e.target.value }))}
    className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent"
  />
</div>
```

Update `editForm` state to include date fields:
```ts
const [editForm, setEditForm] = useState({ name: '', amount: '', startDate: '', endDate: '' });
```

Update `startEdit` to populate dates:
```ts
function startEdit(b: Budget) {
  setEditingId(b.id);
  setEditForm({
    name: b.name,
    amount: b.amount?.toString?.() || '',
    startDate: b.startDate ? new Date(b.startDate).toISOString().slice(0, 10) : '',
    endDate: b.endDate ? new Date(b.endDate).toISOString().slice(0, 10) : '',
  });
}
```

Update `handleUpdateBudget`:
```ts
await updateBudget(editingId, {
  name: editForm.name || undefined,
  amount: editForm.amount || undefined,
  startDate: editForm.startDate || undefined,
  endDate: editForm.endDate || undefined,
});
```

- [ ] **Step 5: Add "记录支出" inline form per budget row**

Add state for tracking which budget row has the expense form open:
```ts
const [expenseRowId, setExpenseRowId] = useState<string | null>(null);
const [expenseForm, setExpenseForm] = useState({ amount: '', description: '', date: currentDate });
```

In each budget row (after the edit/delete buttons), add:
```tsx
<button
  type="button"
  onClick={() => {
    setExpenseRowId(expenseRowId === b.id ? null : b.id);
    setExpenseForm({ amount: '', description: '', date: currentDate });
  }}
  className="text-xs px-2 py-0.5 rounded bg-ledger-accent/20 text-ledger-accent hover:bg-ledger-accent/30"
>
  {expenseRowId === b.id ? '取消' : '记录支出'}
</button>
```

After this button, when `expenseRowId === b.id`, show inline form:
```tsx
{expenseRowId === b.id && (
  <div className="mt-2 p-3 bg-ledger-bg rounded-lg border border-ledger-accent/30">
    <div className="flex flex-wrap gap-2 items-end">
      <div>
        <label className="block text-xs text-ledger-muted mb-1">金额</label>
        <input
          type="number" step="0.01" required
          value={expenseForm.amount}
          onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))}
          className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent w-24"
          placeholder="0.00"
        />
      </div>
      <div>
        <label className="block text-xs text-ledger-muted mb-1">日期</label>
        <input
          type="date"
          value={expenseForm.date}
          onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))}
          className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-ledger-muted mb-1">备注</label>
        <input
          type="text"
          value={expenseForm.description}
          onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))}
          className="rounded-md bg-ledger-surface border border-ledger-bg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ledger-accent"
          placeholder="备注"
        />
      </div>
      <button
        type="button"
        onClick={async () => {
          if (!expenseForm.amount) return;
          setError('');
          const { createTransaction } = await import('@/lib/actions/ledger');
          const result = await createTransaction({
            type: 'EXPENSE',
            amount: expenseForm.amount,
            categoryId: b.categoryId || undefined,
            budgetId: b.id,
            description: expenseForm.description || undefined,
            occurredAt: expenseForm.date,
          });
          if (result.success) {
            setExpenseRowId(null);
            setRefreshKey(k => k + 1);
            router.refresh();
          } else {
            setError(result.error || '记录失败');
          }
        }}
        disabled={!expenseForm.amount}
        className="rounded-md bg-ledger-accent px-2 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        保存
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 6: Update the table to show date range instead of month**

In the table header, change "月份" → "日期范围":
```tsx
<th className="px-4 py-3 font-medium">日期范围</th>
```

And in each row, show dates:
```tsx
<td className="px-4 py-3 text-ledger-muted text-xs">
  {new Date(b.startDate).toLocaleDateString('zh-CN')} ~ {new Date(b.endDate).toLocaleDateString('zh-CN')}
</td>
```

Note: The Budget interface at the top needs `startDate` and `endDate` fields added.

- [ ] **Step 7: Update the Budget interface**

```ts
interface Budget {
  id: string;
  name: string;
  categoryId?: string | null;
  amount: { toString: () => string };
  startDate: string | Date;
  endDate: string | Date;
  category?: { id: string; name: string } | null;
}
```

Commit: `git add src/app/management/budget/BudgetManager.tsx && git commit -m "feat: add date pickers and inline expense form to budget manager"`

---

### Task 6: Ledger Manager UI

**Files:**
- Modify: `src/app/management/ledger/LedgerManager.tsx`

- [ ] **Step 1: Add `budgetId` to create form state and budget list state**

```ts
const [formValues, setFormValues] = useState({
  type: 'EXPENSE',
  amount: '',
  currency: 'CNY',
  categoryId: '',
  budgetId: '',  // NEW
  fromAccountId: '',
  toAccountId: '',
  description: '',
  occurredAt: new Date().toISOString().split('T')[0],
});

const [budgetOptions, setBudgetOptions] = useState<any[]>([]);  // NEW
```

- [ ] **Step 2: Add helper to fetch budgets when category or date changes**

```ts
const fetchBudgets = useCallback(async (categoryId: string, date: string) => {
  if (!categoryId) { setBudgetOptions([]); return; }
  const { getBudgetsForCategory } = await import('@/lib/actions/budget');
  const res = await getBudgetsForCategory(date, categoryId);
  if (res.success) setBudgetOptions(res.data ?? []);
}, []);
```

- [ ] **Step 3: Add `useEffect` to fetch budgets when category/date changes**

```ts
useEffect(() => {
  if (formValues.categoryId && formValues.occurredAt) {
    fetchBudgets(formValues.categoryId, formValues.occurredAt);
  } else {
    setBudgetOptions([]);
  }
}, [formValues.categoryId, formValues.occurredAt, fetchBudgets]);
```

- [ ] **Step 4: Add budget dropdown to create form** — after the category select, add:

```tsx
{budgetOptions.length > 0 && (
  <div>
    <label className="block text-xs text-ledger-muted mb-1">预算</label>
    <select
      name="budgetId"
      value={formValues.budgetId}
      onChange={e => setFormValues(prev => ({ ...prev, budgetId: e.target.value }))}
      className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
    >
      <option value="">-- 关联预算 --</option>
      {budgetOptions.map((b: any) => (
        <option key={b.id} value={b.id}>{b.name}</option>
      ))}
    </select>
  </div>
)}
```

- [ ] **Step 5: Handle category change — clear budgetId**

Update the category onChange handler:
```tsx
onChange={e => {
  setFormValues(prev => ({ ...prev, categoryId: e.target.value, budgetId: '' }));
}}
```

- [ ] **Step 6: Pass `budgetId` in `handleCreate`**

```ts
const result = await createTransaction({
  type: formData.get('type') as string,
  amount: formData.get('amount') as string,
  currency: (formData.get('currency') as string) || 'CNY',
  categoryId: (formData.get('categoryId') as string) || undefined,
  budgetId: (formData.get('budgetId') as string) || undefined,  // NEW
  fromAccountId: (formData.get('fromAccountId') as string) || undefined,
  liabilityId: (formData.get('liabilityId') as string) || undefined,
  description: (formData.get('description') as string) || undefined,
  occurredAt: formData.get('occurredAt') as string,
});
```

Also reset `budgetId` after successful creation.

- [ ] **Step 7: Add budget to edit transaction form**

Add `budgetId` to `editTxForm` state:
```ts
const [editTxForm, setEditTxForm] = useState({
  amount: '', categoryId: '', budgetId: '', description: '', occurredAt: ''
});
```

Update `startEditTx`:
```ts
function startEditTx(tx: any) {
  setEditingTxId(tx.id);
  setEditTxForm({
    amount: tx.amount?.toString() || '',
    categoryId: tx.categoryId || '',
    budgetId: tx.budgetId || '',  // NEW
    description: tx.description || '',
    occurredAt: new Date(tx.occurredAt).toISOString().split('T')[0],
  });
}
```

In the edit inline form, after the category select, add budget dropdown (same pattern as create form). On category change in edit form, clear budgetId:
```tsx
onChange={e => setEditTxForm(p => ({ ...p, categoryId: e.target.value, budgetId: '' }))}
```

Update `handleUpdateTransaction` to pass `budgetId`:
```ts
const result = await updateTransaction(txId, {
  amount: editTxForm.amount || undefined,
  categoryId: editTxForm.categoryId || undefined,
  budgetId: editTxForm.budgetId || undefined,  // NEW
  description: editTxForm.description || undefined,
  occurredAt: editTxForm.occurredAt || undefined,
});
```

- [ ] **Step 8: Add budget fetch to edit form too**

When editing a transaction, fetch budgets for its category+date:
```ts
// Inside startEditTx, after setting form:
if (tx.categoryId) {
  getBudgetsForCategory(editTxForm.occurredAt || new Date().toISOString().slice(0, 10), tx.categoryId)
    .then(res => { if (res.success) setBudgetOptions(res.data ?? []); });
}
```

- [ ] **Step 9: Add budget column to table (optional — show budget name)**

Add a "预算" column header and display `t.budget?.name || '--'` in rows. Need to include `budget: { select: { id: true, name: true } }` in `getTransactions` query.

Commit: `git add src/app/management/ledger/LedgerManager.tsx && git commit -m "feat: add budget selector to ledger create and edit forms"`

---

### Task 7: Verification

- [ ] **Step 1: Reset DB and re-seed**

```bash
npx prisma migrate reset --force
```

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

- [ ] **Step 3: Manual test — budget with dates**

1. Navigate to `http://localhost:3000/management/budget`
2. Create a budget with name, category, amount, start date, end date
3. Verify it appears in the table with correct date range
4. Edit the budget — change date range — verify
5. Delete the budget — verify

- [ ] **Step 4: Manual test — link expense to budget from ledger**

1. Navigate to `http://localhost:3000/management/ledger`
2. Create an EXPENSE, select a category that has an active budget
3. Verify budget dropdown appears
4. Select a budget, fill rest, save
5. Verify transaction appears in the table

- [ ] **Step 5: Manual test — inline expense from budget page**

1. Navigate to budget management page
2. Click "记录支出" on a budget row
3. Fill amount and date, save
4. Verify budget progress updates immediately
5. Navigate to ledger page — verify the expense appears there

- [ ] **Step 6: Manual test — category change clears budget**

1. Navigate to ledger
2. Edit a transaction with a budget linked
3. Change the category
4. Verify the budget dropdown resets

- [ ] **Step 7: Manual test — delete budget keeps transaction**

1. Create a transaction linked to a budget
2. Delete the budget
3. Verify the transaction still exists (budgetId is null)

Commit: `git add -A && git commit -m "test: verify budget-transaction link workflow"`
