'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useSWRConfig } from 'swr';
import { AmountDisplay } from '@/components/common/AmountDisplay';
import { createGoal, deleteGoal, getGoals, updateGoal } from '@/lib/actions/goals';
import { useAssets } from '@/hooks/useAssets';

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  assetId?: string | null;
  deadline?: string | Date | null;
  icon?: string | null;
  color?: string | null;
  asset?: { name?: string | null } | null;
}

interface AssetOption {
  id: string;
  name: string;
}

function fmtDate(value?: string | Date | null) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function parseAmount(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function goalProgress(goal: Goal) {
  const target = parseAmount(goal.targetAmount);
  const current = parseAmount(goal.currentAmount);
  return target > 0 ? Math.min((current / target) * 100, 100) : 0;
}

export default function GoalManager() {
  const { mutate } = useSWRConfig();
  const { data: goalData } = useSWR('goals', async () => {
    const result = await getGoals();
    if (!result.success) throw new Error(result.error || '获取储蓄目标失败');
    return result.data ?? [];
  });
  const goals: Goal[] = goalData ?? [];
  const { data: assetData } = useAssets();
  const assets: AssetOption[] = assetData?.data ?? [];
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    targetAmount: '',
    currentAmount: '',
    assetId: '',
    deadline: '',
    icon: '',
    color: '#14b8a6',
  });

  async function refreshGoals() {
    await mutate('goals');
  }

  function showSuccess(message: string) {
    setSuccessMsg(message);
    window.setTimeout(() => setSuccessMsg(''), 2200);
  }

  async function handleCreate(formData: FormData) {
    setError('');
    const result = await createGoal({
      name: formData.get('name') as string,
      targetAmount: formData.get('targetAmount') as string,
      currentAmount: (formData.get('currentAmount') as string) || undefined,
      assetId: (formData.get('assetId') as string) || undefined,
      deadline: (formData.get('deadline') as string) || undefined,
      icon: (formData.get('icon') as string) || undefined,
      color: (formData.get('color') as string) || undefined,
    });

    if (result.success) {
      (document.getElementById('goal-form') as HTMLFormElement)?.reset();
      await refreshGoals();
      showSuccess('储蓄目标已创建');
    } else {
      setError(result.error || '创建失败');
    }
  }

  function startEdit(goal: Goal) {
    setEditingId(goal.id);
    setEditForm({
      name: goal.name,
      targetAmount: String(goal.targetAmount ?? ''),
      currentAmount: String(goal.currentAmount ?? ''),
      assetId: goal.assetId || '',
      deadline: fmtDate(goal.deadline),
      icon: goal.icon || '',
      color: goal.color || '#14b8a6',
    });
  }

  async function handleUpdate() {
    if (!editingId) return;
    setError('');
    const result = await updateGoal(editingId, editForm);
    if (result.success) {
      setEditingId(null);
      await refreshGoals();
      showSuccess('储蓄目标已更新');
    } else {
      setError(result.error || '更新失败');
    }
  }

  async function handleDelete(formData: FormData) {
    setError('');
    const id = formData.get('id') as string;
    const result = await deleteGoal(id);
    if (result.success) {
      await refreshGoals();
      showSuccess('储蓄目标已删除');
    } else {
      setError(result.error || '删除失败');
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>储蓄目标管理</h1>
          <p className="mt-1 text-sm text-ledger-muted">维护目标金额、当前进度、截止日期和关联资金账户。</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-red-500/10 px-4 py-3 text-sm text-ledger-danger">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="text-ledger-muted hover:text-white">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-400">
          ✓ {successMsg}
        </div>
      )}

      <form
        id="goal-form"
        action={handleCreate}
        className="mb-8 flex flex-wrap items-end gap-3 rounded-xl bg-ledger-surface p-4"
      >
        <div>
          <label className="mb-1 block text-xs text-ledger-muted">名称</label>
          <input
            name="name"
            required
            className="rounded-md border border-ledger-bg bg-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:border-ledger-accent focus:outline-none"
            placeholder="如：家庭应急金"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ledger-muted">目标金额</label>
          <input
            name="targetAmount"
            type="text"
            inputMode="decimal"
            required
            className="rounded-md border border-ledger-bg bg-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:border-ledger-accent focus:outline-none"
            placeholder="180000"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ledger-muted">当前已存</label>
          <input
            name="currentAmount"
            type="text"
            inputMode="decimal"
            className="rounded-md border border-ledger-bg bg-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:border-ledger-accent focus:outline-none"
            placeholder="0"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ledger-muted">关联账户</label>
          <select
            name="assetId"
            className="rounded-md border border-ledger-bg bg-ledger-bg px-3 py-2 text-sm focus:border-ledger-accent focus:outline-none"
          >
            <option value="">不关联</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>{asset.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-ledger-muted">截止日期</label>
          <input
            name="deadline"
            type="date"
            className="rounded-md border border-ledger-bg bg-ledger-bg px-3 py-2 text-sm focus:border-ledger-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ledger-muted">图标</label>
          <input
            name="icon"
            className="w-20 rounded-md border border-ledger-bg bg-ledger-bg px-3 py-2 text-sm placeholder-ledger-muted focus:border-ledger-accent focus:outline-none"
            placeholder="应"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ledger-muted">颜色</label>
          <input
            name="color"
            type="color"
            defaultValue="#14b8a6"
            className="h-[38px] w-[60px] rounded-md border border-ledger-bg bg-ledger-bg px-2 py-1.5 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-ledger-accent px-4 py-2 text-sm font-medium text-[var(--color-text-inverse)] transition-opacity hover:opacity-90"
        >
          创建
        </button>
      </form>

      {goals.length === 0 ? (
        <div className="rounded-xl bg-ledger-surface px-4 py-8 text-center text-sm text-ledger-muted">
          暂无储蓄目标。先创建一个应急金、旅行金或教育金目标。
        </div>
      ) : (
        <div className="grid gap-3">
          {goals.map((goal) => {
            const progress = goalProgress(goal);
            const isEditing = editingId === goal.id;
            const goalColor = goal.color || '#14b8a6';

            return (
              <article
                key={goal.id}
                className={`rounded-xl bg-ledger-surface p-4 ${isEditing ? 'ring-1 ring-ledger-accent/40' : ''}`}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="grid gap-3 md:grid-cols-[minmax(180px,1fr)_80px_64px]">
                        <label className="block">
                          <span className="mb-1 block text-xs text-ledger-muted">目标名称</span>
                          <input
                            value={editForm.name}
                            onChange={event => setEditForm(prev => ({ ...prev, name: event.target.value }))}
                            className="w-full rounded-md border border-ledger-bg bg-ledger-bg px-3 py-2 text-sm focus:border-ledger-accent focus:outline-none"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs text-ledger-muted">图标</span>
                          <input
                            value={editForm.icon}
                            onChange={event => setEditForm(prev => ({ ...prev, icon: event.target.value }))}
                            className="w-full rounded-md border border-ledger-bg bg-ledger-bg px-3 py-2 text-sm focus:border-ledger-accent focus:outline-none"
                            placeholder="图标"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs text-ledger-muted">颜色</span>
                          <input
                            type="color"
                            value={editForm.color}
                            onChange={event => setEditForm(prev => ({ ...prev, color: event.target.value }))}
                            className="h-[38px] w-full rounded-md border border-ledger-bg bg-ledger-bg px-2 py-1.5 focus:outline-none"
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base font-semibold"
                          style={{ backgroundColor: `${goalColor}1F`, color: goalColor }}
                        >
                          {goal.icon || '目'}
                        </span>
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <h2 className="truncate text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                              {goal.name}
                            </h2>
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: goalColor }} />
                          </div>
                          <p className="mt-1 text-xs text-ledger-muted">
                            关联账户 {goal.asset?.name || '未关联'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    {isEditing ? (
                      <>
                        <button type="button" onClick={handleUpdate} className="text-sm font-medium text-ledger-accent hover:underline">保存</button>
                        <button type="button" onClick={() => setEditingId(null)} className="text-sm text-ledger-muted hover:text-[var(--color-text-primary)]">取消</button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => startEdit(goal)} className="text-sm font-medium text-ledger-accent hover:underline">编辑</button>
                        <form action={handleDelete}>
                          <input type="hidden" name="id" value={goal.id} />
                          <button type="submit" className="text-sm text-ledger-danger hover:underline">删除</button>
                        </form>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-end justify-between gap-3">
                    <div>
                      <div className="text-xs text-ledger-muted">进度</div>
                      <div className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {progress.toFixed(0)}%
                      </div>
                    </div>
                    <div className="text-right text-xs text-ledger-muted">
                      <AmountDisplay amount={goal.currentAmount} /> / <AmountDisplay amount={goal.targetAmount} />
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-ledger-bg">
                    <div
                      className="h-full rounded-full transition-[width]"
                      style={{ width: `${progress}%`, backgroundColor: goalColor }}
                    />
                  </div>
                </div>

                {isEditing ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <label className="block">
                      <span className="mb-1 block text-xs text-ledger-muted">当前已存</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editForm.currentAmount}
                        onChange={event => setEditForm(prev => ({ ...prev, currentAmount: event.target.value }))}
                        className="w-full rounded-md border border-ledger-bg bg-ledger-bg px-3 py-2 text-sm focus:border-ledger-accent focus:outline-none"
                        placeholder="已存"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-ledger-muted">目标金额</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editForm.targetAmount}
                        onChange={event => setEditForm(prev => ({ ...prev, targetAmount: event.target.value }))}
                        className="w-full rounded-md border border-ledger-bg bg-ledger-bg px-3 py-2 text-sm focus:border-ledger-accent focus:outline-none"
                        placeholder="目标"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-ledger-muted">关联账户</span>
                      <select
                        value={editForm.assetId}
                        onChange={event => setEditForm(prev => ({ ...prev, assetId: event.target.value }))}
                        className="w-full rounded-md border border-ledger-bg bg-ledger-bg px-3 py-2 text-sm focus:border-ledger-accent focus:outline-none"
                      >
                        <option value="">不关联</option>
                        {assets.map((asset) => (
                          <option key={asset.id} value={asset.id}>{asset.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-ledger-muted">截止日期</span>
                      <input
                        type="date"
                        value={editForm.deadline}
                        onChange={event => setEditForm(prev => ({ ...prev, deadline: event.target.value }))}
                        className="w-full rounded-md border border-ledger-bg bg-ledger-bg px-3 py-2 text-sm focus:border-ledger-accent focus:outline-none"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                    <div>
                      <div className="text-xs text-ledger-muted">当前已存</div>
                      <div className="mt-1 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        <AmountDisplay amount={goal.currentAmount} />
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-ledger-muted">目标金额</div>
                      <div className="mt-1 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        <AmountDisplay amount={goal.targetAmount} />
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-ledger-muted">截止日期</div>
                      <div className="mt-1 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {goal.deadline ? new Date(goal.deadline).toLocaleDateString('zh-CN') : '未设置'}
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
