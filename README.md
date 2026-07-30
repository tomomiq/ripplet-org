# ripplet-org

Astro 7 site for [ripplet.org](https://www.ripplet.org) — weeknotes, trips, writing, and Liberating Structures.

## Setup

```bash
npm install   # installs dependencies and sets up git hooks
vercel dev    # use vercel dev (not astro dev) — required for server-rendered routes
```

## Images

Drop images in `public/weeknotes-images/`. The pre-commit hook runs automatically and:
- Converts HEIC → JPEG (output filename: `.jpeg`)
- Compresses JPG/PNG if wider than 1800px (max 1800px, quality 82, EXIF stripped)

Requires ImageMagick 7 (`brew install imagemagick`).

## Books

Book metadata and covers are fetched when a weeknote page loads in `vercel dev`, and cached in `src/lib/books-cache.json` (committed to the repo). Covers are uploaded to Vercel Blob at cache-fill time and served from there. Opening the weeknote in the browser populates the cache — then commit both the weeknote and `src/lib/books-cache.json` together.

The pre-commit hook will block the commit if any ISBN in a staged weeknote isn't in the cache yet.

### If API calls return nothing (e.g. newly published books)

Add the entry manually to `src/lib/books-cache.json` — the build will use it as-is and skip all API calls:

```json
"9781067626358": {
  "title": "Book Title",
  "author": "Author Name",
  "publisher": null,
  "year": "2026",
  "coverUrl": "https://m.media-amazon.com/images/I/813h1dFIN7L._SL500_.jpg",
  "infoUrl": "https://www.amazon.com/dp/B0GT4K7N6G",
  "cachedAt": "2026-04-02T00:00:00.000Z"
}
```

To refresh later once the ISBN is indexed, delete the entry and open the weeknote in `vercel dev`.

Note: ASIN entries (10-character codes like `B0DFGR1TL9`) are auto-detected and cached the same way as ISBNs — cover uploaded to Blob on first load, cache hit on subsequent builds.

### Publisher links

Run `npm run find-publisher-links` occasionally to add publisher or author website links to cached books. Claude searches the web, proposes a URL, and you approve each one before it's saved. Requires `ANTHROPIC_API_KEY` in your environment (same key as `generate-descriptions`).

Approved links are stored as `publisherUrl` in `books-cache.json`. The book widget links to `publisherUrl` when present, falling back to `infoUrl`.

### Validating the cache

```bash
npm run validate-cache   # checks JSON syntax and field names without committing
```

Run this to check `books-cache.json` is well-formed. The pre-commit hook runs it automatically.

### Cover recovery

If a cover fails to upload to Blob (e.g. an API outage), run:

```bash
npm run sync-book-covers
```

Skips covers already on Blob and retries any cache entries still pointing at external URLs. Also handles local cover overrides (pipe syntax) if you want to trigger that without committing.

## Fitness

Add a `fitness` block to a weeknote's frontmatter to show a Fitness section below Books.

```yaml
fitness:
  week_type: build        # build | maintain | recovery
  activities:
    - activity: kettlebell sessions
      count: 2
    - activity: long walk
      count: 1
```

**week_type** — displayed as a coloured badge (green = build, amber = maintain, purple = recovery).

**activity** — name is matched to an emoji icon automatically. Known activities: bicycle/cycling, stretch/pilates, yoga, mobility, walk, run/jog, swim, kettlebell/weights/strength, hike, climb, dance, massage. Unknown activities fall back to ⚡.

Omit `fitness` entirely to hide the section.

## SEO descriptions

Meta descriptions for writing and trips pages are generated via the Claude API. Run before committing new content:

```bash
npm run generate-descriptions:all   # writing + trips (skips files with good descriptions)
npm run generate-descriptions       # writing only
npm run generate-descriptions:trips # trips only
```

Files with an existing description of 80+ characters are left untouched. Requires `ANTHROPIC_API_KEY` in your environment.

## Deploy

Deployed on Vercel. Push to `main` to deploy.

## RSS

Feed: `https://www.ripplet.org/weeknotes/rss.xml`
Legacy URL `?format=rss` redirects automatically.

## Weeknotes frontmatter

| Field | Required | Description |
|---|---|---|
| `week` | yes | Label shown above the title, e.g. `Week 11, 2026` |
| `title` | yes | Post title |
| `permalink` | yes | URL path, e.g. `/weeknotes/week-11-2026` |
| `pubDate` | yes | ISO date, e.g. `2026-03-17` |
| `updatedDate` | no | ISO date of last edit |
| `draft` | no | `true` hides the post from the site |
| `location` | no | City name — used to fetch weather icon and temperature |
| `image` | no | Filename only (no path), served from `/weeknotes-images/` |
| `caption` | no | Caption shown below the image |
| `isbn` | no | Book identifier(s) — see formats below |

### isbn formats

Books appear as a cover grid at the bottom of the post. Fetched at build time.

```yaml
# Single book — ISBN-13 or ISBN-10, hyphens ok
isbn: "9784103559719"

# Multiple books
isbn:
  - "9784103559719"
  - "978-4797674699"

# ISBN + local cover override (use when API can't find a cover — always takes priority)
# Drop the image in public/weeknotes-images/ and use just the filename, then commit.
# The pre-commit hook uploads it to Blob, updates the cache, strips the pipe, and deletes the file.
isbn: "9887849332|my-cover.jpg"

# ASIN only (when no ISBN is available)
isbn: "B0DFGR1TL9"
```

The ASIN is the 10-character code after `/dp/` in the Amazon.co.jp URL.

## Trips frontmatter

| Field | Required | Description |
|---|---|---|
| `title` | yes | Trip title |
| `description` | yes | SEO meta description |
| `canonicalUrl` | yes | Full URL, e.g. `https://www.ripplet.org/camino-del-norte` |
| `year` | yes | Year as a number |
| `thumbnail` | no | Image path for index views |

## Writing frontmatter

| Field | Required | Description |
|---|---|---|
| `title` | yes | Essay title |
| `date` | yes | ISO date, e.g. `2026-03-17` |
| `description` | yes | SEO meta description |
| `collection` | yes | e.g. `books`, `facilitation`, `project-craft`, `studio-practice` |
| `permalink` | yes | Full path, e.g. `/thinking-in-systems` |
| `draft` | no | `true` hides the post from the site |

## Travel (private)

Password-protected section at `/travel`. Only accessible after logging in at `/travel/login`.

Password is set via `SITE_PRIVATE_PASSWORD` in `.env.local` (local) and the Vercel dashboard (production). To log out, visit `/api/logout`.

One Markdown file per year in `src/content/travel/`. Images go in `public/travel/[year]/`.

### Travel frontmatter

| Field | Required | Description |
|---|---|---|
| `title` | yes | Page title, e.g. `"2025"` |
| `year` | yes | Year as a number |
| `description` | no | Optional note for your own reference |

### Travel images

Same conventions as trips — image grids, column layouts, and captions all work the same way.

```markdown
![caption](/travel/2025/photo.jpg)

<div class="image-grid">

![](/travel/2025/photo1.jpg)
![](/travel/2025/photo2.jpg)

</div>
```

The blank lines inside `<div class="image-grid">` are required — without them CommonMark treats the images as raw HTML and they won't render.

macOS/iOS exports often add suffixes like `+(1)`, `+copy`, `_Original`, `_2` to filenames. Strip these to the clean base name and update the markdown to match.

## Markdown reference

Standard markdown (bold, italic, links, bullet lists, headings) works as expected. The following have custom styling or non-obvious behaviour.

### Images

Multiple images with no blank line between them render as a **2-column grid** with a photo-frame border:

```markdown
![](/weeknotes-images/photo1.jpg)
![](/weeknotes-images/photo2.jpg)
```

A single image on its own renders full-width.

### Dividers

`---` renders as a **◆ diamond** divider, not a horizontal line.

### Blockquotes

`>` creates a blockquote with a left border and italic text. For multi-line quotes without paragraph spacing between lines, end each line with `\`:

```markdown
> To wisely live your life, you don't need to know much\
> Just remember two main rules for the beginning:\
> You better starve, than eat whatever\
> And better be alone, than with whoever.\
> —Omar Khayyam
```

A blank line between `>` blocks creates separate blockquotes.
