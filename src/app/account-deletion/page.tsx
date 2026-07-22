import type { Metadata } from 'next';
import Link from 'next/link';

import { getPublicReleaseContact } from '@/lib/public-release-config';

export const metadata: Metadata = {
  title: '账号与数据删除 - Elevate Life 家庭账本',
  description: 'Elevate Life 家庭账本账号与数据删除说明。',
};

export default async function AccountDeletionPage() {
  const contact = await getPublicReleaseContact();

  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '56px 24px 80px' }}>
      <Link href="/login" className="btn btn-outline btn-sm">返回登录</Link>
      <h1 style={{ marginTop: 28, fontSize: 32, fontWeight: 800, color: 'var(--color-text-primary)' }}>账号与数据删除</h1>
      <p style={{ marginTop: 12, lineHeight: 1.75, color: 'var(--color-text-secondary)' }}>
        你可以申请删除 Elevate Life 家庭账本账号及相关家庭财务数据。请按下方申请方式联系支持邮箱，我们会在确认账号归属后处理。
      </p>

      <section style={{ marginTop: 28, lineHeight: 1.75, color: 'var(--color-text-secondary)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>删除范围</h2>
        <p>删除范围包括账号信息、资产、物品、负债、预算、流水、资金账户、分类、目标、预测数据和与账号关联的配置。法律法规要求保留的安全日志或交易审计信息，将按适用要求保留到期后删除或匿名化。</p>
      </section>

      <section style={{ marginTop: 28, lineHeight: 1.75, color: 'var(--color-text-secondary)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>申请方式</h2>
        <p>
          请使用注册账号对应邮箱发送删除申请到
          <a href={contact.supportHref} style={{ color: 'var(--color-primary)' }}>{contact.supportEmail}</a>
          ，并注明“删除账号与数据”。
        </p>
      </section>

      <section style={{ marginTop: 28, lineHeight: 1.75, color: 'var(--color-text-secondary)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>处理时限</h2>
        <p>收到完整申请并完成身份核验后，我们将在 15 个工作日内处理删除请求。处理完成后，相关数据将无法恢复。</p>
      </section>

      <section style={{ marginTop: 28, lineHeight: 1.75, color: 'var(--color-text-secondary)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>审核备注</h2>
        <p>提交 Google Play、Android 国内市场或 iOS App Store 审核时，可把本页面作为账号删除说明 URL，并在审核备注中说明测试账号不会被真实删除。</p>
      </section>
    </main>
  );
}
