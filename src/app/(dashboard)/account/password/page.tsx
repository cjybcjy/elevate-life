import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ChangePasswordForm from './ChangePasswordForm';

export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          修改密码
        </h1>
        <p className="mt-2 text-sm text-ledger-muted">
          修改后会重新加密你的财务数据，并退出当前登录。
        </p>
      </div>

      <ChangePasswordForm />
    </div>
  );
}
