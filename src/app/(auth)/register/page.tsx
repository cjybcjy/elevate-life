'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { loginUser, registerUser } from '@/lib/actions/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await registerUser({ username, password, displayName });

    if (result.success) {
      const loginResult = await loginUser(username, password);
      if (loginResult.success) {
        router.push('/');
        router.refresh();
      } else {
        setError('Account created but auto-login failed. Please sign in manually.');
        setLoading(false);
      }
    } else {
      setError(result.error || 'Registration failed');
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-xl bg-ledger-surface p-8 shadow-lg">
      <h1 className="mb-6 text-center text-2xl font-semibold text-white">
        Create Account
      </h1>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-ledger-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="displayName"
            className="mb-1 block text-sm font-medium text-ledger-muted"
          >
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            autoComplete="name"
            className="w-full rounded-lg border border-ledger-muted/30 bg-ledger-bg px-4 py-2.5 text-white placeholder:text-ledger-muted/50 focus:border-ledger-accent focus:outline-none focus:ring-1 focus:ring-ledger-accent"
            placeholder="Enter your display name"
          />
        </div>

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
            className="w-full rounded-lg border border-ledger-muted/30 bg-ledger-bg px-4 py-2.5 text-white placeholder:text-ledger-muted/50 focus:border-ledger-accent focus:outline-none focus:ring-1 focus:ring-ledger-accent"
            placeholder="Choose a username"
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
            autoComplete="new-password"
            className="w-full rounded-lg border border-ledger-muted/30 bg-ledger-bg px-4 py-2.5 text-white placeholder:text-ledger-muted/50 focus:border-ledger-accent focus:outline-none focus:ring-1 focus:ring-ledger-accent"
            placeholder="Create a password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-ledger-accent py-2.5 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ledger-muted">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-ledger-accent hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
