export const dynamic = 'force-dynamic';

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getLiabilities } from '@/lib/actions/liabilities';
import { getTransactions } from '@/lib/actions/ledger';
import { getAssets } from '@/lib/actions/assets';
import LiabilityManager from './LiabilityManager';
import RepaymentSimulator from '@/components/widgets/RepaymentSimulator';

export default async function LiabilityManagementPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const [liabilitiesRes, transactionsRes, assetsRes] = await Promise.all([
    getLiabilities(),
    getTransactions(),
    getAssets(),
  ]);

  if (!liabilitiesRes.success) {
    redirect('/login');
  }

  const liabilities = liabilitiesRes.data ?? [];
  const transactions = (transactionsRes.success ? transactionsRes.data : []) ?? [];
  const assets = (assetsRes.success ? assetsRes.data : []) ?? [];

  return (
    <div>
      <LiabilityManager
        liabilities={liabilities}
        transactions={transactions}
        assets={assets}
      />
      <RepaymentSimulator liabilities={liabilities} />
    </div>
  );
}
