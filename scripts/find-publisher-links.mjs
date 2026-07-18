import fs from 'fs';
import path from 'path';
import readline from 'readline';
import Anthropic from '@anthropic-ai/sdk';

const CACHE_PATH = path.join(process.cwd(), 'src/lib/books-cache.json');
const LIMIT = 6;

const BLOCKED = [
  'amazon.com', 'amazon.co.jp', 'amazon.co.uk', 'amazon.com.au',
  'goodreads.com', 'play.google.com', 'books.google.com',
  'apple.com', 'kobo.com', 'bookshop.org', 'audible.com',
  'barnesandnoble.com', 'thriftbooks.com', 'abebooks.com',
  'ebay.com', 'worldcat.org', 'openlibrary.org',
  'bookmeter.com', 'kinokuniya.co.jp', 'honto.jp',
  'hmv.co.jp', 'bookwalker.jp', 'booklive.jp',
];

const client = new Anthropic();

function isBlocked(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return BLOCKED.some(d => host === d || host.endsWith('.' + d));
  } catch { return true; }
}

async function search(book) {
  const parts = [`"${book.title}"`];
  if (book.author) parts.push(`"${book.author}"`);
  if (book.publisher) parts.push(`"${book.publisher}"`);
  const query = parts.join(' ');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    tools: [{ type: 'web_search_20260209', name: 'web_search' }],
    messages: [{
      role: 'user',
      content: `Find the official publisher page or author website for this book: ${query}.

Do not link to Amazon, Goodreads, Google Books, Kobo, Apple Books, Bookshop.org, book retailers, or aggregator sites.
Target: the publisher's own book page or the author's official website.

Reply with ONLY the URL on a single line. If no suitable page exists, reply with: NOT_FOUND`,
    }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock) return null;

  const text = textBlock.text.trim();
  if (text.startsWith('NOT_FOUND')) return null;

  const urlMatch = text.match(/https?:\/\/[^\s)>]+/);
  if (!urlMatch) return null;

  const url = urlMatch[0].replace(/[.,;:!?)]+$/, '');
  return isBlocked(url) ? null : url;
}

function link(url) {
  return `\x1B]8;;${url}\x1B\\${url}\x1B]8;;\x1B\\`;
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(resolve => rl.question(q, a => resolve(a.trim())));

async function main() {
  const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));

  const candidates = Object.entries(cache)
    .filter(([, v]) => !v.notFound && v.publisherUrl === undefined && v.title)
    .sort((a, b) => new Date(b[1].cachedAt) - new Date(a[1].cachedAt))
    .slice(0, LIMIT);

  if (!candidates.length) {
    console.log('All books already have publisher links.');
    rl.close();
    return;
  }

  console.log(`\nSearching for ${candidates.length} book(s) in parallel...\n`);

  const results = await Promise.all(
    candidates.map(async ([isbn, book]) => {
      process.stdout.write(`  • ${book.title}\n`);
      try {
        const url = await search(book);
        return { isbn, book, url, err: null };
      } catch (e) {
        return { isbn, book, url: null, err: e.message };
      }
    })
  );

  console.log('\n— Review —\n');
  let updated = 0;

  for (const { isbn, book, url: result, err } of results) {
    console.log(`📖 ${book.title}${book.author ? ` — ${book.author}` : ''}`);
    if (err) console.log(`   Search error: ${err}`);

    let answer;
    if (result) {
      console.log(`   ${link(result)}`);
      answer = await ask('   Accept? [y/n or paste URL] → ');
    } else {
      console.log('   No suitable result found.');
      answer = await ask('   Enter a URL or press enter to skip → ');
    }

    if (answer.toLowerCase() === 'y' && result) {
      cache[isbn].publisherUrl = result;
      updated++;
    } else if (answer.startsWith('http')) {
      cache[isbn].publisherUrl = answer;
      updated++;
    }

    console.log();
  }

  rl.close();

  if (updated > 0) {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
    console.log(`Saved ${updated} publisher link(s) to books-cache.json`);
  } else {
    console.log('No changes made.');
  }
}

main().catch(err => {
  console.error(err);
  rl.close();
  process.exit(1);
});
