import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
  getLiabilities,
  createLiability,
  deleteLiability,
} from '@/lib/actions/liabilities';
import { revalidatePath } from 'next/cache';

export default async function LiabilityManagementPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const res = await getLiabilities();
  const liabilities = (res.success ? res.data : []) ?? [];

  async function handleCreate(formData: FormData) {
    'use server';
    await createLiability({
      name: formData.get('name') as string,
      category: formData.get('category') as string,
      principal: formData.get('principal') as string,
      currentBalance: (formData.get('currentBalance') as string) || undefined,
      interestRate: formData.get('interestRate') as string,
      termMonths: Number(formData.get('termMonths')),
      startDate: formData.get('startDate') as string,
      paymentMethod: (formData.get('paymentMethod') as string) || 'equal_interest',
    });
    revalidatePath('/management/liabilities');
  }

  async function handleDelete(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    await deleteLiability(id);
    revalidatePath('/management/liabilities');
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-white">负债管理</h1>

      {/* Create form */}
      <form
        action={handleCreate}
        className="mb-8 rounded-xl bg-ledger-surface p-4 flex flex-wrap gap-3 items-end"
      >
        <div>
          <label className="block text-xs text-ledger-muted mb-1">名称</label>
          <input
            name="name"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="负债名称"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">分类</label>
          <input
            name="category"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="分类"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">本金</label>
          <input
            name="principal"
            type="number"
            step="0.01"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">当前余额</label>
          <input
            name="currentBalance"
            type="number"
            step="0.01"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="默认等于本金"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">年利率</label>
          <input
            name="interestRate"
            type="number"
            step="0.0001"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="0.05"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">期限（月）</label>
          <input
            name="termMonths"
            type="number"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="12"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">开始日期</label>
          <input
            name="startDate"
            type="date"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">还款方式</label>
          <select
            name="paymentMethod"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
          >
            <option value="equal_interest">等额本息</option>
            <option value="equal_principal">等额本金</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-ledger-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          创建
        </button>
      </form>

      {/* Table */}
      <div className="rounded-xl bg-ledger-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ledger-bg text-left text-ledger-muted">
              <th className="px-4 py-3 font-medium">名称</th>
              <th className="px-4 py-3 font-medium">分类</th>
              <th className="px-4 py-3 font-medium">本金</th>
              <th className="px-4 py-3 font-medium">当前余额</th>
              <th className="px-4 py-3 font-medium">年利率</th>
              <th className="px-4 py-3 font-medium">期限</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {liabilities.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-ledger-muted"
                >
                  暂无负债
                </td>
              </tr>
            )}
            {liabilities.map((liability) => (
              <tr
                key={liability.id}
                className="border-b border-ledger-bg last:border-0"
              >
                <td className="px-4 py-3 text-white">{liability.name}</td>
                <td className="px-4 py-3 text-ledger-muted">
                  {liability.category}
                </td>
                <td className="px-4 py-3 text-white">
                  {liability.principal}
                </td>
                <td className="px-4 py-3 text-white">
                  {liability.currentBalance}
                </td>
                <td className="px-4 py-3 text-ledger-muted">
                  {liability.interestRate?.toString?.() || String(liability.interestRate)}
                </td>
                <td className="px-4 py-3 text-ledger-muted">
                  {liability.termMonths} 个月
                </td>
                <td className="px-4 py-3">
                  <form action={handleDelete}>
                    <input type="hidden" name="id" value={liability.id} />
                    <button
                      type="submit"
                      className="text-ledger-danger hover:underline text-xs"
                    >
                      删除
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
