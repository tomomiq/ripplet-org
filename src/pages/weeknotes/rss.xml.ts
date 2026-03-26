import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const allPosts = await getCollection('weeknotes');
  const posts = allPosts.filter(p => !p.data.draft);
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
