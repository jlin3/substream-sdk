'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface ApiKeyRecord {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdPlaintext, setCreatedPlaintext] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/keys');
      if (!res.ok) throw new Error('Failed to load keys');
      const data = await res.json();
      setKeys(data.keys);
    } catch {
      setError('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  async function handleCreate() {
    const name = newKeyName.trim();
    if (!name) return;

    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to create key');

      const data = await res.json();
      setCreatedPlaintext(data.plaintext);
      setNewKeyName('');
      setShowCreate(false);
      await fetchKeys();
    } catch {
      setError('Failed to create API key');
    }
  }

  async function handleRevoke(id: string) {
    try {
      const res = await fetch(`/api/keys?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to revoke key');
      await fetchKeys();
    } catch {
      setError('Failed to revoke key');
    }
  }

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <p className="text-white/40">Loading API keys...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-sm text-white/50 mt-1">
            Manage keys for SDK authentication. Include the key as a Bearer token in your requests.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold hover:bg-brand-500 transition-colors"
        >
          Create API Key
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 flex items-center justify-between">
          <p className="text-sm text-danger">{error}</p>
          <button onClick={() => setError(null)} className="text-xs text-danger/60 hover:text-danger">Dismiss</button>
        </div>
      )}

      {createdPlaintext && (
        <div className="rounded-xl border border-success/30 bg-success/5 p-5 space-y-3">
          <p className="text-sm font-semibold text-success">API key created successfully</p>
          <p className="text-xs text-white/50">Copy this key now. You won&apos;t be able to see it again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono bg-surface-200 px-4 py-2.5 rounded-lg text-white/80 overflow-x-auto">
              {createdPlaintext}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(createdPlaintext); setCreatedPlaintext(null); }}
              className="rounded-lg bg-success/20 text-success px-4 py-2.5 text-sm font-medium hover:bg-success/30 transition-colors shrink-0"
            >
              Copy & Dismiss
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="rounded-xl border border-white/10 bg-surface-100 p-5 space-y-4">
          <h2 className="font-semibold">New API Key</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g. Production, Staging)"
              className="flex-1 rounded-lg border border-white/10 bg-surface-200 px-3 py-2.5 text-sm placeholder:text-white/30 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <button
              onClick={handleCreate}
              disabled={!newKeyName.trim()}
              className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold hover:bg-brand-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Create
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewKeyName(''); }}
              className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-surface-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 grid grid-cols-12 gap-4 text-xs text-white/40 uppercase tracking-wide">
          <div className="col-span-3">Name</div>
          <div className="col-span-3">Key Prefix</div>
          <div className="col-span-2">Created</div>
          <div className="col-span-2">Last Used</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>
        <div className="divide-y divide-white/5">
          {keys.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-white/30">
              No API keys yet. Create one to get started.
            </div>
          )}
          {keys.map((k) => {
            const isActive = !k.revokedAt;
            return (
              <div key={k.id} className="px-5 py-4 grid grid-cols-12 gap-4 items-center">
                <div className="col-span-3">
                  <p className="text-sm font-medium">{k.name}</p>
                </div>
                <div className="col-span-3">
                  <code className="text-xs font-mono bg-surface-300 px-2.5 py-1 rounded text-white/60">
                    {k.prefix}...
                  </code>
                </div>
                <div className="col-span-2 text-sm text-white/40">{formatDate(k.createdAt)}</div>
                <div className="col-span-2 text-sm text-white/40">
                  {k.lastUsedAt ? formatDate(k.lastUsedAt) : 'Never'}
                </div>
                <div className="col-span-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    isActive ? 'bg-success/20 text-success' : 'bg-white/10 text-white/30'
                  }`}>
                    {isActive ? 'active' : 'revoked'}
                  </span>
                </div>
                <div className="col-span-1 flex items-center justify-end gap-2">
                  {isActive && (
                    <button
                      onClick={() => handleRevoke(k.id)}
                      className="text-xs text-danger/60 hover:text-danger transition-colors"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Built-in demo tokens info */}
      <section className="rounded-xl border border-white/10 bg-surface-100 p-6 space-y-4">
        <h2 className="font-semibold">Built-in Demo Tokens</h2>
        <p className="text-sm text-white/50">
          These tokens are available in non-production environments for testing. They bypass API key validation.
        </p>
        <div className="grid gap-2">
          {[
            { name: 'Stream + View', token: 'demo-token' },
            { name: 'View Only', token: 'demo-viewer-token' },
          ].map((t) => (
            <div key={t.token} className="flex items-center justify-between rounded-lg bg-surface-200 px-4 py-2.5">
              <div className="flex items-center gap-3">
                <span className="text-sm text-white/60">{t.name}</span>
                <code className="text-xs font-mono text-white/40">{t.token}</code>
              </div>
              <button
                onClick={() => handleCopy(t.token, t.token)}
                className="text-xs text-white/40 hover:text-white transition-colors"
              >
                {copiedId === t.token ? 'Copied!' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-surface-100 p-6 space-y-4">
        <h2 className="font-semibold">Using Your API Key</h2>
        <p className="text-sm text-white/50">
          Include the key as a Bearer token in the Authorization header of all SDK and API requests.
        </p>
        <pre className="rounded-lg bg-surface-200 p-4 text-sm font-mono text-white/70 overflow-x-auto">
          <code>{`// Web SDK
const session = await SubstreamSDK.startStream({
  canvasElement: document.querySelector('canvas'),
  backendUrl: '${typeof window !== 'undefined' ? window.location.origin : 'https://your-api.com'}',
  authToken: 'sk_live_your_key_here',
  streamerId: 'player-123',
});

// Direct API call
fetch('/api/streams/web-publish', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_live_your_key_here',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ streamerId: 'player-123' }),
});`}</code>
        </pre>
        <Link href="/docs" className="inline-block text-sm text-brand-400 hover:text-brand-300">
          View full documentation &rarr;
        </Link>
      </section>
    </div>
  );
}
