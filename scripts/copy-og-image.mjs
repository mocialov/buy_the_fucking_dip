#!/usr/bin/env node
import { readdirSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const srcImagesDir = resolve(root, 'src/images');
const distDir = resolve(root, 'dist');
const outPath = resolve(distDir, 'og-image.png');

try {
  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }
  const files = readdirSync(srcImagesDir).filter(f => f.toLowerCase().endsWith('.png'));
  if (!files.length) {
    console.warn('[og-image] No PNGs found in src/images. Skipping og-image copy.');
    process.exit(0);
  }
  // Pick the first PNG as the share image
  const chosen = files[0];
  const srcPath = resolve(srcImagesDir, chosen);
  copyFileSync(srcPath, outPath);
  console.log(`[og-image] Copied ${chosen} -> dist/og-image.png`);
} catch (err) {
  console.error('[og-image] Failed to copy image:', err);
  process.exit(1);
}
