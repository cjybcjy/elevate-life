import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dashboardSource = readFileSync(
  resolve(process.cwd(), 'src/app/(dashboard)/DashboardClient.tsx'),
  'utf8',
);
const summarySource = readFileSync(
  resolve(process.cwd(), 'src/components/widgets/FamilySafetySummary.tsx'),
  'utf8',
);

assert(
  dashboardSource.includes("import FamilySafetySummary from '@/components/widgets/FamilySafetySummary';"),
  'Dashboard should import the family safety summary widget.',
);

assert(
  dashboardSource.includes('<FamilySafetySummary') &&
    dashboardSource.indexOf('<FamilySafetySummary') < dashboardSource.indexOf('<MonthFlow'),
  'Family safety summary should render before month flow and budget widgets.',
);

assert(
  summarySource.includes('家庭财务状态') &&
    summarySource.includes('下一步') &&
    summarySource.includes('一级流动性') &&
    summarySource.includes('预算剩余'),
  'Family safety summary should expose safety status, next actions, liquidity, and budget remaining.',
);

assert(
  summarySource.includes('coverageMonths') &&
    summarySource.includes('statusTone') &&
    summarySource.includes('actionItems'),
  'Family safety summary should derive coverage, status tone, and action items.',
);

assert(
  summarySource.includes('/management/budget') &&
    summarySource.includes('/management/assets') &&
    summarySource.includes('/management/ledger'),
  'Family safety actions should route users to budget, assets, and ledger work areas.',
);
