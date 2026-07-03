import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/demo-sites/extract-branding
 *
 * Best-effort brand extraction from a company website. Fetches the page
 * HTML server-side and pulls site name, logo, and accent color from meta
 * tags. Always succeeds with sensible fallbacks — a failed scrape must
 * never block the demo-generator funnel (the wizard lets users correct
 * everything anyway).
 */

export const dynamic = 'force-dynamic';

interface BrandResult {
  brandName: string;
  logoUrl: string;
  accentColor: string | null;
  websiteUrl: string;
  scraped: boolean;
}

function normalizeUrl(input: string): URL | null {
  const trimmed = input.trim();
  try {
    return new URL(trimmed.match(/^https?:\/\//i) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return m ? m[1] : null;
}

/** Find first matching meta/link tag content in raw HTML. */
function findMeta(html: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

function resolveUrl(maybeRelative: string, base: URL): string | null {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

function fallbackName(url: URL): string {
  const host = url.hostname.replace(/^www\./, '');
  const stem = host.split('.')[0];
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}

function faviconService(url: URL): string {
  return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=128`;
}

const BORING_COLORS = /^#?(fff(fff)?|000(000)?|ffffff|000000|f{6}|0{6})$/i;

export async function POST(request: NextRequest) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const url = normalizeUrl(body.url || '');
  if (!url) {
    return NextResponse.json({ error: 'A valid website URL is required' }, { status: 400 });
  }

  const fallback: BrandResult = {
    brandName: fallbackName(url),
    logoUrl: faviconService(url),
    accentColor: null,
    websiteUrl: url.toString(),
    scraped: false,
  };

  let html = '';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SubstreamDemoBot/1.0; +https://substream.io)',
        Accept: 'text/html',
      },
    });
    clearTimeout(timer);
    if (!res.ok) return NextResponse.json(fallback);
    // Only read the head-ish portion; meta tags live early in the document.
    html = (await res.text()).slice(0, 300_000);
  } catch {
    return NextResponse.json(fallback);
  }

  // --- Site name ---
  const ogSiteName = findMeta(html, [
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i,
  ]);
  const title = findMeta(html, [/<title[^>]*>([^<]+)<\/title>/i]);
  // Split "Brand - tagline" style names on separators surrounded by spaces,
  // so hyphenated brand names (e.g. Coca-Cola) survive intact.
  const cleanName = (raw: string) => raw.split(/\s+[|·•–—\-:]\s+/)[0].trim();
  const rawName = ogSiteName || title;
  const brandName = (rawName ? cleanName(rawName) : fallback.brandName).slice(0, 60).trim() || fallback.brandName;

  // --- Logo: apple-touch-icon > large icon link > og:image > favicon service ---
  let logoUrl: string | null = null;
  const linkTags = html.match(/<link[^>]+>/gi) || [];
  const iconLinks = linkTags
    .map((tag) => ({ rel: (attr(tag, 'rel') || '').toLowerCase(), href: attr(tag, 'href'), sizes: attr(tag, 'sizes') }))
    .filter((l) => l.href && /icon/.test(l.rel));
  const appleIcon = iconLinks.find((l) => l.rel.includes('apple-touch-icon'));
  const sizedIcons = iconLinks
    .filter((l) => l.sizes)
    .sort((a, b) => parseInt(b.sizes || '0', 10) - parseInt(a.sizes || '0', 10));
  const candidate = appleIcon?.href || sizedIcons[0]?.href || null;
  if (candidate) logoUrl = resolveUrl(candidate, url);
  if (!logoUrl) {
    const ogImage = findMeta(html, [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    ]);
    if (ogImage) logoUrl = resolveUrl(ogImage, url);
  }

  // --- Accent color ---
  const themeColor = findMeta(html, [
    /<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']theme-color["']/i,
  ]);
  const accentColor =
    themeColor && /^#[0-9a-f]{3,8}$/i.test(themeColor) && !BORING_COLORS.test(themeColor)
      ? themeColor
      : null;

  const result: BrandResult = {
    brandName,
    logoUrl: logoUrl || faviconService(url),
    accentColor,
    websiteUrl: url.toString(),
    scraped: true,
  };
  return NextResponse.json(result);
}
