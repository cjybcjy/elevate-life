import type { Metadata } from 'next';
import Link from 'next/link';

import { getPublicReleaseContact } from '@/lib/public-release-config';

export const metadata: Metadata = {
  title: '支持与帮助 - Elevate Life 家庭账本',
  description: 'Elevate Life 家庭账本的支持与帮助页面。',
};

export default async function SupportPage() {
  const contact = await getPublicReleaseContact();

  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '56px 24px 80px' }}>
      <Link href="/login" className="btn btn-outline btn-sm">返回登录</Link>
      <h1 style={{ marginTop: 28, fontSize: 32, fontWeight: 800, color: 'var(--color-text-primary)' }}>支持与帮助</h1>
      <p style={{ marginTop: 12, lineHeight: 1.75, color: 'var(--color-text-secondary)' }}>
        Elevate Life 家庭账本用于家庭资产、预算、流水、资金账户和现金流安全管理。如需账号、数据或审核支持，请通过下方邮箱联系我们。
      </p>

      <section style={{ marginTop: 28, lineHeight: 1.75, color: 'var(--color-text-secondary)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>联系方式</h2>
        <p>
          支持邮箱：
          <a href={contact.supportHref} style={{ color: 'var(--color-primary)' }}>{contact.supportEmail}</a>
        </p>
        <p>隐私政策：<Link href="/privacy" style={{ color: 'var(--color-primary)' }}>查看隐私政策</Link></p>
        <p>用户协议：<Link href="/terms" style={{ color: 'var(--color-primary)' }}>查看用户协议</Link></p>
        <p>账号与数据删除：<Link href="/account-deletion" style={{ color: 'var(--color-primary)' }}>查看删除说明</Link></p>
      </section>

      <section style={{ marginTop: 28, lineHeight: 1.75, color: 'var(--color-text-secondary)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>审核测试账号</h2>
        <p>商店审核时请在审核备注中提供测试账号和密码。建议测试账号包含示例资产、预算、负债、流水和资金账户数据，便于审核人员验证核心流程。</p>
      </section>

      <section style={{ marginTop: 28, lineHeight: 1.75, color: 'var(--color-text-secondary)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>常见问题</h2>
        <p>如果无法登录，请检查网络连接、账号密码和服务状态。如果财务数据展示异常，请先确认流水是否选择了正确的来源资金账户。</p>
      </section>
    </main>
  );
}
