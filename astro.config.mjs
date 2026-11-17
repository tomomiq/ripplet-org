// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  adapter: vercel(),
  site: 'https://www.ripplet.org',
  security: {
    checkOrigin: false,
  },
  integrations: [
    sitemap({
      filter: (page) => {
        const excluded = ['thanks', 'subscribed', 'umami-opt-out'];
        const u = new URL(page);
        return !excluded.some(s => u.pathname.includes(s)) && !u.pathname.startsWith('/travel');
      },
    }),
  ],
});
