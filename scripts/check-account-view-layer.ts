import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const assetManagerSource = readFileSync(
  resolve(process.cwd(), 'src/app/management/assets/AssetManager.tsx'),
  'utf8',
);
const accountViewSource = readFileSync(
  resolve(process.cwd(), 'src/components/widgets/AccountViewLayer.tsx'),
  'utf8',
);

assert(
  assetManagerSource.includes("import AccountViewLayer from '@/components/widgets/AccountViewLayer';"),
  'Asset management should import the account view layer.',
);

assert(
  assetManagerSource.includes("import { useTransactions } from '@/hooks/useTransactions';") &&
    assetManagerSource.includes('<AccountViewLayer') &&
    assetManagerSource.includes('transactions={accountTransactions}'),
  'Asset management should pass linked transaction data into AccountViewLayer.',
);

assert(
  accountViewSource.includes('资金账户') &&
    accountViewSource.includes('资金流水') &&
    accountViewSource.includes('本月流入') &&
    accountViewSource.includes('本月流出') &&
    accountViewSource.includes('净流入') &&
    accountViewSource.includes('最近流水'),
  'Account view layer should expose fund account, fund ledger, and monthly flow copy.',
);

assert(
  accountViewSource.includes('selectedAccountId') &&
    accountViewSource.includes('accountTransactions') &&
    accountViewSource.includes('fromAccountId') &&
    accountViewSource.includes('toAccountId'),
  'Account view layer should select one account and derive linked transactions by source/target account.',
);

assert(
  accountViewSource.includes('/management/ledger') &&
    accountViewSource.includes('/management/assets'),
  'Account view layer should provide navigation to ledger and asset management work areas.',
);
