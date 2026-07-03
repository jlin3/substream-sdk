import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/demo-sites
 *
 * Lead capture + demo site generation for the "Demo it yourself" funnel.
 * Creates a Lead record and a persistent branded DemoSite, returns the
 * shareable /d/[slug] URL.
 */

const createSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  websiteUrl: z.string().max(500).optional(),
  brandName: z.string().min(1).max(60),
  logoUrl: z.string().max(1000).optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{3,8}$/)
    .optional(),
  template: z.enum(['DESTINATION', 'FEED', 'EVENT']).default('DESTINATION'),
  genre: z.string().max(40).default('shooter'),
  survey: z.record(z.string(), z.unknown()).optional(),
});

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'demo'
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const data = parsed.data;

  try {
    const lead = await prisma.lead.create({
      data: {
        name: data.name,
        email: data.email,
        websiteUrl: data.websiteUrl,
        survey: (data.survey as object) ?? undefined,
      },
    });

    const base = slugify(data.brandName);
    let slug = base;
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await prisma.demoSite.findUnique({ where: { slug } });
      if (!existing) break;
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const site = await prisma.demoSite.create({
      data: {
        slug,
        leadId: lead.id,
        brandName: data.brandName,
        websiteUrl: data.websiteUrl,
        logoUrl: data.logoUrl,
        accentColor: data.accentColor || '#2B7FFF',
        template: data.template,
        genre: data.genre,
      },
    });

    console.log(`[demo-gen] New lead: ${data.email} → /d/${site.slug}`);

    return NextResponse.json({ slug: site.slug, url: `/d/${site.slug}` }, { status: 201 });
  } catch (err) {
    console.error('[demo-gen] Failed to create demo site:', err);
    return NextResponse.json({ error: 'Failed to create demo site' }, { status: 500 });
  }
}
