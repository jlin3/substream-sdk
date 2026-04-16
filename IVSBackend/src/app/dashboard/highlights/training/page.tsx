'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';

interface TrainingExample {
  id: string;
  game_title: string;
  genre: string;
  source_video_gcs_uri: string | null;
  highlight_video_gcs_uri: string | null;
  highlight_segments: Array<{
    start: number;
    end: number;
    score: number;
    label: string;
  }> | null;
  created_at: string;
}

export default function TrainingDataPage() {
  const [examples, setExamples] = useState<TrainingExample[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');

  const [gameTitle, setGameTitle] = useState('');
  const [genre, setGenre] = useState('other');
  const [sourceUri, setSourceUri] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const hlServiceUrl = process.env.NEXT_PUBLIC_HIGHLIGHT_SERVICE_URL || 'http://localhost:8080';

  const fetchExamples = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${hlServiceUrl}/api/v1/training/examples`);
      if (res.ok) {
        const data = await res.json();
        setExamples(data);
      }
    } catch {
      setMessage('Failed to load examples');
    }
    setLoading(false);
  }, [hlServiceUrl]);

  const handleUpload = async () => {
    if (!file || !gameTitle) {
      setMessage('Please provide a video file and game title');
      return;
    }

    setUploading(true);
    setMessage('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('game_title', gameTitle);
    formData.append('genre', genre);
    if (sourceUri) formData.append('source_video_uri', sourceUri);

    try {
      const res = await fetch(`${hlServiceUrl}/api/v1/training/upload`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setMessage('Training example uploaded successfully');
        setFile(null);
        setGameTitle('');
        setSourceUri('');
        fetchExamples();
      } else {
        const err = await res.json();
        setMessage(`Upload failed: ${err.detail || 'Unknown error'}`);
      }
    } catch {
      setMessage('Upload failed: service unreachable');
    }
    setUploading(false);
  };

  const handleExport = async () => {
    setExporting(true);
    setMessage('');
    try {
      const res = await fetch(`${hlServiceUrl}/api/v1/training/export`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setMessage(
          `Dataset exported: ${data.train_examples} train + ${data.validation_examples} validation examples → ${data.train_uri}`,
        );
      } else {
        const err = await res.json();
        setMessage(`Export failed: ${err.detail || 'Unknown error'}`);
      }
    } catch {
      setMessage('Export failed: service unreachable');
    }
    setExporting(false);
  };

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/highlights"
          className="text-sm text-white/40 hover:text-white transition-colors"
        >
          &larr; Highlights
        </Link>
        <span className="text-white/20">/</span>
        <h1 className="text-2xl font-bold">Training Data</h1>
      </div>

      {message && (
        <div className="rounded-lg border border-white/10 bg-surface-100 px-4 py-3 text-sm">
          {message}
        </div>
      )}

      {/* Upload Form */}
      <section className="rounded-xl border border-white/10 bg-surface-100 p-6 space-y-4">
        <h2 className="text-lg font-semibold">Upload Highlight Example</h2>
        <p className="text-sm text-white/40">
          Upload a known-good highlight reel as a training example for fine-tuning.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-white/60">Game Title *</label>
            <input
              type="text"
              value={gameTitle}
              onChange={(e) => setGameTitle(e.target.value)}
              placeholder="e.g. Fortnite"
              className="w-full rounded-lg border border-white/10 bg-surface-200 px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-white/60">Genre</label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-surface-200 px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
            >
              <option value="fps">FPS / Shooter</option>
              <option value="moba">MOBA</option>
              <option value="battle_royale">Battle Royale</option>
              <option value="sports">Sports</option>
              <option value="racing">Racing</option>
              <option value="rpg">RPG</option>
              <option value="strategy">Strategy</option>
              <option value="fighting">Fighting</option>
              <option value="simulation">Simulation</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-white/60">Source Recording URI (optional)</label>
          <input
            type="text"
            value={sourceUri}
            onChange={(e) => setSourceUri(e.target.value)}
            placeholder="gs://bucket/path/to/full-recording.mp4"
            className="w-full rounded-lg border border-white/10 bg-surface-200 px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-white/60">Highlight Video *</label>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full rounded-lg border border-white/10 bg-surface-200 px-3 py-2 text-sm file:mr-3 file:bg-brand-600/20 file:text-brand-400 file:border-0 file:rounded file:px-3 file:py-1 file:text-xs"
          />
        </div>

        <button
          onClick={handleUpload}
          disabled={uploading || !file || !gameTitle}
          className="rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:hover:bg-brand-600 px-4 py-2 text-sm font-medium transition-colors"
        >
          {uploading ? 'Uploading...' : 'Upload Example'}
        </button>
      </section>

      {/* Examples List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Collected Examples</h2>
          <div className="flex gap-2">
            <button
              onClick={fetchExamples}
              disabled={loading}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-surface-200 transition-colors"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <button
              onClick={handleExport}
              disabled={exporting || examples.length < 10}
              className="rounded-lg bg-brand-600/20 text-brand-400 border border-brand-500/30 px-3 py-1.5 text-xs hover:bg-brand-600/30 transition-colors disabled:opacity-40"
            >
              {exporting ? 'Exporting...' : 'Export Dataset'}
            </button>
          </div>
        </div>

        {examples.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-surface-100 px-5 py-12 text-center space-y-2">
            <p className="text-white/30 text-sm">No training examples yet.</p>
            <p className="text-xs text-white/20">
              Upload highlight videos above, or generate highlights and mark them as
              &ldquo;good&rdquo; to auto-collect training data.
            </p>
            <button
              onClick={fetchExamples}
              className="mt-3 text-xs text-brand-400 hover:underline"
            >
              Load from service
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-surface-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-white/40 border-b border-white/5">
                  <th className="px-5 py-2.5 font-medium">Game</th>
                  <th className="px-3 py-2.5 font-medium">Genre</th>
                  <th className="px-3 py-2.5 font-medium">Segments</th>
                  <th className="px-3 py-2.5 font-medium">Source</th>
                  <th className="px-3 py-2.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {examples.map((ex) => (
                  <tr key={ex.id} className="border-b border-white/5">
                    <td className="px-5 py-2.5 font-medium">{ex.game_title}</td>
                    <td className="px-3 py-2.5 text-white/60">{ex.genre}</td>
                    <td className="px-3 py-2.5 text-white/60">
                      {ex.highlight_segments?.length || 0}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-white/40 truncate max-w-[200px]">
                      {ex.source_video_gcs_uri ? 'Yes' : 'No'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-white/40">
                      {new Date(ex.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
