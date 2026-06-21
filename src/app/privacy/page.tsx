import type { Metadata } from 'next';
import Link from 'next/link';

import { getPublicReleaseContact } from '@/lib/public-release-config';

export const metadata: Metadata = {
  title: '隐私政策 - Elevate Life 家庭账本',
  description: 'Elevate Life 家庭账本的隐私政策。',
};

const sectionStyle = {
  marginTop: 24,
  lineHeight: 1.75,
  color: 'var(--color-text-secondary)',
} as const;

export default async function PrivacyPage() {
  const contact = await getPublicReleaseContact();

  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '56px 24px 80px' }}>
      <Link href="/login" className="btn btn-outline btn-sm">返回登录</Link>
      <h1 style={{ marginTop: 28, fontSize: 32, fontWeight: 800, color: 'var(--color-text-primary)' }}>隐私政策</h1>
      <p style={{ marginTop: 10, color: 'var(--color-text-secondary)' }}>更新日期：2026-06-16</p>

      <section style={sectionStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>我们收集的信息</h2>
        <p>为了提供家庭财务管理能力，应用会处理账号信息、家庭财务数据、预算、资产、负债、流水、资金账户、用户备注、偏好设置、本地设备数据和必要的诊断日志。请不要在备注中填写身份证号、完整银行卡号或其他与记账无关的敏感信息。</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>信息用途</h2>
        <p>这些信息用于登录认证、展示家庭财务状态、预算追踪、资产负债分析、现金流预测、数据同步、安全审计和故障排查。我们不会出售家庭财务数据，不会用于第三方广告，也不会用于跨 App 跟踪。</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>数据存储与安全</h2>
        <p>应用会对核心财务字段进行加密处理，通过登录会话保护访问，并在正式上线时使用 HTTPS 传输加密。请妥善保管账号密码，避免在共享设备上保存登录状态。</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>第三方服务</h2>
        <p>应用可能使用数据库、认证、公开市场价格接口和应用商店包装能力来提供核心功能。正式上架前，如果接入统计、崩溃上报、客服、推送或其他第三方 SDK/服务，我们会在隐私政策和商店隐私申报中同步更新。</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>数据保留</h2>
        <p>为提供账本功能，我们会在账号存续期间保留必要数据。你删除账号与数据后，相关家庭财务数据将无法恢复；法律法规要求保留的安全日志或审计信息，将按适用要求保留到期后删除或匿名化。</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>数据删除</h2>
        <p>你可以通过 <Link href="/account-deletion" style={{ color: 'var(--color-primary)' }}>账号与数据删除</Link> 页面查看删除范围、处理时限和申请方式。删除完成后，账号、资产、预算、负债、流水和相关家庭财务数据将无法恢复。</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>联系我们</h2>
        <p>
          如果你对隐私政策、数据处理或账号删除有疑问，请通过
          <Link href="/support" style={{ color: 'var(--color-primary)' }}>支持与帮助</Link>
          页面，或发送邮件至
          <a href={contact.supportHref} style={{ color: 'var(--color-primary)' }}>{contact.supportEmail}</a>
          联系我们。
        </p>
      </section>
    </main>
  );
}
