// Fetch book metadata and cover at build time.
//
// ISBN fallback chain:
//   1. Google Books (ISBN-13)
//   2. Google Books (ISBN-10)
//   3. OpenBD — Japanese publisher consortium
//   4. Open Library search API
//   5. Cover-only: Google Books by title → OpenBD CDN → Open Library → Amazon.co.jp search
//
// ASIN fallback chain:
//   1. Amazon CDN cover (verified)
//   2. Amazon.co.jp scrape (title/author)
//   3. Amazon.com scrape (title fallback)
//
// Local cover override (pipe syntax):
//   isbn: "9887849332|/weeknotes-images/my-cover.jpg"
//   A local path or full URL always takes priority over any API-fetched cover.
//
// Cache:
//   Results (including not-found) are written to books-cache.json (committed to repo).
//   On subsequent builds, cached ISBNs skip all API calls.
//   Note: ASIN lookups (10-char alphanumeric with letters) are not cached.

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface BookData {
  isbn: string;
  title: string | null;
  author: string | null;
  publisher: string | null;
  year: string | null;
  coverUrl: string | null;
  infoUrl: string | null;
}

function toIsbn10(isbn13: string): string | null {
  if (!isbn13 || isbn13.length !== 13 || !isbn13.startsWith('978')) return null;
  const nine = isbn13.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(nine[i]) * (10 - i);
  const check = (11 - (sum % 11)) % 11;
  return nine + (check === 10 ? 'X' : String(check));
}

function toIsbn13(isbn10: string): string | null {
  const clean = isbn10.replace(/[^0-9Xx]/g, '');
  if (clean.length !== 10) return null;
  const nine = '978' + clean.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(nine[i]) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return nine + String(check);
}

const TIMEOUT = 8000;
const MIN_COVER_BYTES = 20000;
const GB_KEY = import.meta.env.GOOGLE_BOOKS_API_KEY
  ? `&key=${import.meta.env.GOOGLE_BOOKS_API_KEY}`
  : '';

const CACHE_PATH = join(process.cwd(), 'src/lib/books-cache.json');
type CacheEntry = (Omit<BookData, 'isbn'> & { cachedAt: string }) | { notFound: true; cachedAt: string };
type BookCache = Record<string, CacheEntry>;

function loadCache(): BookCache {
  try { return JSON.parse(readFileSync(CACHE_PATH, 'utf-8')); }
  catch { return {}; }
}

function saveCache(cache: BookCache): void {
  try { writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2)); }
  catch (e) { console.warn('[books] Failed to write cache:', e); }
}

const bookCache: BookCache = loadCache();

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
};

async function verifyImageUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) return false;
    const len = parseInt(res.headers.get('content-length') ?? '0');
    if (len === 0) return true; // content-length absent — accept the image
    return len >= MIN_COVER_BYTES;
  } catch { return false; }
}

async function tryGoogleBooks(isbn: string): Promise<Omit<BookData, 'isbn'> | null> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1${GB_KEY}`,
      { signal: AbortSignal.timeout(TIMEOUT) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const info = data.items?.[0]?.volumeInfo;
    if (!info) return null;
    const links = info.imageLinks;
    let coverUrl = null;
    if (links) {
      const raw = links.extraLarge || links.large || links.medium || links.small || links.thumbnail || links.smallThumbnail;
      if (raw) {
        const url = (raw as string).replace('http://', 'https://').replace(/zoom=\d/, 'zoom=0');
        if (await verifyImageUrl(url)) coverUrl = url;
      }
    }
    return {
      title:     info.title ?? null,
      author:    info.authors?.[0] ?? null,
      publisher: info.publisher ?? null,
      year:      info.publishedDate ? String(info.publishedDate).slice(0, 4) : null,
      coverUrl,
      infoUrl:   `https://books.google.com/books?isbn=${isbn}`,
    };
  } catch { return null; }
}

