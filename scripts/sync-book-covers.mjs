#!/usr/bin/env node
// scripts/sync-book-covers.mjs
//
// Phase A: scan weeknote frontmatter for pipe+local-file ISBNs, upload each
//          file to Vercel Blob, update books-cache.json, strip the pipe from
//          frontmatter, and delete the local file.
//
// Phase B: backfill books-cache.json entries whose coverUrl is still an
//          external URL — download and re-upload each to Blob.
//
// Usage: npm run sync-book-covers
//        (loads BLOB_READ_WRITE_TOKEN via --env-file=.env.local)

import fs from 'fs';
import path from 'path';
import { put } from '@vercel/blob';

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.error('BLOB_READ_WRITE_TOKEN not set. Run: vercel env pull .env.local');
  process.exit(1);
}

const CACHE_PATH    = path.join(process.cwd(), 'src/lib/books-cache.json');
const WEEKNOTES_DIR = path.join(process.cwd(), 'src/content/weeknotes');
const PUBLIC_IMAGES = path.join(process.cwd(), 'public/weeknotes-images');
const TIMEOUT       = 15000;

function loadCache() {
  return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

function isAsin(s) {
  return /^[A-Z0-9]{10}$/.test(s) && /[A-Z]/.test(s);
}

function normalizeIsbn(raw) {
  const clean = raw.replace(/[\s-]/g, '');
  if (clean.length === 13) return clean;
  if (clean.length === 10) {
    const nine = '978' + clean.slice(0, 9);
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += parseInt(nine[i]) * (i % 2 === 0 ? 1 : 3);
    const check = (10 - (sum % 10)) % 10;
    return nine + String(check);
  }
  return clean;
}

function extFromContentType(ct) {
  if (ct.includes('png'))  return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  return 'jpg';
}

async function uploadFile(isbn13, filePath) {
  const rawExt = path.extname(filePath).slice(1).toLowerCase();
  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt || 'jpg';
  const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const buffer = fs.readFileSync(filePath);
  const { url } = await put(`book-covers/${isbn13}.${ext}`, buffer, {
    access: 'public',
    addRandomSuffix: false,
    contentType,
    token,
  });
  return url;
}

async function uploadUrl(isbn13, coverUrl) {
  const res = await fetch(coverUrl, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${coverUrl}`);
  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  const ext = extFromContentType(contentType);
  const { url } = await put(`book-covers/${isbn13}.${ext}`, await res.arrayBuffer(), {
    access: 'public',
    addRandomSuffix: false,
    contentType,
    token,
  });
  return url;
}

function stripPipe(content, isbnRaw, overrideRaw) {
  const ei = isbnRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const eo = overrideRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match quoted "isbn|override" (with optional inline comment inside the string)
  const re = new RegExp(`(["'])${ei}\\|${eo}(?:#[^"']*)?\\1`, 'g');
  return content.replace(re, (_, q) => `${q}${isbnRaw}${q}`);
}

// ─── Phase A ────────────────────────────────────────────────────────────────

async function phaseA() {
  console.log('\n── Phase A: local file overrides ──');
  const cache = loadCache();
  const uploaded = new Set(); // track ISBNs already uploaded this run

  const mdFiles = fs.readdirSync(WEEKNOTES_DIR)
    .filter(f => f.endsWith('.md'))
    .sort();

  for (const filename of mdFiles) {
    const filePath = path.join(WEEKNOTES_DIR, filename);
    let content = fs.readFileSync(filePath, 'utf-8');

    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) continue;

    const pipeRe = /["']([^"'|]+)\|([^"']+)["']/g;
    let match;
    let changed = false;

    while ((match = pipeRe.exec(fmMatch[1])) !== null) {
      const isbnRaw     = match[1].trim();
      const overrideRaw = match[2].split('#')[0].trim();

      if (isAsin(overrideRaw)) continue;

      // Resolve local path
      let localPath;
      if (overrideRaw.startsWith('/weeknotes-images/')) {
        localPath = path.join(process.cwd(), 'public', overrideRaw);
      } else if (overrideRaw.startsWith('/') || overrideRaw.startsWith('http')) {
        continue;
      } else {
        localPath = path.join(PUBLIC_IMAGES, overrideRaw);
      }

      const isbn13 = normalizeIsbn(isbnRaw);

      if (!uploaded.has(isbn13)) {
        if (!fs.existsSync(localPath)) {
          console.warn(`  [skip] file not found: ${localPath}`);
          continue;
        }

        console.log(`  ${path.basename(localPath)} → book-covers/${isbn13}.*`);
        try {
          const blobUrl = await uploadFile(isbn13, localPath);

          const existing = cache[isbn13];
          if (existing && !('notFound' in existing)) {
            cache[isbn13] = { ...existing, coverUrl: blobUrl };
          } else {
            cache[isbn13] = {
              title: null, author: null, publisher: null,
              year: null, coverUrl: blobUrl, infoUrl: null,
              cachedAt: new Date().toISOString(),
            };
          }
          saveCache(cache);

          fs.unlinkSync(localPath);
          console.log(`    deleted ${path.basename(localPath)}`);
          uploaded.add(isbn13);
        } catch (e) {
          console.error(`    [error] ${e.message}`);
          continue;
        }
      }

      content = stripPipe(content, isbnRaw, overrideRaw);
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(filePath, content);
      console.log(`  updated frontmatter: ${filename}`);
    }
  }
}

// ─── Phase B ────────────────────────────────────────────────────────────────

async function phaseB() {
  console.log('\n── Phase B: API cover backfill ──');
  const cache = loadCache();

  const entries = Object.entries(cache).filter(([, v]) =>
    !('notFound' in v) && v.coverUrl && !v.coverUrl.includes('vercel-storage.com')
  );

  console.log(`  ${entries.length} entries to backfill`);

  for (const [isbn13, entry] of entries) {
    console.log(`  ${isbn13} — "${entry.title}"`);
    try {
      const blobUrl = await uploadUrl(isbn13, entry.coverUrl);
      cache[isbn13] = { ...entry, coverUrl: blobUrl };
      saveCache(cache);
      console.log(`    → ${blobUrl}`);
    } catch (e) {
      console.error(`    [error] ${e.message}`);
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

await phaseA();
await phaseB();
console.log('\nDone.');
