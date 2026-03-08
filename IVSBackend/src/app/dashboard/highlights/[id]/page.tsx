import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { HighlightPoller } from './poller';

export default async function HighlightDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');

  const highlight = await prisma.highlight.findFirst({
    where: { id, orgId: session.orgId },
    include: {
      stream: { select: { id: true, title: true, streamerName: true } },
    },
  });

  if (!highlight) notFound();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/highlights"
          className="text-sm text-white/40 hover:text-white transition-colors"
        >
          &larr; Highlights
        </Link>
        <span className="text-white/20">/</span>
        <h1 className="text-lg font-semibold truncate">{highlight.title}</h1>
      </div>

      <div className="rounded-xl border border-white/10 bg-surface-100 overflow-hidden">
        {highlight.status === 'COMPLETED' && highlight.videoUrl ? (
          <div className="aspect-video bg-black">
            <video
              src={highlight.videoUrl}
              controls
              className="w-full h-full"
              poster={highlight.thumbnailUrl || undefined}
            />
          </div>
        ) : highlight.status === 'PROCESSING' || highlight.status === 'PENDING' ? (
          <HighlightPoller
            highlightId={highlight.id}
            orgSlug={session.orgSlug}
            initialStatus={highlight.status}
          />
        ) : (
          <div className="aspect-video bg-black flex items-center justify-center">
            <div className="text-center space-y-1">
              <p className="text-danger text-sm font-medium">Highlight generation failed</p>
              <p className="text-xs text-white/30">Try generating a new highlight from the recording.</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-6 text-sm text-white/50">
        {highlight.stream && (
          <span>
            Source:{' '}
            <Link href={`/dashboard/streams/${highlight.stream.id}`} className="text-brand-400 hover:underline">
              {highlight.stream.title || 'Untitled Stream'}
            </Link>
          </span>
        )}
        {highlight.duration && (
          <span>Duration: {Math.floor(highlight.duration / 60)}m {highlight.duration % 60}s</span>
        )}
        <span>Created: {new Date(highlight.createdAt).toLocaleString()}</span>
      </div>
    </div>
  );
}
