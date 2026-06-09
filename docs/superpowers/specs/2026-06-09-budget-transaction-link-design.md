# Budget-Transaction Link Design

**Date**: 2026-06-09
**Status**: Approved

## Context

Currently Budget and Transaction both link to Category independently. Budget uses a `month` string ("2026-06") which limits it to calendar-month granularity. Budget progress is calculated by matching `transaction.categoryId` with `budget.categoryId` for the same month. There is no direct link between Budget and Transaction.

## Requirements

1. A Transaction can optionally link to one Budget via `budgetId`
2. Budget uses `startDate` + `endDate` instead of `month`, enabling flexible date ranges
3. When creating/editing an expense in the ledger, if the selected category has an active budget covering the transaction date, the user can choose which budget to link
4. From the budget management page, each budget row has a "记录支出" button that expands an inline form
5. The inline form includes amount (required), description (optional), and date (defaults to today)
6. Editing a transaction also allows changing the budget link
7. Changing a transaction's category clears or re-validates the linked budgetId
8. Deleting a budget sets linked transactions' `budgetId` to null (`onDelete: SetNull`)

## Schema Changes

### Budget: replace `month` with `startDate` + `endDate`

```prisma
model Budget {
  // ... keep existing fields except month ...
  startDate  DateTime @map("start_date")
  endDate    DateTime @map("end_date")
  
  // Remove: period, month
  // Remove: @@unique([userId, categoryId, month])
  // Keep: @@index([userId, startDate, endDate])
}
```

### Transaction: add `budgetId`

```prisma
model Transaction {
  // ... existing fields ...
  budgetId    String?   @map("budget_id")
  budget      Budget?   @relation(fields: [budgetId], references: [id], onDelete: SetNull)
}
```

### Migration strategy

Existing `month` values are mapped to date ranges:
- `month = "2026-06"` → `startDate = "2026-06-01"`, `endDate = "2026-06-30"` (last calendar day of month)

## Implementation

### 1. Budget Actions (`src/lib/actions/budget.ts`)

**`getBudgets`**: Change parameter from `month: string` to `date: string` (ISO date). Query budgets where `startDate <= date <= endDate`.

**`createBudget`**: Accept `startDate` + `endDate` instead of `month`.

**`updateBudget`**: Accept optional `startDate` + `endDate` updates.

**`getBudgetProgress`**: For each budget, spent amount = sum of transactions matching:
```
(budgetId = <current budget> OR (budgetId IS NULL AND categoryId = <budget's categoryId>))
AND occurredAt BETWEEN budget.startDate AND budget.endDate
```

**`getBudgetsForCategory(date: string, categoryId: string)`**: Find budgets where the given date falls within `[startDate, endDate]` and category matches. Used by the ledger form dropdown.

### 2. Ledger Actions (`src/lib/actions/ledger.ts`)

- `createTransaction`: accept optional `budgetId`
- `updateTransaction`: accept optional `budgetId` (including `null` to unlink)
- `getTransactions`: include `budgetId` in returned data

### 3. Budget Manager (`src/app/management/budget/BudgetManager.tsx`)

- **Create form**: Add `startDate` and `endDate` date pickers (in addition to existing name, category, amount fields)
- **Edit form**: Allow editing date range
- **Each budget row**: Add "记录支出" button → expands inline form with:
  - Amount (required)
  - Description (optional)
  - Date (defaults to today)
- On inline form save: call `createTransaction` with `type=EXPENSE`, `categoryId`, `budgetId`, `occurredAt`

### 4. Ledger Manager (`src/app/management/ledger/LedgerManager.tsx`)

- In expense create/edit form: after category and date are set, fetch budgets covering that date + category
- Show budget dropdown listing matching budgets (optional)
- **Edge case**: changing category clears budgetId; changing date re-fetches budgets
- Pass `budgetId` to create/update

## Files Modified

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Budget: replace `month` with `startDate`/`endDate`; Transaction: add `budgetId` with `onDelete: SetNull` |
| `src/lib/actions/ledger.ts` | Accept `budgetId` in create/update |
| `src/lib/actions/budget.ts` | Replace `month` with date range throughout; update progress logic; add `getBudgetsForCategory` |
| `src/app/management/budget/BudgetManager.tsx` | Add date pickers to create/edit; add inline expense form per row |
| `src/app/management/budget/page.tsx` | Pass date instead of month |
| `src/app/management/ledger/LedgerManager.tsx` | Add budget selector; clear on category change |
| `src/components/widgets/BudgetTracker.tsx` | No changes (receives pre-calculated progress) |
| `src/app/(dashboard)/DashboardClient.tsx` | Update `getBudgetProgress` call signature |

## Verification

1. Create budget with start/end dates → expense within range + matching category → budget dropdown appears → link → save
2. Budget page → click "记录支出" → fill amount + date → save → appears in expense list and progress
3. Edit transaction → change category → budgetId clears → select new budget → save
4. Delete budget → linked transactions remain, `budgetId` = null
5. Multiple budgets under same category with different date ranges → each only counts expenses in its range
6. Existing budgets migrated correctly (month → startDate/endDate)
