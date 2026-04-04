import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import type { APIContext } from 'astro';
import { fetchBooks } from '../../lib/books';

function firstParagraph(body: string): string {
  const blocks = body.split(/\n\n+/);
  const para = blocks.find(b => {
    const t = b.trim();
    return t && !t.startsWith('#') && !t.startsWith('!') && !t.startsWith('---');
  }) ?? '';
  return para
    .replace(/^>\s*/gm, '')           // blockquote markers
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/\*(.+?)\*/g, '$1')     // italic
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // links
    .replace(/\\\n/g, ' ')           // line-break continuations
    .replace(/\n/g, ' ')
    .trim();
}

function itemDescription(post: CollectionEntry<'weeknotes'>, books: { title: string | null; author: string | null }[]): string {
  const text = firstParagraph(post.body ?? '');
  const img = post.data.image
    ? `<img src="https://www.ripplet.org/weeknotes-images/${post.data.image}" alt="" />`
    : '';
  const bookList = books.length > 0
    ? '📚 Books: ' + books.map(b => b.title + (b.author ? ` (${b.author})` : '')).filter(Boolean).join(', ')
    : '';
  return `${img}${text ? `<p>${text}</p>` : ''}${bookList ? `<p>${bookList}</p>` : ''}`;
}

export async function GET(context: APIContext) {
  const allPosts = await getCollection('weeknotes');
  const posts = allPosts.filter(p => !p.data.draft);
  posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  return rss({
    title: 'Weeknotes - Tomomi Sasaki',
    description: 'Weekly notes',
    site: context.site!,
    items: await Promise.all(posts.map(async (post) => {
      const isbns = post.data.isbn
        ? (Array.isArray(post.data.isbn) ? post.data.isbn : [post.data.isbn])
        : [];
      const books = await fetchBooks(isbns);
      return {
        title: `${post.data.week} — ${post.data.title}`,
        pubDate: post.data.pubDate,
        link: post.data.permalink,
        description: itemDescription(post, books),
      };
    })),
  });
}
