'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { loginUser } from '@/lib/actions/auth';
import { submitLoginForm } from '@/lib/login-submit';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    await submitLoginForm({
      username,
      password,
      login: loginUser,
      onSuccess: () => {
        router.replace('/');
      },
      setError,
      setLoading,
    });
  }

  return (
    <div className="w-full max-w-sm rounded-xl bg-ledger-surface p-8 shadow-lg">
      <h1 className="mb-6 text-center text-2xl font-semibold text-ledger-text">
        Sign In
      </h1>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-ledger-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="username"
            className="mb-1 block text-sm font-medium text-ledger-muted"
          >
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            className="w-full rounded-lg border border-ledger-muted/30 bg-ledger-bg px-4 py-2.5 text-ledger-text placeholder:text-ledger-muted/50 focus:border-ledger-accent focus:outline-none focus:ring-1 focus:ring-ledger-accent"
            placeholder="Enter your username"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-ledger-muted"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full rounded-lg border border-ledger-muted/30 bg-ledger-bg px-4 py-2.5 text-ledger-text placeholder:text-ledger-muted/50 focus:border-ledger-accent focus:outline-none focus:ring-1 focus:ring-ledger-accent"
            placeholder="Enter your password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-ledger-accent py-2.5 text-sm font-medium text-ledger-bg transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ledger-muted">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="font-medium text-ledger-accent hover:underline"
        >
          Register
        </Link>
      </p>
    </div>
  );
}
