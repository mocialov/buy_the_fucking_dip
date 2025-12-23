#!/usr/bin/env node
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
const distDir = resolve(root, 'dist');
const outFile = resolve(distDir, 'sitemap.xml');

let siteUrl = process.env.SITE_URL?.trim();
if (!siteUrl) {
  try {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    if (pkg.homepage && typeof pkg.homepage === 'string') siteUrl = pkg.homepage.trim();
  } catch {}
}

if (siteUrl && !siteUrl.endsWith('/')) siteUrl += '/';

if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

const now = new Date().toISOString();

const urls = [
  { loc: siteUrl ? siteUrl : '/', lastmod: now, changefreq: 'daily', priority: '0.8' },
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
urls.map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n') +
`\n</urlset>\n`;

writeFileSync(outFile, xml, 'utf8');

if (!siteUrl) {
  console.warn('[sitemap] SITE_URL not set; wrote relative root \'/\' to sitemap.xml. Set env SITE_URL or package.json.homepage for correct absolute URLs.');
}

console.log(`[sitemap] Wrote ${outFile}`);
