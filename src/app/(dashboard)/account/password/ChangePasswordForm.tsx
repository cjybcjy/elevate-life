'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { changePassword } from '@/lib/actions/auth';

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const result = await changePassword({
      currentPassword,
      newPassword,
      confirmPassword,
    });

    if (result.success) {
      setSuccess('密码已修改，请使用新密码重新登录');
      await signOut({ callbackUrl: '/login' });
      return;
    }

    setError(result.error || '修改密码失败');
    setLoading(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md rounded-xl bg-ledger-surface p-5"
    >
      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-ledger-danger">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-400">
          {success}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="currentPassword" className="mb-1 block text-sm font-medium text-ledger-muted">
            当前密码
          </label>
          <input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full rounded-lg border border-ledger-muted/30 bg-ledger-bg px-4 py-2.5 text-ledger-text placeholder:text-ledger-muted/50 focus:border-ledger-accent focus:outline-none focus:ring-1 focus:ring-ledger-accent"
          />
        </div>

        <div>
          <label htmlFor="newPassword" className="mb-1 block text-sm font-medium text-ledger-muted">
            新密码
          </label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-lg border border-ledger-muted/30 bg-ledger-bg px-4 py-2.5 text-ledger-text placeholder:text-ledger-muted/50 focus:border-ledger-accent focus:outline-none focus:ring-1 focus:ring-ledger-accent"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-ledger-muted">
            确认新密码
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-lg border border-ledger-muted/30 bg-ledger-bg px-4 py-2.5 text-ledger-text placeholder:text-ledger-muted/50 focus:border-ledger-accent focus:outline-none focus:ring-1 focus:ring-ledger-accent"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-ledger-accent py-2.5 text-sm font-medium text-[var(--color-text-inverse)] transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? '修改中...' : '修改密码'}
        </button>
      </div>
    </form>
  );
}
