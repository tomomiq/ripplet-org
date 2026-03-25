import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const weeknotes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/weeknotes' }),
  schema: z.object({
    week: z.string(),
    title: z.string(),
    pubDate: z.coerce.date(),
    image: z.preprocess(val => val || undefined, z.string().optional()),
    caption: z.preprocess(val => val || undefined, z.string().optional()),
    location: z.preprocess(val => val || undefined, z.string().optional()),
    permalink: z.preprocess(val => val || undefined, z.string().optional()),
  }),
});

export const collections = { weeknotes };
