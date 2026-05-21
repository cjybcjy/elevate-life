import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAssets, createAsset, deleteAsset } from '@/lib/actions/assets';
import { revalidatePath } from 'next/cache';

export default async function AssetManagementPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const res = await getAssets();
  const assets = (res.success ? res.data : []) ?? [];

  async function handleCreate(formData: FormData) {
    'use server';
    await createAsset({
      name: formData.get('name') as string,
      category: formData.get('category') as string,
      balance: formData.get('balance') as string,
      currency: (formData.get('currency') as string) || 'CNY',
    });
    revalidatePath('/management/assets');
  }

  async function handleDelete(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    await deleteAsset(id);
    revalidatePath('/management/assets');
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-white">资产管理</h1>

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
            placeholder="资产名称"
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
          <label className="block text-xs text-ledger-muted mb-1">余额</label>
          <input
            name="balance"
            type="number"
            step="0.01"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">币种</label>
          <input
            name="currency"
            defaultValue="CNY"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm text-white placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="CNY"
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
              <th className="px-4 py-3 font-medium">名称</th>
              <th className="px-4 py-3 font-medium">分类</th>
              <th className="px-4 py-3 font-medium">余额</th>
              <th className="px-4 py-3 font-medium">币种</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-ledger-muted"
                >
                  暂无资产
                </td>
              </tr>
            )}
            {assets.map((asset) => (
              <tr
                key={asset.id}
                className="border-b border-ledger-bg last:border-0"
              >
                <td className="px-4 py-3 text-white">{asset.name}</td>
                <td className="px-4 py-3 text-ledger-muted">
                  {asset.category}
                </td>
                <td className="px-4 py-3 text-white">{asset.balance}</td>
                <td className="px-4 py-3 text-ledger-muted">
                  {asset.currency}
                </td>
                <td className="px-4 py-3">
                  <form action={handleDelete}>
                    <input type="hidden" name="id" value={asset.id} />
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
