# ripplet-org

Astro 6 site for ripplet.org. Weeknotes and Trips sections migrated from Squarespace.

## Stack
- Astro 6 (static output)
- Deployed to Vercel
- Site URL: https://www.ripplet.org

## Image handling
- Images live in `public/weeknotes-images/`
- Pre-commit hook (Husky) auto-compresses on `git commit`: HEIC → JPEG always; JPG/PNG only if wider than 1800px
- Scripts in `.husky/scripts/compress-images.sh`
- Hook installs automatically via `npm install`

## Book cache workflow
- `src/lib/books-cache.json` is committed to the repo and must be kept up to date
- When adding new ISBNs to a weeknote, run `npm run build` locally before committing — this fetches book data and auto-stages the updated cache (`postbuild` script handles the `git add`)
- Pre-commit hook (`.husky/scripts/check-books-cache.sh`) blocks the commit if any staged weeknote contains an ISBN not yet in the cache
- ASIN lookups (auto-detected: 10 alphanumeric chars containing letters) are not cached — they hit Amazon on every build

## Content collections config
- **Location: `src/content.config.ts`** (NOT `src/content/config.ts` — Astro 6 looks in `src/`)
- Defines the `trips` collection with the glob loader; `weeknotes` and `ls` are also defined there (without schemas) so they remain visible once any config exists
- Adding a `src/content.config.ts` switches Astro to explicit mode — any collection not listed there will silently disappear

## Trips section
- `src/content/trips/` — Markdown files, one per trip page
- `src/pages/trips/[slug].astro` — individual trip pages at /trips/[slug]
- `src/layouts/TripLayout.astro` — layout for all trip pages; includes Header and NewsletterFooter
- `public/trips/[slug]/` — images for each trip (e.g. `public/trips/western-alps/`)
- Legacy Squarespace URLs redirect via `vercel.json` (e.g. `/cycling-western-alps` → `/trips/western-alps`)

## Trips frontmatter
title, description, canonicalUrl (https://www.ripplet.org/original-slug), year (number), thumbnail (optional, for index views)

## Trips image convention
- Images go in `public/trips/[slug]/` and are referenced as `![](/trips/[slug]/FILENAME.jpg)`
- Consecutive images with no blank lines between them render as a 3-column square grid (CSS in TripLayout)
- A single image on its own renders full-width
- Filenames with `+` or `()` should be sanitised on download — replace `+` and `()` with `_`

## Trips layout patterns
- Iframe embed paired with text → wrap both in `<div class="media-and-text">`, with the text in an inner `<div>`. Renders as 50/50 columns on desktop, stacked on mobile
- Strava embeds not yet replaced → placeholder: `*[REPLACE WITH MY OWN WIDGET — Day N ride]*`
- Google Maps / route overview not yet replaced → `*[REPLACE WITH MY OWN WIDGET — route overview map]*`

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
- `src/lib/books-cache.json` — committed cache of fetched book data; cached ISBNs skip all API calls on subsequent builds
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
