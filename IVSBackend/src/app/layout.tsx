import type { Metadata } from 'next';
import './globals.css';
import { FAQS } from '@/lib/faqs';

const SITE_URL = 'https://substream.ai';
const TITLE = 'Substream — White-Label Live Streaming & AI Highlights SDK for Game Studios';
const DESCRIPTION =
  'Give your players their own Twitch — on your domain. One SDK (Web, Unity, iOS) lets players stream gameplay to your site with sub-500ms latency. Gemini-powered AI highlights, 100% of the data and revenue stays with your studio. 90-day zero-cost proof of concept.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s · Substream',
  },
  description: DESCRIPTION,
  keywords: [
    'game streaming SDK',
    'white-label live streaming',
    'live streaming for games',
    'AI gameplay highlights',
    'Unity streaming SDK',
    'WebRTC game streaming',
    'player engagement platform',
    'first-party video infrastructure',
    'game studio streaming platform',
    'automated highlight clips',
  ],
  alternates: { canonical: '/' },
  icons: { icon: '/favicon.ico' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Substream',
    title: TITLE,
    description: DESCRIPTION,
    images: [
      // Animated GIF first: iMessage and most messengers animate it in the link preview
      { url: '/og/og-preview.gif', width: 1200, height: 630, type: 'image/gif', alt: 'Substream — your own branded streaming platform, live on your domain' },
      { url: '/og/og-image.png', width: 1200, height: 630, type: 'image/png', alt: 'Substream — white-label live streaming and AI highlights for game studios' },
    ],
    videos: [
      { url: '/og/og-preview.mp4', width: 1200, height: 630, type: 'video/mp4' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-video-preview': -1 },
  },
};

const JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Substream',
    url: SITE_URL,
    logo: `${SITE_URL}/og/og-image.png`,
    description:
      'First-party video infrastructure for game studios: white-label live streaming, AI-generated highlights, and player engagement — on your own domain.',
    sameAs: ['https://github.com/jlin3/substream-sdk'],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Substream SDK',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web, Unity (Windows, macOS, Quest), iOS',
    description:
      'Drop-in streaming SDK for games: players go live from inside your game to your own site over WebRTC with sub-500ms latency. Gemini-powered AI highlight reels generated within ~60 seconds of a match ending.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: '90-day zero-cost proof of concept for game studios',
    },
    url: SITE_URL,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-surface-50 text-white antialiased">
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </body>
    </html>
  );
}