export async function fetchBook(input: string, suppressCoverWarn = false): Promise<BookData | null> {
  const clean = input.replace(/[\s-]/g, '');
  const isbn13 = clean.length === 10 ? (toIsbn13(clean) ?? clean) : clean;
  const isbn10 = toIsbn10(isbn13);

  // Return cached result if available
  const cached = bookCache[isbn13];
  if (cached) {
    if ('notFound' in cached) return null;
    const { cachedAt, ...data } = cached;
    console.log(`[books] Cache hit: ${isbn13}`);
    return { isbn: isbn13, ...data };
  }

  // 1. Google Books (ISBN-13, then ISBN-10)
  let result = await tryGoogleBooks(isbn13);
  if (!result && isbn10) result = await tryGoogleBooks(isbn10);

  // 2. OpenBD — Japanese publisher consortium
  if (!result) {
    try {
      const res = await fetch(
        `https://api.openbd.jp/v1/get?isbn=${isbn13}`,
        { signal: AbortSignal.timeout(TIMEOUT) }
      );
      if (res.ok) {
        const data = await res.json();
        const s = data?.[0]?.summary;
        if (s) {
          result = {
            title:     s.title ?? null,
            author:    s.author ?? null,
            publisher: s.publisher ?? null,
            year:      s.pubdate ? String(s.pubdate).slice(0, 4) : null,
            coverUrl:  s.cover ?? null,
            infoUrl:   `https://books.google.com/books?isbn=${isbn13}`,
          };
        }
      }
    } catch { /* continue */ }
  }

  // 3. Open Library search API
  if (!result) {
    try {
      const res = await fetch(
        `https://openlibrary.org/search.json?isbn=${isbn13}&limit=1`,
        { signal: AbortSignal.timeout(TIMEOUT) }
      );
      if (res.ok) {
        const data = await res.json();
        const doc = data.docs?.[0];
        if (doc) {
          result = {
            title:     doc.title ?? null,
            author:    doc.author_name?.[0] ?? null,
            publisher: doc.publisher?.[0] ?? null,
            year:      doc.first_publish_year ? String(doc.first_publish_year) : null,
            coverUrl:  doc.cover_i
              ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
              : null,
            infoUrl:   doc.key ? `https://openlibrary.org${doc.key}` : null,
          };
        }
      }
    } catch { /* continue */ }
  }

  // 4. Cover-only fallbacks (when we have metadata but no cover)
  if (result && !result.coverUrl) {
    // 4a. Google Books by title + author
    if (result.title) {
      try {
        const q = `intitle:${result.title}${result.author ? `+inauthor:${result.author}` : ''}`;
        const res = await fetch(
          `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1${GB_KEY}`,
          { signal: AbortSignal.timeout(TIMEOUT) }
        );
        if (res.ok) {
          const data = await res.json();
          const links = data.items?.[0]?.volumeInfo?.imageLinks;
          if (links) {
            const raw = links.extraLarge || links.large || links.medium || links.small || links.thumbnail || links.smallThumbnail;
            if (raw) {
              const url = (raw as string).replace('http://', 'https://').replace(/zoom=\d/, 'zoom=0');
              if (await verifyImageUrl(url)) result.coverUrl = url;
            }
          }
        }
      } catch { /* continue */ }
    }

    // 4b. OpenBD deterministic cover URL
    if (!result.coverUrl) {
      const obdCover = `https://cover.openbd.jp/${isbn13}.jpg`;
      try {
        const check = await fetch(obdCover, { method: 'HEAD', signal: AbortSignal.timeout(TIMEOUT) });
        if (check.ok) result.coverUrl = obdCover;
      } catch { /* continue */ }
    }

    // 4c. Open Library cover by ISBN
    if (!result.coverUrl) {
      const olCover = `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`;
      try {
        const check = await fetch(`${olCover}?default=false`, { method: 'HEAD', signal: AbortSignal.timeout(TIMEOUT) });
        if (check.ok) result.coverUrl = olCover;
      } catch { /* continue */ }
    }

    // 4d. Amazon.co.jp search by ISBN → extract ASIN → CDN cover
    if (!result.coverUrl) {
      try {
        const res = await fetch(`https://www.amazon.co.jp/s?k=${isbn13}&i=stripbooks`, {
          headers: BROWSER_HEADERS,
          signal: AbortSignal.timeout(TIMEOUT),
        });
        if (res.ok) {
          const html = await res.text();
          const asinMatch = html.match(/\/dp\/([A-Z0-9]{10})\//);
          if (asinMatch) {
            const asinCover = `https://images-na.ssl-images-amazon.com/images/P/${asinMatch[1]}.01.LZZZZZZZ.jpg`;
            if (await verifyImageUrl(asinCover)) result.coverUrl = asinCover;
          }
        }
      } catch { /* continue */ }
    }
  }

  if (!result) {
    console.warn(`[books] No data found for ISBN ${isbn13}`);
    bookCache[isbn13] = { notFound: true, cachedAt: new Date().toISOString() };
    saveCache(bookCache);
  } else {
    if (!result.coverUrl && !suppressCoverWarn) {
      console.warn(`[books] No cover found for ISBN ${isbn13} — "${result.title}"`);
    }
    bookCache[isbn13] = { ...result, cachedAt: new Date().toISOString() };
    saveCache(bookCache);
  }

  return result ? { isbn: isbn13, ...result } : null;
}

async function fetchCoverFromAsin(asin: string): Promise<string | null> {
  const url = `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.LZZZZZZZ.jpg`;
  try {
    if (await verifyImageUrl(url)) return url;
  } catch { /* continue */ }
  return null;
}

async function fetchBookByAsin(asin: string): Promise<BookData | null> {
  // 1. Amazon CDN cover (deterministic, verified by size)
  let coverUrl = await fetchCoverFromAsin(asin);

  // 2. Amazon.co.jp scrape for title/author
  let title: string | null = null;
  let author: string | null = null;
  try {
    const res = await fetch(`https://www.amazon.co.jp/dp/${asin}`, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (res.ok) {
      const html = await res.text();
      const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
                  || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
      if (ogTitle) title = ogTitle[1].replace(/\s*[|–-]\s*(本|通販|Amazon|ebook|Kindle).*/i, '').trim() || null;
      const byline = html.match(/class=["'][^"']*contributorNameID[^"']*["'][^>]*>([^<]+)</i);
      if (byline) author = byline[1].trim() || null;
    }
  } catch { /* continue */ }

  // 3. Amazon.com fallback for title
  if (!title) {
    try {
      const res = await fetch(`https://www.amazon.com/dp/${asin}`, {
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(TIMEOUT),
      });
      if (res.ok) {
        const html = await res.text();
        const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
                    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
        if (ogTitle) title = ogTitle[1].replace(/\s*[|–-]\s*(Books|Amazon|Kindle|eBook).*/i, '').trim() || null;
      }
    } catch { /* continue */ }
  }

  if (!coverUrl && !title) {
    console.warn(`[books] No data found for ASIN ${asin}`);
    return null;
  }
  if (!coverUrl) console.warn(`[books] No cover found for ASIN ${asin} — "${title}"`);

  return {
    isbn: asin,
    title,
    author,
    publisher: null,
    year: null,
    coverUrl,
    infoUrl: `https://www.amazon.co.jp/dp/${asin}`,
  };
}

export async function fetchBooks(identifiers: string[]): Promise<BookData[]> {
  if (!identifiers.length) return [];
  return (await Promise.all(
    identifiers.map(async id => {
      const isAsin = /^[A-Z0-9]{10}$/.test(id) && /[A-Z]/.test(id);
      if (isAsin) return fetchBookByAsin(id);
      if (id.includes('|')) {
        const [isbnPart, override] = id.split('|');
        const o = override.trim();
        const isAsinOverride = /^[A-Z0-9]{10}$/.test(o) && /[A-Z]/.test(o);
        const resolvedOverride = (!isAsinOverride && !o.startsWith('/') && !o.startsWith('http'))
          ? `/weeknotes-images/${o}`
          : o;
        const hasLocalCover = resolvedOverride.startsWith('/') || resolvedOverride.startsWith('http');
        const book = await fetchBook(isbnPart.trim(), hasLocalCover);
        if (book) {
          if (hasLocalCover) {
            book.coverUrl = resolvedOverride;
          } else {
            if (!book.coverUrl) book.coverUrl = await fetchCoverFromAsin(resolvedOverride);
          }
        }
        return book;
      }
      return fetchBook(id);
    })
  )).filter((b): b is BookData => b !== null);
}
