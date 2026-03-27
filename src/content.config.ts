import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const weeknotes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/weeknotes' }),
  schema: z.object({
    week: z.string(),
    title: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    image: z.preprocess(val => val || undefined, z.string().optional()),
    caption: z.preprocess(val => val || undefined, z.string().optional()),
    location: z.preprocess(val => val || undefined, z.string().optional()),
    permalink: z.preprocess(val => val || undefined, z.string().optional()),
    draft: z.boolean().optional(),
    isbn: z.union([z.string(), z.array(z.string())]).optional(),
  }),
});

const ls = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/ls' }),
  schema: z.object({
    title: z.string(),
    image: z.preprocess(val => val || undefined, z.string().optional()),
    instructions_url: z.preprocess(val => val || undefined, z.string().optional()),
    riff_url: z.preprocess(val => val || undefined, z.string().optional()),
  }),
});

export const collections = { weeknotes, ls };
