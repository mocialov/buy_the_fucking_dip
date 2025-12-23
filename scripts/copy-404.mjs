#!/usr/bin/env node
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const src = resolve(root, 'dist/index.html');
const dest = resolve(root, 'dist/404.html');

if (!existsSync(src)) {
  console.error('[404] dist/index.html not found; build first.');
  process.exit(1);
}

copyFileSync(src, dest);
console.log('[404] Copied dist/index.html -> dist/404.html');
