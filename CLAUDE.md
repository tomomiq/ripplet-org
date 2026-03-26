# ripplet-org

Astro 6 site for ripplet.org. Weeknotes section migrated from Squarespace.

## Stack
- Astro 6 (static output)
- Deployed to Vercel
- Site URL: https://www.ripplet.org

## Structure
- `src/content/weeknotes/` — Markdown files, one per post
- `src/pages/weeknotes/[...page].astro` — paginated river index at /weeknotes
- `src/pages/weeknotes/[slug].astro` — individual post pages
- `src/pages/weeknotes/rss.xml.ts` — RSS feed at /weeknotes/rss.xml
- `vercel.json` — redirects /weeknotes?format=rss → /weeknotes/rss.xml

## Weeknotes frontmatter
week, title, permalink, pubDate (ISO), image (filename only), caption, location

## RSS
Feed is at /weeknotes/rss.xml. The legacy Squarespace URL (/weeknotes?format=rss) redirects to it via vercel.json.
