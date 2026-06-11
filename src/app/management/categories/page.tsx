import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
  getCategories,
  createCategory,
  deleteCategory,
} from '@/lib/actions/categories';
import { revalidatePath } from 'next/cache';

export default async function CategoryManagementPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const res = await getCategories();
  const categories = (res.success ? res.data : []) ?? [];

  async function handleCreate(formData: FormData) {
    'use server';
    await createCategory({
      name: formData.get('name') as string,
      type: formData.get('type') as string,
      icon: (formData.get('icon') as string) || undefined,
      color: (formData.get('color') as string) || undefined,
      isEssential: formData.get('isEssential') === 'on',
    });
    revalidatePath('/management/categories');
  }

  async function handleDelete(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    await deleteCategory(id);
    revalidatePath('/management/categories');
  }

  const typeLabel = (type: string) => {
    switch (type) {
      case 'INCOME':
        return '收入';
      case 'EXPENSE':
        return '支出';
      default:
        return type;
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-white">分类管理</h1>

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
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="分类名称"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">类型</label>
          <select
            name="type"
            required
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm focus:outline-none focus:border-ledger-accent"
          >
            <option value="EXPENSE">支出</option>
            <option value="INCOME">收入</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">图标</label>
          <input
            name="icon"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:outline-none focus:border-ledger-accent"
            placeholder="图标名称"
          />
        </div>
        <div>
          <label className="block text-xs text-ledger-muted mb-1">颜色</label>
          <input
            name="color"
            type="color"
            defaultValue="#3b82f6"
            className="rounded-md bg-ledger-bg border border-ledger-bg px-2 py-1.5 text-sm focus:outline-none focus:border-ledger-accent h-[34px] w-[60px]"
          />
        </div>
        <div className="flex items-center pb-2">
          <input
            name="isEssential"
            type="checkbox"
            id="isEssential"
            className="rounded border-ledger-bg bg-ledger-bg text-ledger-accent focus:ring-ledger-accent"
          />
          <label
            htmlFor="isEssential"
            className="ml-2 text-sm text-ledger-muted"
          >
            必要支出
          </label>
        </div>
        <button
          type="submit"
          className="rounded-md bg-ledger-accent px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
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
              <th className="px-4 py-3 font-medium">类型</th>
              <th className="px-4 py-3 font-medium">图标</th>
              <th className="px-4 py-3 font-medium">颜色</th>
              <th className="px-4 py-3 font-medium">必要</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-ledger-muted"
                >
                  暂无分类
                </td>
              </tr>
            )}
            {categories.map((category) => (
              <tr
                key={category.id}
                className="border-b border-ledger-bg last:border-0"
              >
                <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>{category.name}</td>
                <td className="px-4 py-3 text-ledger-muted">
                  {typeLabel(category.type)}
                </td>
                <td className="px-4 py-3 text-ledger-muted">
                  {category.icon || '--'}
                </td>
                <td className="px-4 py-3">
                  {category.color ? (
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="text-ledger-muted text-xs">
                        {category.color}
                      </span>
                    </span>
                  ) : (
                    '--'
                  )}
                </td>
                <td className="px-4 py-3">
                  {category.isEssential ? (
                    <span className="text-ledger-success text-xs">是</span>
                  ) : (
                    <span className="text-ledger-muted text-xs">否</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <form action={handleDelete}>
                    <input type="hidden" name="id" value={category.id} />
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
