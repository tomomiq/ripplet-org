# ripplet-org

Astro site for [ripplet.org](https://www.ripplet.org) — weeknotes and Liberating Structures field notes.

## Setup

```bash
npm install   # installs dependencies and sets up git hooks
npm run dev
```

## Images

Drop images in `public/weeknotes-images/`. The pre-commit hook runs automatically and:
- Converts HEIC → JPEG (output filename: `.jpeg`)
- Compresses JPG/PNG if wider than 1800px (max 1800px, quality 82, EXIF stripped)

Requires ImageMagick 7 (`brew install imagemagick`).

## Books

Book metadata and covers are fetched at build time and cached in `src/lib/books-cache.json` (committed to the repo). When adding new ISBNs to a weeknote:

1. Run `npm run build` locally — fetches the new books and auto-stages the updated cache
2. Commit both the weeknote and `src/lib/books-cache.json` together

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

To refresh later once the ISBN is indexed, delete the entry and run `npm run build`.

Note: ASIN entries (10-character codes like `B0DFGR1TL9`) are auto-detected and not cached — they hit Amazon on every build.

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

# ISBN + ASIN cover override (use when ISBN has metadata but no cover)
# Left of | is the ISBN, right is the ASIN from the Amazon.co.jp product URL
isbn: "4163913971|B0DFGR1TL9"

# ISBN + local cover override (use when API can't find a cover — always takes priority)
# Drop the image in public/weeknotes-images/ and use just the filename
isbn: "9887849332|my-cover.jpg"

# ASIN only (when no ISBN is available)
isbn: "B0DFGR1TL9"
```

The ASIN is the 10-character code after `/dp/` in the Amazon.co.jp URL.

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
