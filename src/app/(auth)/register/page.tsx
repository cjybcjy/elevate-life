import Link from 'next/link';
import { connection } from 'next/server';
import RegisterForm from './RegisterForm';
import { getRegistrationMode } from '@/lib/security/credentials';

export default async function RegisterPage() {
  await connection();
  const mode = getRegistrationMode();

  if (mode === 'closed') {
    return (
      <div className="w-full max-w-sm rounded-xl bg-ledger-surface p-8 text-center shadow-lg">
        <h1 className="mb-3 text-2xl font-semibold text-ledger-text">注册暂未开放</h1>
        <p className="text-sm leading-6 text-ledger-muted">
          当前仅向已有账号和受邀用户开放，请联系管理员创建账号。
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-lg bg-ledger-accent px-5 py-2.5 text-sm font-medium text-ledger-bg transition hover:opacity-90"
        >
          返回登录
        </Link>
      </div>
    );
  }

  return <RegisterForm inviteRequired={mode === 'invite'} />;
}
