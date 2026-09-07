'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { loginUser, registerUser } from '@/lib/actions/auth';

export default function RegisterForm({ inviteRequired }: { inviteRequired: boolean }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await registerUser({ username, password, displayName, inviteCode });

    if (result.success) {
      const loginResult = await loginUser(username.trim().toLowerCase(), password);
      if (loginResult.success) {
        router.push('/');
        router.refresh();
        return;
      }
      setError('账号已创建，但自动登录失败，请返回登录页重试。');
    } else {
      setError(result.error || '注册失败');
    }

    setLoading(false);
  }

  return (
    <div className="w-full max-w-sm rounded-xl bg-ledger-surface p-8 shadow-lg">
      <h1 className="mb-6 text-center text-2xl font-semibold text-ledger-text">
        {inviteRequired ? '邀请码注册' : '创建账号'}
      </h1>

      {error ? (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-ledger-danger">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        {inviteRequired ? (
          <div>
            <label htmlFor="inviteCode" className="mb-1 block text-sm font-medium text-ledger-muted">
              邀请码
            </label>
            <input
              id="inviteCode"
              type="password"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              required
              maxLength={256}
              autoComplete="one-time-code"
              className="w-full rounded-lg border border-ledger-muted/30 bg-ledger-bg px-4 py-2.5 text-ledger-text placeholder:text-ledger-muted/50 focus:border-ledger-accent focus:outline-none focus:ring-1 focus:ring-ledger-accent"
              placeholder="输入管理员提供的邀请码"
            />
          </div>
        ) : null}

        <div>
          <label htmlFor="displayName" className="mb-1 block text-sm font-medium text-ledger-muted">
            显示名称
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            minLength={1}
            maxLength={40}
            autoComplete="name"
            className="w-full rounded-lg border border-ledger-muted/30 bg-ledger-bg px-4 py-2.5 text-ledger-text placeholder:text-ledger-muted/50 focus:border-ledger-accent focus:outline-none focus:ring-1 focus:ring-ledger-accent"
            placeholder="家庭成员名称"
          />
        </div>

        <div>
          <label htmlFor="username" className="mb-1 block text-sm font-medium text-ledger-muted">
            用户名
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            minLength={3}
            maxLength={32}
            pattern="[a-z0-9][a-z0-9._-]{2,31}"
            autoCapitalize="none"
            autoComplete="username"
            className="w-full rounded-lg border border-ledger-muted/30 bg-ledger-bg px-4 py-2.5 text-ledger-text placeholder:text-ledger-muted/50 focus:border-ledger-accent focus:outline-none focus:ring-1 focus:ring-ledger-accent"
            placeholder="3–32 位小写字母或数字"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-ledger-muted">
            密码
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={12}
            maxLength={72}
            autoComplete="new-password"
            className="w-full rounded-lg border border-ledger-muted/30 bg-ledger-bg px-4 py-2.5 text-ledger-text placeholder:text-ledger-muted/50 focus:border-ledger-accent focus:outline-none focus:ring-1 focus:ring-ledger-accent"
            placeholder="至少 12 位，包含字母和数字"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-ledger-accent py-2.5 text-sm font-medium text-ledger-bg transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? '正在创建…' : '创建账号'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ledger-muted">
        已有账号？{' '}
        <Link href="/login" className="font-medium text-ledger-accent hover:underline">
          返回登录
        </Link>
      </p>
    </div>
  );
}
