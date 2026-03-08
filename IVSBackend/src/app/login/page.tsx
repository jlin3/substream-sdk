'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [slug, setSlug] = useState('livewave-demo');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            <span className="text-brand-400">live</span>wave
          </Link>
          <p className="mt-2 text-sm text-white/50">Sign in to your organization dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="slug" className="block text-sm font-medium text-white/70">
              Organization
            </label>
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="your-org-slug"
              className="w-full rounded-lg border border-white/10 bg-surface-200 px-3 py-2.5 text-sm placeholder:text-white/30 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="code" className="block text-sm font-medium text-white/70">
              Demo Code
            </label>
            <input
              id="code"
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter demo access code"
              className="w-full rounded-lg border border-white/10 bg-surface-200 px-3 py-2.5 text-sm placeholder:text-white/30 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {error && (
            <p className="text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !slug || !code}
            className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold hover:bg-brand-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
