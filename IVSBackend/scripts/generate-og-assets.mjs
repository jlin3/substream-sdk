#!/usr/bin/env node
/**
 * Generates the link-preview assets in public/og/ by recording the
 * /og-capture page (1200x630) with Playwright and assembling with ffmpeg:
 *
 *   og-preview.gif  — animated preview (iMessage & most messengers)
 *   og-preview.mp4  — og:video (Twitter/X, Discord, Slack)
 *   og-image.png    — static og:image fallback
 *
 * Usage:
 *   1. Start the app:  pnpm dev   (or next start)
 *   2. node scripts/generate-og-assets.mjs [baseUrl]
 *
 * Requires ffmpeg on PATH. Playwright is fetched via npx if missing.
 */

import { execSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'og');
const TMP_DIR = join(ROOT, '.og-frames');
const BASE_URL = process.argv[2] || 'http://localhost:3000';

const WIDTH = 1200;
const HEIGHT = 630;
const FPS = 8;
const SECONDS = 7;
const FRAMES = FPS * SECONDS;

async function main() {
  const { chromium } = await import('playwright');

  mkdirSync(OUT_DIR, { recursive: true });
  rmSync(TMP_DIR, { recursive: true, force: true });
  mkdirSync(TMP_DIR, { recursive: true });

  console.log(`Recording ${BASE_URL}/og-capture at ${WIDTH}x${HEIGHT}, ${FRAMES} frames @ ${FPS}fps`);
  const browser = await chromium.launch({
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  await page.goto(`${BASE_URL}/og-capture`, { waitUntil: 'networkidle' });
  // Let the video iframe start and chat fill in
  await page.waitForTimeout(4000);

  const interval = 1000 / FPS;
  for (let i = 0; i < FRAMES; i++) {
    const t0 = Date.now();
    const buf = await page.screenshot({ type: 'png' });
    writeFileSync(join(TMP_DIR, `frame-${String(i).padStart(3, '0')}.png`), buf);
    const elapsed = Date.now() - t0;
    if (elapsed < interval) await page.waitForTimeout(interval - elapsed);
  }
  await browser.close();

  const frames = join(TMP_DIR, 'frame-%03d.png');

  console.log('Encoding og-preview.mp4 …');
  execSync(
    `ffmpeg -y -framerate ${FPS} -i "${frames}" -c:v libx264 -pix_fmt yuv420p -movflags +faststart -crf 26 "${join(OUT_DIR, 'og-preview.mp4')}"`,
    { stdio: 'inherit' },
  );

  console.log('Encoding og-preview.gif …');
  // Palette pass keeps the GIF small enough for iMessage (< ~4MB)
  execSync(
    `ffmpeg -y -framerate ${FPS} -i "${frames}" -vf "fps=${FPS},scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4" "${join(OUT_DIR, 'og-preview.gif')}"`,
    { stdio: 'inherit' },
  );

  console.log('Writing og-image.png …');
  execSync(`cp "${join(TMP_DIR, 'frame-024.png')}" "${join(OUT_DIR, 'og-image.png')}"`, { stdio: 'inherit' });

  rmSync(TMP_DIR, { recursive: true, force: true });

  const sizes = spawnSync('du', ['-h', OUT_DIR], { encoding: 'utf8' });
  console.log('Done.\n' + execSync(`ls -lh "${OUT_DIR}"`, { encoding: 'utf8' }));
  void sizes;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
