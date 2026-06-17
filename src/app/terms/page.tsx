import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '用户协议 - Elevate Life 家庭账本',
  description: 'Elevate Life 家庭账本的用户协议与服务条款。',
};

const sectionStyle = {
  marginTop: 24,
  lineHeight: 1.75,
  color: 'var(--color-text-secondary)',
} as const;

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '56px 24px 80px' }}>
      <Link href="/login" className="btn btn-outline btn-sm">返回登录</Link>
      <h1 style={{ marginTop: 28, fontSize: 32, fontWeight: 800, color: 'var(--color-text-primary)' }}>用户协议</h1>
      <p style={{ marginTop: 10, color: 'var(--color-text-secondary)' }}>更新日期：2026-06-16</p>
      <p style={{ marginTop: 16, lineHeight: 1.75, color: 'var(--color-text-secondary)' }}>
        本用户协议和服务条款适用于 Elevate Life 家庭账本。正式上架前，请根据实际运营主体、服务范围、收费方式和所在地法律要求完成复核。
      </p>

      <section style={sectionStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>服务内容</h2>
        <p>Elevate Life 家庭账本用于记录和展示家庭资产、负债、预算、流水、资金账户、储蓄目标和现金流安全状态。应用提供的是家庭财务管理工具，不构成投资、税务、法律或保险建议。</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>账号与使用</h2>
        <p>你需要妥善保管账号和密码，并对账号下录入、修改、删除的家庭财务数据负责。请勿将账号用于违法、欺诈、攻击服务、干扰他人使用或绕过安全限制的行为。</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>家庭财务数据</h2>
        <p>你录入的家庭财务数据包括但不限于资产、负债、预算、流水、账户名称、分类、备注和目标。请避免填写身份证号、完整银行卡号、支付密码或与记账无关的敏感信息。</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>用户责任</h2>
        <p>你应确认录入数据的来源合法、内容真实，并自行判断根据应用展示结果采取的家庭财务行动。市场价格、估值和预测仅用于辅助展示，可能存在延迟、缺失或误差。</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>隐私与数据删除</h2>
        <p>我们会按 <Link href="/privacy" style={{ color: 'var(--color-primary)' }}>隐私政策</Link> 处理账号信息和家庭财务数据。你也可以查看 <Link href="/account-deletion" style={{ color: 'var(--color-primary)' }}>账号与数据删除</Link> 页面了解删除范围、处理时限和申请方式。</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>服务变更与终止</h2>
        <p>为了保障安全、修复问题或改进功能，我们可能调整服务内容。若服务发生重大变化，会在应用内、公开页面或商店说明中提供必要信息。你可以停止使用服务并按删除说明申请删除账号与数据。</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>联系我们</h2>
        <p>如果你对服务条款、账号使用或数据处理有疑问，请通过 <Link href="/support" style={{ color: 'var(--color-primary)' }}>支持与帮助</Link> 页面联系我们。正式上架前请在本页面和商店后台填入真实运营主体与支持邮箱。</p>
      </section>
    </main>
  );
}
