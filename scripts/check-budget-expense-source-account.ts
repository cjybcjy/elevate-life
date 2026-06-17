import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const budgetManagerSource = readFileSync(
  resolve(process.cwd(), 'src/app/management/budget/BudgetManager.tsx'),
  'utf8',
);
const budgetTrackerSource = readFileSync(
  resolve(process.cwd(), 'src/components/widgets/BudgetTracker.tsx'),
  'utf8',
);
const dashboardSource = readFileSync(
  resolve(process.cwd(), 'src/app/(dashboard)/DashboardClient.tsx'),
  'utf8',
);
const ledgerActionSource = readFileSync(
  resolve(process.cwd(), 'src/lib/actions/ledger.ts'),
  'utf8',
);

assert(
  budgetManagerSource.includes("import { useAssets } from '@/hooks/useAssets';"),
  'Budget management should load assets for source account selection.',
);
assert(
  budgetManagerSource.includes('fromAccountId') &&
    budgetManagerSource.includes('name="fromAccountId"') &&
    budgetManagerSource.includes('来源资金账户'),
  'Budget management inline expense form should include a source account field.',
);
const createBudgetFormSource = budgetManagerSource.slice(
  budgetManagerSource.indexOf('{/* Create Form */}'),
  budgetManagerSource.indexOf('{/* Budget List */}'),
);
assert(
  !createBudgetFormSource.includes('name="fromAccountId"') &&
    !createBudgetFormSource.includes('来源资金账户'),
  'Budget creation/summary form must not contain a source account field.',
);
assert(
  budgetManagerSource.includes('fromAccountId: expenseForm.fromAccountId || undefined'),
  'Budget management inline expense creation should pass fromAccountId.',
);
assert(
  budgetManagerSource.includes('assets={assets}'),
  'Budget management should pass assets into BudgetTracker.',
);

assert(
  budgetTrackerSource.includes('assets?: Asset[];'),
  'BudgetTracker should accept optional assets for source account selection.',
);
assert(
  budgetTrackerSource.includes('fromAccountId: form.fromAccountId || undefined'),
  'BudgetTracker quick expense creation should pass fromAccountId.',
);
assert(
  budgetTrackerSource.includes('value={form.fromAccountId}') &&
    budgetTrackerSource.includes('来源资金账户'),
  'BudgetTracker quick expense form should include a source account field.',
);
assert(
  budgetTrackerSource.includes('fromAccountId?: string | null') &&
    budgetTrackerSource.includes('fromAsset?: { id: string; name: string } | null'),
  'BudgetTracker transactions should carry source account data for each recorded expense.',
);
assert(
  budgetTrackerSource.includes("fromAccountId: tx.fromAccountId || ''"),
  'BudgetTracker transaction edit state should initialize from the recorded expense source account.',
);
assert(
  budgetTrackerSource.includes('fromAccountId: editForm.fromAccountId || null'),
  'BudgetTracker transaction updates should pass the edited source account and allow clearing it.',
);
assert(
  budgetTrackerSource.includes('value={editForm.fromAccountId}') &&
    budgetTrackerSource.includes('tx.fromAsset?.name'),
  'BudgetTracker transaction list/edit UI should expose each expense source account.',
);
assert(
  ledgerActionSource.includes('fromAccountId?: string | null') &&
    ledgerActionSource.includes('toAccountId?: string | null'),
  'updateTransaction should accept nullable account ids so a transaction account can be cleared.',
);
assert(
  ledgerActionSource.includes('reverseTransactionEffects') &&
    ledgerActionSource.includes('applyTransactionEffects'),
  'updateTransaction should reverse old account effects and apply new account effects when expense source changes.',
);
assert(
  dashboardSource.includes('assets={assets as') || dashboardSource.includes('assets={assets}'),
  'Dashboard budget tracker should provide assets for source account selection.',
);
