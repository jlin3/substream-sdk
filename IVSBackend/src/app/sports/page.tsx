import type { Metadata } from 'next';
import SportsPage from '@/components/sports/SportsPage';

const TITLE = 'Sports & Live Events — White-Label Streaming for Leagues';
const DESCRIPTION =
  'Stream every match on your own site. Substream gives leagues, clubs and event organizers a branded streaming platform with pay-per-view, subscriptions, ads, in-stream merch, sponsorship and betting overlays. You keep the fans, the data and the revenue.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'white label streaming platform',
    'sports streaming platform',
    'league streaming platform',
    'event streaming service',
    'pay per view streaming',
    'streaming monetization platform',
    'live stream commerce',
    'cricket streaming platform',
    'sportsbook live streaming',
    'betting overlay streaming',
  ],
  alternates: { canonical: '/sports' },
  openGraph: {
    type: 'website',
    url: '/sports',
    siteName: 'Substream',
    title: `${TITLE} · Substream`,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${TITLE} · Substream`,
    description: DESCRIPTION,
  },
};

export default function Page() {
  return <SportsPage />;
}
