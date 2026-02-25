'use client';

import { useEffect, useState } from 'react';

interface AnalyticsOverview {
  totalStreams: number;
  liveNow: number;
  totalWatchSeconds: number;
  peakConcurrent: number;
}

interface DailyData {
  date: string;
  streams: number;
  watchSeconds: number;
  peakViewers: number;
}

interface AppSummary {
  appId: string;
  appName: string;
  totalStreams: number;
  liveNow: number;
}

interface AnalyticsData {
  overview: AnalyticsOverview;
  daily: DailyData[];
  apps: AppSummary[];
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function DashboardPage() {
  const [orgId, setOrgId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function fetchAnalytics() {
    if (!orgId || !apiKey) return;
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(`/api/orgs/${orgId}/analytics?period=30d`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setData(await resp.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (orgId && apiKey) fetchAnalytics();
  }, [orgId, apiKey]);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Substream Dashboard</h1>

      <div style={styles.authRow}>
        <input
          style={styles.input}
          placeholder="Organization ID"
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
        />
        <input
          style={styles.input}
          placeholder="API Key (sk_live_...)"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <button style={styles.button} onClick={fetchAnalytics} disabled={loading}>
          {loading ? 'Loading...' : 'Load'}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {data && (
        <>
          <div style={styles.cardRow}>
            <StatCard label="Total Streams (30d)" value={data.overview.totalStreams} />
            <StatCard label="Live Now" value={data.overview.liveNow} accent />
            <StatCard label="Total Watch Time" value={formatDuration(data.overview.totalWatchSeconds)} />
            <StatCard label="Peak Concurrent" value={data.overview.peakConcurrent} />
          </div>

          <h2 style={styles.sectionTitle}>Apps</h2>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>App</th>
                <th style={styles.th}>Streams (30d)</th>
                <th style={styles.th}>Live Now</th>
              </tr>
            </thead>
            <tbody>
              {data.apps.map((app) => (
                <tr key={app.appId}>
                  <td style={styles.td}>{app.appName}</td>
                  <td style={styles.td}>{app.totalStreams}</td>
                  <td style={styles.td}>
                    {app.liveNow > 0 ? (
                      <span style={styles.liveBadge}>{app.liveNow} live</span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 style={styles.sectionTitle}>Daily Activity</h2>
          <div style={styles.chartContainer}>
            {data.daily.slice(-14).map((d) => (
              <div key={d.date} style={styles.barWrap}>
                <div
                  style={{
                    ...styles.bar,
                    height: `${Math.max(4, Math.min(100, d.streams * 10))}px`,
                  }}
                />
                <span style={styles.barLabel}>{d.date.slice(5)}</span>
                <span style={styles.barValue}>{d.streams}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div style={styles.card}>
      <div style={styles.cardLabel}>{label}</div>
      <div style={{ ...styles.cardValue, color: accent ? '#8b5cf6' : '#e5e5e5' }}>
        {value}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '40px 20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#e5e5e5',
    background: '#0f0f0f',
    minHeight: '100vh',
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 24,
  },
  authRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 24,
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    background: '#1a1a2e',
    border: '1px solid #2a2a3e',
    borderRadius: 8,
    color: '#e5e5e5',
    fontSize: 14,
  },
  button: {
    padding: '10px 20px',
    background: '#8b5cf6',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 14,
  },
  error: {
    color: '#ef4444',
    marginBottom: 16,
    fontSize: 14,
  },
  cardRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16,
    marginBottom: 32,
  },
  card: {
    background: '#1a1a2e',
    borderRadius: 12,
    padding: '20px 16px',
    border: '1px solid #2a2a3e',
  },
  cardLabel: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: 700,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 12,
    marginTop: 8,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginBottom: 32,
  },
  th: {
    textAlign: 'left' as const,
    padding: '10px 12px',
    borderBottom: '1px solid #2a2a3e',
    color: '#888',
    fontSize: 12,
    textTransform: 'uppercase' as const,
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid #1a1a2e',
    fontSize: 14,
  },
  liveBadge: {
    background: '#ef4444',
    color: '#fff',
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 4,
    fontWeight: 700,
  },
  chartContainer: {
    display: 'flex',
    gap: 4,
    alignItems: 'flex-end',
    height: 140,
    padding: '20px 0',
  },
  barWrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 4,
  },
  bar: {
    width: '100%',
    maxWidth: 32,
    background: '#8b5cf6',
    borderRadius: '4px 4px 0 0',
  },
  barLabel: {
    fontSize: 10,
    color: '#666',
  },
  barValue: {
    fontSize: 10,
    color: '#aaa',
  },
};
