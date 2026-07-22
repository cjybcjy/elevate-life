import { budgetIncludesExpense } from './budget-progress';

export const BUDGET_RING_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#f59e0b',
  '#06b6d4',
  '#f97316',
  '#ec4899',
] as const;

export const LIVING_BUDGET_COLOR = '#10b981';
export const USED_BUDGET_COLOR = '#94a3b8';

export interface AnnualBudgetProgress {
  id: string;
  name: string;
  categoryId?: string | null;
  categoryName: string;
  categoryColor?: string | null;
  budgetAmount: number;
  spent: number;
  remaining: number;
  pct: number;
  isOverBudget: boolean;
  startDate?: string | Date;
  endDate?: string | Date;
}

export interface AnnualBudgetRingSegment {
  id: string;
  name: string;
  budgetAmount: number;
  visualAmount: number;
  spent: number;
  usedVisualAmount: number;
  remaining: number;
  sharePercent: number;
  color: string;
  isLiving: boolean;
}

export interface AnnualBudgetOverview {
  annualBudget: AnnualBudgetProgress;
  annualAmount: number;
  annualSpent: number;
  annualRemaining: number;
  usedPercent: number;
  allocatedAmount: number;
  overAllocatedAmount: number;
  segments: AnnualBudgetRingSegment[];
}

export interface AnnualBudgetTransactionLike {
  type: string;
  budgetId?: string | null;
  categoryId?: string | null;
  occurredAt: string | Date;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toTime(value?: string | Date) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function isTotalBudget(budget: AnnualBudgetProgress) {
  return budget.categoryId === null
    || (budget.categoryId === undefined && budget.categoryName === '总计');
}

function budgetDurationDays(budget: AnnualBudgetProgress) {
  const start = toTime(budget.startDate);
  const end = toTime(budget.endDate);
  if (start === null || end === null || end < start) return 0;
  return Math.floor((end - start) / 86_400_000) + 1;
}

function isAnnualTotalBudget(budget: AnnualBudgetProgress) {
  if (!isTotalBudget(budget)) return false;
  return /年度|全年|年预算/.test(budget.name) || budgetDurationDays(budget) >= 300;
}

export function findAnnualBudget(progress: AnnualBudgetProgress[]) {
  return progress
    .filter(isAnnualTotalBudget)
    .toSorted((a, b) => {
      const durationDiff = budgetDurationDays(b) - budgetDurationDays(a);
      return durationDiff || b.budgetAmount - a.budgetAmount;
    })[0] ?? null;
}

export function buildAnnualBudgetOverview(
  progress: AnnualBudgetProgress[],
): AnnualBudgetOverview | null {
  const annualBudget = findAnnualBudget(progress);
  if (!annualBudget || annualBudget.budgetAmount <= 0) return null;

  const annualAmount = annualBudget.budgetAmount;
  const categoryBudgets: AnnualBudgetProgress[] = [];
  let requestedCategoryAmount = 0;
  let categorySpent = 0;
  for (const budget of progress) {
    if (
      budget.id === annualBudget.id
      || isTotalBudget(budget)
      || budget.budgetAmount <= 0
    ) continue;

    categoryBudgets.push(budget);
    requestedCategoryAmount += budget.budgetAmount;
    categorySpent += Math.max(0, budget.spent);
  }
  const allocationScale = requestedCategoryAmount > annualAmount
    ? annualAmount / requestedCategoryAmount
    : 1;
  const livingBudgetAmount = Math.max(annualAmount - requestedCategoryAmount, 0);
  const livingSpent = Math.max(0, annualBudget.spent - categorySpent);

  const segments: AnnualBudgetRingSegment[] = categoryBudgets.map((budget, index) => {
    const visualAmount = budget.budgetAmount * allocationScale;
    const usedRatio = clamp(budget.spent / budget.budgetAmount, 0, 1);
    return {
      id: budget.id,
      name: budget.name,
      budgetAmount: budget.budgetAmount,
      visualAmount,
      spent: Math.max(0, budget.spent),
      usedVisualAmount: visualAmount * usedRatio,
      remaining: budget.budgetAmount - budget.spent,
      sharePercent: (visualAmount / annualAmount) * 100,
      color: budget.categoryColor || BUDGET_RING_COLORS[index % BUDGET_RING_COLORS.length],
      isLiving: false,
    };
  });

  if (livingBudgetAmount > 0) {
    const livingUsedRatio = clamp(livingSpent / livingBudgetAmount, 0, 1);
    segments.push({
      id: '__living-budget',
      name: '生活预算',
      budgetAmount: livingBudgetAmount,
      visualAmount: livingBudgetAmount,
      spent: livingSpent,
      usedVisualAmount: livingBudgetAmount * livingUsedRatio,
      remaining: livingBudgetAmount - livingSpent,
      sharePercent: (livingBudgetAmount / annualAmount) * 100,
      color: LIVING_BUDGET_COLOR,
      isLiving: true,
    });
  }

  return {
    annualBudget,
    annualAmount,
    annualSpent: Math.max(0, annualBudget.spent),
    annualRemaining: annualBudget.remaining,
    usedPercent: clamp((annualBudget.spent / annualAmount) * 100, 0, 100),
    allocatedAmount: Math.min(requestedCategoryAmount, annualAmount),
    overAllocatedAmount: Math.max(requestedCategoryAmount - annualAmount, 0),
    segments,
  };
}

export function getLivingBudgetTransactions<T extends AnnualBudgetTransactionLike>(
  progress: AnnualBudgetProgress[],
  transactions: T[],
): T[] {
  const annualBudget = findAnnualBudget(progress);
  if (!annualBudget) return [];

  const annualStart = toTime(annualBudget.startDate);
  const annualEnd = toTime(annualBudget.endDate);
  if (annualStart === null || annualEnd === null) return [];

  const annualMatch = {
    id: annualBudget.id,
    categoryId: null,
    startDate: new Date(annualStart),
    endDate: new Date(annualEnd),
  };
  const categoryMatches = progress.flatMap((budget) => {
    if (budget.id === annualBudget.id || !budget.categoryId) return [];
    const start = toTime(budget.startDate);
    const end = toTime(budget.endDate);
    if (start === null || end === null) return [];
    return [{
      id: budget.id,
      categoryId: budget.categoryId,
      startDate: new Date(start),
      endDate: new Date(end),
    }];
  });

  return transactions.filter((transaction) => {
    if (transaction.type !== 'EXPENSE') return false;
    const occurredAt = new Date(transaction.occurredAt);
    if (!Number.isFinite(occurredAt.getTime())) return false;
    const expense = {
      budgetId: transaction.budgetId ?? null,
      categoryId: transaction.categoryId ?? null,
      occurredAt,
    };
    return budgetIncludesExpense(annualMatch, expense)
      && !categoryMatches.some((budget) => budgetIncludesExpense(budget, expense));
  });
}

export function getEffectiveBudgetRemaining(progress: AnnualBudgetProgress[]) {
  const annualBudget = findAnnualBudget(progress);
  return annualBudget
    ? annualBudget.remaining
    : progress.reduce((sum, budget) => sum + budget.remaining, 0);
}
