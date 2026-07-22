'use client';

import type { ComponentType, FormEvent } from 'react';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Armchair,
  Camera,
  CarFront,
  ChevronLeft,
  CircleDollarSign,
  Clock3,
  Package,
  PackageOpen,
  Plus,
  Shirt,
  Smartphone,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { useToast } from '@/components/common/Toast';
import {
  createPossession,
  deletePossession,
  updatePossessionStatus,
  type PossessionRecord,
} from '@/lib/actions/possessions';
import {
  POSSESSION_STATUS_LABELS,
  possessionDailyCost,
  possessionHeldDays,
  type PossessionStatus,
} from '@/lib/possession-metrics';

const CATEGORIES = [
  { value: 'digital', label: '数码', icon: Smartphone },
  { value: 'appliance', label: '家电', icon: Zap },
  { value: 'clothing', label: '衣物', icon: Shirt },
  { value: 'hobby', label: '兴趣', icon: Camera },
  { value: 'vehicle', label: '出行', icon: CarFront },
  { value: 'furniture', label: '家居', icon: Armchair },
  { value: 'other', label: '其他', icon: Package },
] as const;

type FilterValue = 'all' | PossessionStatus;

const FILTERS: Array<{ value: FilterValue; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '使用中' },
  { value: 'idle', label: '闲置' },
  { value: 'sold', label: '已出售' },
  { value: 'retired', label: '已退役' },
];

function getCategory(category: string) {
  return CATEGORIES.find((item) => item.value === category) ?? CATEGORIES.at(-1)!;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: value < 10 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function StatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
    'aria-hidden'?: boolean;
  }>;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border-tertiary)] bg-[var(--color-container)] p-3 shadow-[var(--shadow-xs)]">
      <Icon size={17} strokeWidth={1.8} aria-hidden className="text-[var(--color-text-secondary)]" />
      <div className="mt-2 text-xl font-bold tabular-nums text-[var(--color-text-primary)]">{value}</div>
      <div className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">{label}</div>
    </div>
  );
}

