import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const accountViewSource = readFileSync(
  resolve(process.cwd(), 'src/components/widgets/AccountViewLayer.tsx'),
  'utf8',
);
const ledgerSource = readFileSync(
  resolve(process.cwd(), 'src/app/management/ledger/LedgerManager.tsx'),
  'utf8',
);
const dashboardSummarySource = readFileSync(
  resolve(process.cwd(), 'src/components/widgets/FamilySafetySummary.tsx'),
  'utf8',
);
const budgetManagerSource = readFileSync(
  resolve(process.cwd(), 'src/app/management/budget/BudgetManager.tsx'),
  'utf8',
);
const budgetTrackerSource = readFileSync(
  resolve(process.cwd(), 'src/components/widgets/BudgetTracker.tsx'),
  'utf8',
);
const assetManagerSource = readFileSync(
  resolve(process.cwd(), 'src/app/management/assets/AssetManager.tsx'),
  'utf8',
);

assert(
  accountViewSource.includes('资金账户') &&
    accountViewSource.includes('资金流水') &&
    accountViewSource.includes('当前资金账户'),
  'Asset management should use fund-account wording instead of ambiguous login-account wording.',
);

assert(
  accountViewSource.includes('missingSourceTransactions') &&
    accountViewSource.includes('待补来源资金账户') &&
    accountViewSource.includes('/management/ledger?needsSource=1'),
  'Fund account layer should surface expenses that still need a source account and route to the ledger fix flow.',
);

assert(
  ledgerSource.includes("import { useSearchParams } from 'next/navigation';") &&
    ledgerSource.includes('needsSource') &&
    ledgerSource.includes('showNeedsSourceOnly') &&
    ledgerSource.includes('visibleTransactions'),
  'Ledger should support a deep-linked needs-source filter.',
);

assert(
  ledgerSource.includes('待补来源资金账户') &&
    ledgerSource.includes('只看待补来源') &&
    ledgerSource.includes('显示全部流水') &&
    ledgerSource.includes('visibleTransactions.map'),
  'Ledger should expose and apply the needs-source filter in the transaction table.',
);

assert(
  dashboardSummarySource.includes('/management/ledger?focus=create') &&
    dashboardSummarySource.includes('/management/budget?focus=over') &&
    dashboardSummarySource.includes('/management/ledger?needsSource=1') &&
    dashboardSummarySource.includes('/management/assets?focus=liquidity') &&
    dashboardSummarySource.includes('/management/assets?focus=prices') &&
    dashboardSummarySource.includes('/management/budget?focus=create') &&
    dashboardSummarySource.includes('/management/budget?focus=review'),
  'Family safety next actions should deep-link into the exact work mode for cashflow, missing source accounts, budget, liquidity, prices, and review.',
);

assert(
  budgetManagerSource.includes("import { useSearchParams } from 'next/navigation';") &&
    budgetManagerSource.includes('budgetFocus') &&
    budgetManagerSource.includes('预算行动') &&
    budgetManagerSource.includes('先处理超支预算') &&
    budgetManagerSource.includes('先建立本月预算') &&
    budgetManagerSource.includes('focus={budgetFocus}'),
  'Budget management should read action focus from the URL and explain the budget work to do next.',
);

assert(
  budgetTrackerSource.includes('focus?:') &&
    budgetTrackerSource.includes("focus === 'over'") &&
    budgetTrackerSource.includes('progress.find((p) => p.isOverBudget)') &&
    budgetTrackerSource.includes('focusedOverBudgetId') &&
    budgetTrackerSource.includes('activeExpandedId'),
  'Budget tracker should automatically expand the first over-budget item when linked from the home action plan.',
);

assert(
  assetManagerSource.includes("import { useSearchParams } from 'next/navigation';") &&
    assetManagerSource.includes('assetFocus') &&
    assetManagerSource.includes('资产行动') &&
    assetManagerSource.includes('补足一级流动性') &&
    assetManagerSource.includes('刷新资产价格') &&
    assetManagerSource.includes('tier1Total'),
  'Asset management should read action focus from the URL and surface liquidity or price-refresh work clearly.',
);

assert(
  assetManagerSource.includes('createAssetDefaults') &&
    assetManagerSource.includes("category: 'current_deposit'") &&
    assetManagerSource.includes('家庭备用金') &&
    assetManagerSource.includes('defaultValue={createAssetDefaults.category}') &&
    assetManagerSource.includes('placeholder={createAssetDefaults.namePlaceholder}'),
  'Liquidity action should make the asset creation form start from a bank/current-deposit account instead of a blank category.',
);

assert(
  ledgerSource.includes("searchParams.get('focus') === 'create'") &&
    ledgerSource.includes('isCreateFocus') &&
    ledgerSource.includes('流水行动') &&
    ledgerSource.includes('先补齐本月流水'),
  'Ledger should support a home action deep-link that focuses users on recording cashflow.',
);

assert(
  dashboardSummarySource.includes('href="/management/ledger?focus=create"') &&
    dashboardSummarySource.includes('>记一笔</Link>'),
  'Family safety quick record button should open the ledger in create-focus mode.',
);

assert(
  dashboardSummarySource.includes('evidenceItems') &&
    dashboardSummarySource.includes('判断依据') &&
    dashboardSummarySource.includes('现金流') &&
    dashboardSummarySource.includes('账户记录') &&
    dashboardSummarySource.includes('待补流水') &&
    dashboardSummarySource.includes('待补来源'),
  'Family safety summary should explain the safety verdict with compact evidence for cashflow, liquidity, budget, and account records.',
);

assert(
  dashboardSummarySource.includes('primaryAction') &&
    dashboardSummarySource.includes('secondaryActions') &&
    dashboardSummarySource.includes('优先做这件事'),
  'Family safety summary should name the single most important next action before listing secondary actions.',
);

assert(
  dashboardSummarySource.includes('dataConfidenceItems') &&
    dashboardSummarySource.includes('判断可信度') &&
    dashboardSummarySource.includes('判断依据完整') &&
    dashboardSummarySource.includes('待补数据'),
  'Family safety summary should tell users whether the verdict is based on complete enough household data.',
);

assert(
  ledgerSource.includes('const showNeedsSourceOnly = needsSourceFromQuery') &&
    ledgerSource.includes('href="/management/ledger?needsSource=1"') &&
    ledgerSource.includes('href="/management/ledger"'),
  'Ledger needs-source filter should use the URL query as the source of truth so deep links and buttons stay synchronized.',
);

assert(
  ledgerSource.includes('不指定（只记总收支）') &&
    budgetManagerSource.includes('不指定（只记总收支）') &&
    budgetTrackerSource.includes('不指定（只记总收支）'),
  'Every source-account selector should explain that leaving it blank records only broad income/expense.',
);

assert(
  !/<label[^>]*>分类<\/label>[\s\S]{0,420}<option value="">不指定（只记总收支）<\/option>/.test(ledgerSource),
  'Ledger category selectors should keep a neutral blank option; broad income/expense copy only belongs to source-account selectors.',
);
