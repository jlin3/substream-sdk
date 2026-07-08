import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/login', '/d/', '/og-capture'],
      },
    ],
    sitemap: 'https://substream.ai/sitemap.xml',
  };
}
