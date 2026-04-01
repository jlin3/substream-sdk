'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [slug, setSlug] = useState('substream-demo');
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
            <span className="text-brand-400">sub</span>stream
          </Link>
          <p className="mt-2 text-sm text-white/50">Sign in to your organization dashboard</p>
        </div>

        {/* Quick demo access */}
        <div className="rounded-xl border border-brand-500/20 bg-brand-600/5 p-4 space-y-3">
          <p className="text-xs font-medium text-brand-400 uppercase tracking-wide">Quick Demo Access</p>
          <p className="text-xs text-white/50">
            Jump straight into the dashboard with sample data — no credentials needed.
          </p>
          <Link
            href="/api/auth/demo-auto"
            className="block w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-center hover:bg-brand-500 transition-colors"
          >
            Enter Demo Dashboard
          </Link>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-surface-50 px-3 text-white/30">or sign in with credentials</span>
          </div>
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
              Access Code
            </label>
            <input
              id="code"
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter access code"
              className="w-full rounded-lg border border-white/10 bg-surface-200 px-3 py-2.5 text-sm placeholder:text-white/30 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {error && (
            <p className="text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !slug || !code}
            className="w-full rounded-lg bg-white/10 py-2.5 text-sm font-semibold hover:bg-white/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
