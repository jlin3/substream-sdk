'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created: string;
  lastUsed: string | null;
  status: 'active' | 'revoked';
}

const DEMO_KEYS: ApiKey[] = [
  {
    id: 'key-demo',
    name: 'Demo / Testing',
    key: 'demo-token',
    created: 'Built-in',
    lastUsed: 'Recently',
    status: 'active',
  },
  {
    id: 'key-viewer',
    name: 'Viewer Token',
    key: 'demo-viewer-token',
    created: 'Built-in',
    lastUsed: 'Recently',
    status: 'active',
  },
];

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>(DEMO_KEYS);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function handleCreate() {
    if (!newKeyName.trim()) return;

    const generated = `sk_live_${randomHex(8)}_${randomHex(24)}`;
    const newKey: ApiKey = {
      id: `key-${Date.now()}`,
      name: newKeyName.trim(),
      key: generated,
      created: 'Just now',
      lastUsed: null,
      status: 'active',
    };

    setKeys([newKey, ...keys]);
    setCreatedKey(generated);
    setNewKeyName('');
    setShowCreate(false);
  }

  function handleRevoke(id: string) {
    setKeys(keys.map(k => k.id === id ? { ...k, status: 'revoked' as const } : k));
  }

  function handleCopy(key: string, id: string) {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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

      {/* Created key banner */}
      {createdKey && (
        <div className="rounded-xl border border-success/30 bg-success/5 p-5 space-y-3">
          <p className="text-sm font-semibold text-success">API key created successfully</p>
          <p className="text-xs text-white/50">Copy this key now. You won&apos;t be able to see it again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono bg-surface-200 px-4 py-2.5 rounded-lg text-white/80 overflow-x-auto">
              {createdKey}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(createdKey); setCreatedKey(null); }}
              className="rounded-lg bg-success/20 text-success px-4 py-2.5 text-sm font-medium hover:bg-success/30 transition-colors shrink-0"
            >
              Copy & Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Create key form */}
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

      {/* Key list */}
      <div className="rounded-xl border border-white/10 bg-surface-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 grid grid-cols-12 gap-4 text-xs text-white/40 uppercase tracking-wide">
          <div className="col-span-3">Name</div>
          <div className="col-span-4">Key</div>
          <div className="col-span-2">Created</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        <div className="divide-y divide-white/5">
          {keys.map((k) => (
            <div key={k.id} className="px-5 py-4 grid grid-cols-12 gap-4 items-center">
              <div className="col-span-3">
                <p className="text-sm font-medium">{k.name}</p>
                {k.lastUsed && <p className="text-xs text-white/30">Last used: {k.lastUsed}</p>}
              </div>
              <div className="col-span-4">
                <code className="text-xs font-mono bg-surface-300 px-2.5 py-1 rounded text-white/60">
                  {k.key.length > 20 ? `${k.key.slice(0, 12)}...${k.key.slice(-4)}` : k.key}
                </code>
              </div>
              <div className="col-span-2 text-sm text-white/40">{k.created}</div>
              <div className="col-span-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  k.status === 'active' ? 'bg-success/20 text-success' : 'bg-white/10 text-white/30'
                }`}>
                  {k.status}
                </span>
              </div>
              <div className="col-span-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => handleCopy(k.key, k.id)}
                  className="text-xs text-white/40 hover:text-white transition-colors"
                >
                  {copiedId === k.id ? 'Copied!' : 'Copy'}
                </button>
                {k.status === 'active' && k.id !== 'key-demo' && k.id !== 'key-viewer' && (
                  <button
                    onClick={() => handleRevoke(k.id)}
                    className="text-xs text-danger/60 hover:text-danger transition-colors"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Integration guide */}
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

function randomHex(bytes: number): string {
  return Array.from({ length: bytes }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  ).join('');
}
