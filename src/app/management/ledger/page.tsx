import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
  getTransactions,
  createTransaction,
  deleteTransaction,
} from '@/lib/actions/ledger';
import { getAssets } from '@/lib/actions/assets';
import { getCategories } from '@/lib/actions/categories';
import { revalidatePath } from 'next/cache';

export default async function LedgerManagementPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const [txRes, assetsRes, categoriesRes] = await Promise.all([
    getTransactions(),
    getAssets(),
    getCategories(),
  ]);

  const transactions = (txRes.success ? txRes.data : []) ?? [];
  const assets = (assetsRes.success ? assetsRes.data : []) ?? [];
  const categories = (categoriesRes.success ? categoriesRes.data : []) ?? [];

  async function handleCreate(formData: FormData) {
    'use server';
    await createTransaction({
      type: formData.get('type') as string,
      amount: formData.get('amount') as string,
      categoryId: (formData.get('categoryId') as string) || undefined,
      fromAccountId: (formData.get('fromAccountId') as string) || undefined,
      toAccountId: (formData.get('toAccountId') as string) || undefined,
      description: (formData.get('description') as string) || undefined,
      occurredAt: formData.get('occurredAt') as string,
    });
    revalidatePath('/management/ledger');
  }

  async function handleDelete(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    await deleteTransaction(id);
    revalidatePath('/management/ledger');
  }

  const typeBadgeClass = (type: string) => {
    switch (type) {
      case 'INCOME':
        return 'bg-emerald-900/50 text-ledger-success';
      case 'EXPENSE':
        return 'bg-red-900/50 text-ledger-danger';
      case 'TRANSFER':
        return 'bg-blue-900/50 text-ledger-accent';
      default:
        return 'bg-ledger-bg text-ledger-muted';
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case 'INCOME':
        return '收入';
      case 'EXPENSE':
        return '支出';
      case 'TRANSFER':
        return '转账';
      default:
        return type;
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-white">流水管理</h1>

      {/* Create form */}
      <form
        action={handleCreate}
        className="mb-8 rounded-xl bg-ledger-surface p-4 flex flex-wrap gap-3 items-end"
      >
        <div>
          <label className="block text-xs text-ledger-muted mb-1">类型</label>
          <select
            name="type"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
          >
            <option value="EXPENSE">支出</option>
            <option value="INCOME">收入</option>
            <option value="TRANSFER">转账</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">金额</label>
          <input
            name="amount"
            type="number"
            step="0.01"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">分类</label>
          <select
            name="categoryId"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
          >
            <option value="">--</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">来源账户</label>
          <select
            name="fromAccountId"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
          >
            <option value="">--</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">目标账户</label>
          <select
            name="toAccountId"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
          >
            <option value="">--</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">日期</label>
          <input
            name="occurredAt"
            type="date"
            required
            defaultValue={new Date().toISOString().split('T')[0]}
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white focus:outline-none focus:border-ledger-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">备注</label>
          <input
            name="description"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="备注"
          />
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
              <th className="px-4 py-3 font-medium">类型</th>
              <th className="px-4 py-3 font-medium">金额</th>
              <th className="px-4 py-3 font-medium">分类</th>
              <th className="px-4 py-3 font-medium">来源</th>
              <th className="px-4 py-3 font-medium">目标</th>
              <th className="px-4 py-3 font-medium">日期</th>
              <th className="px-4 py-3 font-medium">备注</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-ledger-muted"
                >
                  暂无流水
                </td>
              </tr>
            )}
            {transactions.map((t) => (
              <tr
                key={t.id}
                className="border-b border-ledger-bg last:border-0"
              >
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClass(t.type)}`}
                  >
                    {typeLabel(t.type)}
                  </span>
                </td>
                <td className="px-4 py-3 text-white">{t.amount}</td>
                <td className="px-4 py-3 text-ledger-muted">
                  {t.category?.name || '--'}
                </td>
                <td className="px-4 py-3 text-ledger-muted">
                  {t.fromAsset?.name || '--'}
                </td>
                <td className="px-4 py-3 text-ledger-muted">
                  {t.toAsset?.name || '--'}
                </td>
                <td className="px-4 py-3 text-ledger-muted">
                  {new Date(t.occurredAt).toLocaleDateString('zh-CN')}
                </td>
                <td className="px-4 py-3 text-ledger-muted">
                  {t.description || '--'}
                </td>
                <td className="px-4 py-3">
                  <form action={handleDelete}>
                    <input type="hidden" name="id" value={t.id} />
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
