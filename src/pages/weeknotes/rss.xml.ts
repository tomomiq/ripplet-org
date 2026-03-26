import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getCollection('weeknotes');
  posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  return rss({
    title: 'Weeknotes - Tomomi Sasaki',
    description: 'Weekly notes',
    site: context.site!,
    items: posts.map((post) => ({
      title: `${post.data.week} — ${post.data.title}`,
      pubDate: post.data.pubDate,
      link: post.data.permalink,
    })),
  });
}
