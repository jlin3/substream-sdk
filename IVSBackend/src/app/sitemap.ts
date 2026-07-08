import type { MetadataRoute } from 'next';

const SITE_URL = 'https://substream.ai';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/try`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/docs`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/product-demo`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/demo`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
  ];
}