export default function PossessionManager({
  initialItems,
  initialError,
  today,
}: {
  initialItems: PossessionRecord[];
  initialError: string | null;
  today: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<FilterValue>('all');
  const [showCreate, setShowCreate] = useState(initialItems.length === 0);
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visibleItems = useMemo(
    () => initialItems.filter((item) => filter === 'all' || item.status === filter),
    [filter, initialItems],
  );
  const activeCount = initialItems.filter((item) => item.status === 'active').length;
  const idleCount = initialItems.filter((item) => item.status === 'idle').length;

  function refreshAfter(result: { success: boolean; error?: string }, message: string) {
    if (!result.success) {
      toast.error(result.error || '操作失败');
      return false;
    }
    toast.success(message);
    router.refresh();
    return true;
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await createPossession({
        name: String(formData.get('name') || ''),
        category: String(formData.get('category') || ''),
        purchasePrice: String(formData.get('purchasePrice') || ''),
        purchaseDate: String(formData.get('purchaseDate') || ''),
      });
      if (refreshAfter(result, '物品已添加')) {
        form.reset();
        setShowCreate(false);
      }
    });
  }

  function handleStatus(item: PossessionRecord, status: PossessionStatus) {
    if (status === 'sold') {
      setSellingId(item.id);
      return;
    }
    startTransition(async () => {
      const result = await updatePossessionStatus({ id: item.id, status });
      refreshAfter(result, `已标记为${POSSESSION_STATUS_LABELS[status]}`);
    });
  }

  function handleSold(event: FormEvent<HTMLFormElement>, item: PossessionRecord) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updatePossessionStatus({
        id: item.id,
        status: 'sold',
        soldPrice: String(formData.get('soldPrice') || '0'),
        soldDate: String(formData.get('soldDate') || today),
      });
      if (refreshAfter(result, '出售结果已记录')) setSellingId(null);
    });
  }

  function handleDelete(item: PossessionRecord) {
    if (!window.confirm(`删除“${item.name}”吗？此操作无法撤销。`)) return;
    startTransition(async () => {
      const result = await deletePossession(item.id);
      refreshAfter(result, '物品已删除');
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl pb-4 md:pb-8">
      <header className="flex items-start gap-3">
        <button
          type="button"
          aria-label="返回我的"
          onClick={() => router.push('/me')}
          className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-[var(--border-secondary)] bg-[var(--color-container)] text-[var(--color-text-primary)]"
        >
          <ChevronLeft size={20} strokeWidth={1.8} aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">我的物品</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">看清拥有，减少闲置，让物品真正被使用。</p>
        </div>
        <button
          type="button"
          aria-expanded={showCreate}
          onClick={() => setShowCreate((current) => !current)}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-3 text-sm font-semibold text-[var(--color-text-inverse)]"
        >
          {showCreate ? <X size={18} strokeWidth={2} aria-hidden /> : <Plus size={18} strokeWidth={2} aria-hidden />}
          {showCreate ? '收起' : '添加'}
        </button>
      </header>

      {initialError ? (
        <div className="mt-4 rounded-xl border border-[var(--color-danger)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {initialError}
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-3 gap-2">
        <StatCard icon={PackageOpen} value={initialItems.length} label="全部物品" />
        <StatCard icon={Clock3} value={activeCount} label="正在使用" />
        <StatCard icon={CircleDollarSign} value={idleCount} label="等待处理" />
      </div>

      {showCreate ? (
        <form
          onSubmit={handleCreate}
          className="mt-4 grid gap-3 rounded-2xl border border-[var(--border-tertiary)] bg-[var(--color-container)] p-4 shadow-[var(--shadow-xs)]"
        >
          <div>
            <h2 className="text-base font-bold text-[var(--color-text-primary)]">添加一件物品</h2>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">先填四项，立即看到持有天数与日均成本。</p>
          </div>
          <label className="grid gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
            物品名称
            <input
              name="name"
              required
              autoComplete="off"
              placeholder="例如：MacBook Pro"
              className="min-h-11 rounded-xl border border-[var(--border-secondary)] bg-[var(--color-container-inset)] px-3 text-base text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-primary)]"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
              分类
              <select
                name="category"
                defaultValue="digital"
                className="min-h-11 rounded-xl border border-[var(--border-secondary)] bg-[var(--color-container-inset)] px-3 text-base text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-primary)]"
              >
                {CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>{category.label}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
              买入价格
              <input
                name="purchasePrice"
                required
                inputMode="decimal"
                placeholder="0.00"
                className="min-h-11 rounded-xl border border-[var(--border-secondary)] bg-[var(--color-container-inset)] px-3 text-base text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-primary)]"
              />
            </label>
          </div>
          <label className="grid gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
            买入日期
            <input
              name="purchaseDate"
              type="date"
              required
              defaultValue={today}
              max={today}
              className="min-h-11 rounded-xl border border-[var(--border-secondary)] bg-[var(--color-container-inset)] px-3 text-base text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-primary)]"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-text-inverse)] disabled:opacity-50"
          >
            {pending ? '保存中…' : '保存并计算'}
          </button>
        </form>
      ) : null}

      <div className="mt-5 overflow-x-auto pb-1" role="tablist" aria-label="物品状态筛选">
        <div className="flex min-w-max gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={filter === item.value}
              onClick={() => setFilter(item.value)}
              className={`min-h-10 rounded-full border px-4 text-sm font-medium ${
                filter === item.value
                  ? 'border-[var(--color-text-primary)] bg-[var(--color-text-primary)] text-[var(--color-text-inverse)]'
                  : 'border-[var(--border-secondary)] bg-[var(--color-container)] text-[var(--color-text-secondary)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-3 grid gap-3" aria-live="polite">
        {visibleItems.length === 0 ? (
          <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-[var(--border-secondary)] bg-[var(--color-container)] px-6 py-8 text-center">
            <div>
              <PackageOpen size={34} strokeWidth={1.5} aria-hidden className="mx-auto text-[var(--color-text-subdued)]" />
              <h2 className="mt-3 text-base font-bold text-[var(--color-text-primary)]">
                {initialItems.length === 0 ? '从第一件常用物品开始' : '这个状态下还没有物品'}
              </h2>
              <p className="mx-auto mt-1 max-w-xs text-sm text-[var(--color-text-secondary)]">
                {initialItems.length === 0
                  ? '记录价格和日期，系统会每天自动更新它的真实日均成本。'
                  : '切换其他状态，或者调整物品的使用状态。'}
              </p>
              {initialItems.length === 0 && !showCreate ? (
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="mt-4 min-h-11 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-text-inverse)]"
                >
                  添加第一件物品
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          visibleItems.map((item) => {
            const category = getCategory(item.category);
            const Icon = category.icon;
            const heldDays = possessionHeldDays(item.purchaseDate, item.soldDate, new Date(`${today}T12:00:00`));
            const dailyCost = possessionDailyCost({
              purchasePrice: item.purchasePrice,
              purchaseDate: item.purchaseDate,
              soldPrice: item.soldPrice,
              soldDate: item.soldDate,
              today: new Date(`${today}T12:00:00`),
            });

            return (
              <article
                key={item.id}
                className="rounded-2xl border border-[var(--border-tertiary)] bg-[var(--color-container)] p-4 shadow-[var(--shadow-xs)]"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--color-container-inset)] text-[var(--color-text-primary)]">
                    <Icon size={24} strokeWidth={1.7} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-bold text-[var(--color-text-primary)]">{item.name}</h2>
                        <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                          {category.label} · 买入 {formatMoney(item.purchasePrice)}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`删除${item.name}`}
                        onClick={() => handleDelete(item)}
                        disabled={pending}
                        className="grid min-h-10 min-w-10 place-items-center rounded-xl text-[var(--color-text-subdued)] active:bg-[var(--color-danger-bg)] active:text-[var(--color-danger)]"
                      >
                        <Trash2 size={18} strokeWidth={1.8} aria-hidden />
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-[var(--color-container-inset)] px-3 py-2">
                        <div className="text-[11px] text-[var(--color-text-secondary)]">已持有</div>
                        <div className="mt-0.5 font-bold tabular-nums text-[var(--color-text-primary)]">{heldDays} 天</div>
                      </div>
                      <div className="rounded-xl bg-[var(--color-container-inset)] px-3 py-2">
                        <div className="text-[11px] text-[var(--color-text-secondary)]">真实日均成本</div>
                        <div className="mt-0.5 font-bold tabular-nums text-[var(--color-text-primary)]">{formatMoney(dailyCost)}/天</div>
                      </div>
                    </div>

                    <label className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--color-text-secondary)]">
                      使用状态
                      <select
                        value={item.status}
                        disabled={pending}
                        onChange={(event) => handleStatus(item, event.target.value as PossessionStatus)}
                        className="min-h-10 rounded-xl border border-[var(--border-secondary)] bg-[var(--color-container-inset)] px-3 text-sm font-medium text-[var(--color-text-primary)]"
                      >
                        {Object.entries(POSSESSION_STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>

                    {sellingId === item.id ? (
                      <form
                        onSubmit={(event) => handleSold(event, item)}
                        className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-[var(--border-tertiary)] bg-[var(--color-container-inset)] p-3"
                      >
                        <label className="grid gap-1 text-[11px] text-[var(--color-text-secondary)]">
                          出售价格
                          <input
                            name="soldPrice"
                            required
                            inputMode="decimal"
                            placeholder="0.00"
                            className="min-h-10 rounded-lg border border-[var(--border-secondary)] bg-[var(--color-container)] px-2 text-sm text-[var(--color-text-primary)]"
                          />
                        </label>
                        <label className="grid gap-1 text-[11px] text-[var(--color-text-secondary)]">
                          出售日期
                          <input
                            name="soldDate"
                            type="date"
                            required
                            defaultValue={today}
                            max={today}
                            className="min-h-10 rounded-lg border border-[var(--border-secondary)] bg-[var(--color-container)] px-2 text-sm text-[var(--color-text-primary)]"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setSellingId(null)}
                          className="min-h-10 rounded-lg border border-[var(--border-secondary)] text-sm text-[var(--color-text-secondary)]"
                        >
                          取消
                        </button>
                        <button
                          type="submit"
                          disabled={pending}
                          className="min-h-10 rounded-lg bg-[var(--color-accent)] text-sm font-semibold text-[var(--color-text-inverse)] disabled:opacity-50"
                        >
                          确认出售
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
