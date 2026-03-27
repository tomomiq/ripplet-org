# ripplet-org

Astro 6 site for ripplet.org. Weeknotes section migrated from Squarespace.

## Stack
- Astro 6 (static output)
- Deployed to Vercel
- Site URL: https://www.ripplet.org

## Structure
- `src/content/weeknotes/` — Markdown files, one per post
- `src/pages/weeknotes/[...page].astro` — paginated river index at /weeknotes
- `src/pages/weeknotes/[...slug].astro` — individual post pages
- `src/pages/weeknotes/rss.xml.ts` — RSS feed at /weeknotes/rss.xml
- `vercel.json` — redirects /weeknotes?format=rss → /weeknotes/rss.xml
- `src/content/ls/` — Markdown files, one per Liberating Structure (22 total)
- `src/pages/liberating-structures/index.astro` — grid index at /liberating-structures
- `src/pages/liberating-structures/[slug].astro` — individual structure pages with sidebar
- `public/liberating-structures/images/` — structure icon images
- `src/lib/books.ts` — build-time book metadata + cover fetching (Google Books, OpenBD, Open Library, Amazon)
- `src/lib/weather.ts` — build-time weather fetching via Open-Meteo (geocoding + archive API)

## Weeknotes frontmatter
week, title, permalink, pubDate (ISO), updatedDate (ISO, optional), image (filename only), caption, location, draft (boolean), isbn (string or array — see README for formats)

## LS frontmatter
title, slug (matches filename), image (filename only), instructions_url, riff_url

## LS sidebar structure
Sidebar splits structures into two groups hardcoded in [slug].astro:
- Microstructures (18 items)
- LS under development: tiny-monsters, narrative-reauthoring, spiral-journal, mad-tea-party

## RSS
Feed is at /weeknotes/rss.xml. The legacy Squarespace URL (/weeknotes?format=rss) redirects to it via vercel.json.
