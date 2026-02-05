'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the viewer component (uses browser-only APIs)
const IvsRealTimeViewer = dynamic(
  () => import('@/components/IvsRealTimeViewer'),
  { 
    ssr: false,
    loading: () => <div style={styles.loading}>Loading viewer...</div>
  }
);

// Separate component to handle search params (Next.js requirement)
function ViewerContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const streamId = params.streamId as string;
  
  const [viewerData, setViewerData] = useState<{
    token: string;
    participantId: string;
    stageArn: string;
    expiresAt: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Get auth token from query params (parent's auth)
  const authToken = searchParams.get('auth');

  useEffect(() => {
    async function fetchViewerToken() {
      if (!streamId) {
        setError('Stream ID is required');
        setLoading(false);
        return;
      }

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(`/api/streams/${streamId}/viewer`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            parentUserId: searchParams.get('parentId') || 'anonymous',
            childId: searchParams.get('childId'),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        setViewerData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load viewer');
      } finally {
        setLoading(false);
      }
    }

    fetchViewerToken();
  }, [streamId, authToken, searchParams]);

  if (loading) {
    return (
      <main style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <p>Connecting to stream...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={styles.container}>
        <div style={styles.error}>
          <h2>Unable to Join Stream</h2>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            style={styles.retryButton}
          >
            Try Again
          </button>
        </div>
      </main>
    );
  }

  if (!viewerData) {
    return (
      <main style={styles.container}>
        <div style={styles.error}>
          <h2>Stream Not Available</h2>
          <p>This stream may have ended or is not currently active.</p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Live Stream</h1>
        <div style={styles.badge}>LIVE</div>
      </header>
      
      <IvsRealTimeViewer
        token={viewerData.token}
        stageArn={viewerData.stageArn}
        participantId={viewerData.participantId}
      />
      
      <footer style={styles.footer}>
        <p>Powered by Substream SDK</p>
      </footer>
    </main>
  );
}

// Main page component with Suspense boundary
export default function ViewerPage() {
  return (
    <Suspense fallback={
      <main style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </main>
    }>
      <ViewerContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0a0a0a',
    color: '#ffffff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 2rem',
    borderBottom: '1px solid #222',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 600,
    margin: 0,
  },
  badge: {
    backgroundColor: '#ef4444',
    color: '#fff',
    padding: '0.25rem 0.75rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    animation: 'pulse 2s infinite',
  },
  footer: {
    padding: '1rem',
    textAlign: 'center',
    color: '#666',
    fontSize: '0.875rem',
    borderTop: '1px solid #222',
  },
  loading: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    color: '#888',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #333',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  error: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: '1rem',
    padding: '0.75rem 1.5rem',
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
};
