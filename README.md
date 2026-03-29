# ripplet-org

Astro site for [ripplet.org](https://www.ripplet.org) — weeknotes and Liberating Structures field notes.

## Setup

```bash
npm install   # installs dependencies and sets up git hooks
npm run dev
```

## Images

Drop images in `public/weeknotes-images/`. The pre-commit hook runs automatically and:
- Converts HEIC → JPEG
- Compresses JPG/PNG if wider than 1800px (max 1800px, quality 82, EXIF stripped)

Requires ImageMagick 7 (`brew install imagemagick`).

## Books

Book metadata and covers are fetched at build time and cached in `src/lib/books-cache.json` (committed to the repo). When adding new ISBNs to a weeknote:

1. Run `npm run build` locally — fetches the new books and auto-stages the updated cache
2. Commit both the weeknote and `src/lib/books-cache.json` together

The pre-commit hook will block the commit if any ISBN in a staged weeknote isn't in the cache yet.

Note: `asin:` entries are not cached and hit Amazon on every build.

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
# Drop the image in public/weeknotes-images/ and reference it here
isbn: "9887849332|/weeknotes-images/my-cover.jpg"

# ASIN only (when no ISBN is available)
isbn: "asin:B0DFGR1TL9"
```

The ASIN is the 10-character code after `/dp/` in the Amazon.co.jp URL.
