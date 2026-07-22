export const dynamic = 'force-dynamic';

import type { ComponentType } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  BookOpenText,
  Boxes,
  CalendarClock,
  ChevronRight,
  CircleHelp,
  FileText,
  Goal,
  KeyRound,
  Landmark,
  ReceiptText,
  ShieldCheck,
  Tags,
} from 'lucide-react';
import BirdLogo from '@/components/common/BirdLogo';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type HubItem = {
  label: string;
  detail: string;
  href: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>;
};

function HubGroup({ title, items }: { title: string; items: HubItem[] }) {
  return (
    <section aria-labelledby={`me-${title}`}>
      <h2
        id={`me-${title}`}
        className="mb-2 px-1 text-xs font-semibold tracking-[0.08em] text-[var(--color-text-subdued)]"
      >
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-[var(--border-tertiary)] bg-[var(--color-container)] shadow-[var(--shadow-xs)]">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-16 items-center gap-3 px-4 py-3 text-[var(--color-text-primary)] no-underline active:bg-[var(--color-container-inset)] ${
                index > 0 ? 'border-t border-[var(--border-tertiary)]' : ''
              }`}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--color-container-inset)] text-[var(--color-text-primary)]">
                <Icon size={21} strokeWidth={1.8} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{item.label}</span>
                <span className="mt-0.5 block truncate text-xs text-[var(--color-text-secondary)]">
                  {item.detail}
                </span>
              </span>
              <ChevronRight size={18} strokeWidth={1.8} aria-hidden className="shrink-0 text-[var(--color-text-subdued)]" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default async function MePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [user, transactionCount, possessionCount, accountAgeRows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { displayName: true, username: true },
    }),
    prisma.transaction.count({ where: { userId: session.user.id } }),
    prisma.possession.count({ where: { userId: session.user.id } }),
    prisma.$queryRaw<Array<{ days: number }>>`
      SELECT GREATEST(1, (CURRENT_DATE - DATE("created_at")) + 1)::int AS days
      FROM "User"
      WHERE "id" = ${session.user.id}
    `,
  ]);

  const displayName = user?.displayName || user?.username || session.user.username || '家庭成员';
  const accountDays = accountAgeRows[0]?.days ?? 1;

  const coreItems: HubItem[] = [
    {
      label: '流水',
      detail: '查看全部收入、支出和转账',
      href: '/management/ledger',
      icon: ReceiptText,
    },
    {
      label: '周期交易',
      detail: '管理房租、工资和定期转账的自动记账',
      href: '/management/recurring',
      icon: CalendarClock,
    },
    {
      label: '我的物品',
      detail: '看清拥有、日均成本与闲置状态',
      href: '/possessions',
      icon: Boxes,
    },
  ];

  const financeItems: HubItem[] = [
    {
      label: '负债管理',
      detail: '查看余额、还款计划和压力',
      href: '/management/liabilities',
      icon: Landmark,
    },
    {
      label: '目标管理',
      detail: '管理家庭储蓄目标和进度',
      href: '/management/goals',
      icon: Goal,
    },
    {
      label: '分类管理',
      detail: '整理流水分类和必要支出',
      href: '/management/categories',
      icon: Tags,
    },
  ];

  const accountItems: HubItem[] = [
    {
      label: '账户安全',
      detail: '修改密码并保护家庭数据',
      href: '/account/password',
      icon: ShieldCheck,
    },
    {
      label: '使用帮助',
      detail: '查看支持方式和常见说明',
      href: '/support',
      icon: CircleHelp,
    },
    {
      label: '隐私与条款',
      detail: '了解数据处理与服务规则',
      href: '/privacy',
      icon: FileText,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl pb-4 md:pb-8">
      <section className="overflow-hidden rounded-3xl border border-[var(--border-tertiary)] bg-[var(--color-container)] shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-3 px-5 pb-4 pt-5">
          <span className="grid size-14 place-items-center rounded-2xl border border-[var(--border-secondary)] bg-[var(--color-container-inset)]">
            <BirdLogo size={40} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xl font-bold text-[var(--color-text-primary)]">
              {displayName}
            </span>
            <span className="mt-1 block truncate text-sm text-[var(--color-text-secondary)]">
              @{user?.username || session.user.username}
            </span>
          </span>
          <Link
            href="/account/password"
            aria-label="账户安全"
            className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-[var(--border-secondary)] text-[var(--color-text-primary)]"
          >
            <KeyRound size={20} strokeWidth={1.8} aria-hidden />
          </Link>
        </div>

        <dl className="grid grid-cols-3 border-t border-[var(--border-tertiary)] bg-[var(--color-container-inset)] px-2 py-4 text-center">
          <div>
            <dd className="text-xl font-bold tabular-nums text-[var(--color-text-primary)]">{accountDays}</dd>
            <dt className="mt-1 text-[11px] text-[var(--color-text-secondary)]">记账天数</dt>
          </div>
          <div className="border-x border-[var(--border-tertiary)]">
            <dd className="text-xl font-bold tabular-nums text-[var(--color-text-primary)]">{transactionCount}</dd>
            <dt className="mt-1 text-[11px] text-[var(--color-text-secondary)]">流水笔数</dt>
          </div>
          <div>
            <dd className="text-xl font-bold tabular-nums text-[var(--color-text-primary)]">{possessionCount}</dd>
            <dt className="mt-1 text-[11px] text-[var(--color-text-secondary)]">物品数量</dt>
          </div>
        </dl>
      </section>

      <div className="mt-5 grid gap-5">
        <HubGroup title="我的记录" items={coreItems} />
        <HubGroup title="家庭管理" items={financeItems} />
        <HubGroup title="账户与支持" items={accountItems} />
      </div>

      <div className="mt-5 flex items-center justify-center gap-2 text-xs text-[var(--color-text-subdued)]">
        <BookOpenText size={15} strokeWidth={1.8} aria-hidden />
        <span>家庭账本 · 让每一份拥有都更清楚</span>
      </div>
    </div>
  );
}
