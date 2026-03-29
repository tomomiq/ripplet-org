import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const weeknotes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/weeknotes' }),
});

const ls = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/ls' }),
});

const trips = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/trips' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    canonicalUrl: z.string().optional(),
    thumbnail: z.string().nullish(),
    year: z.number().nullish(),
  }),
});

export const collections = { weeknotes, ls, trips };
