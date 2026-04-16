// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

function rehypeFigureCaption() {
  return (tree) => {
    function wrap(node) {
      if (!node.children) return;

      // Convert an image-only <p> to <div class="image-row"> so figures don't get broken
      // out by the browser's HTML parser (figure inside p is invalid HTML).
      // Inside .image-grid, TripLayout uses `display: contents` on .image-row so the
      // figures still become direct grid items.
      if (node.tagName === 'p') {
        const nonWs = node.children.filter(c => !(c.type === 'text' && /^\s*$/.test(c.value)));
        const allImgs = nonWs.length > 0 && nonWs.every(c => c.type === 'element' && c.tagName === 'img');
        if (allImgs) {
          node.tagName = 'div';
          node.properties = { className: ['image-row'] };
          node.children = nonWs.map(img => {
            const alt = img.properties?.alt;
            return {
              type: 'element', tagName: 'figure', properties: {},
              children: alt
                ? [img, { type: 'element', tagName: 'figcaption', properties: {}, children: [{ type: 'text', value: alt }] }]
                : [img]
            };
          });
          return;
        }
      }

      node.children = node.children.map(child => {
        if (child.type === 'element' && child.tagName === 'img') {
          const alt = child.properties?.alt;
          return {
            type: 'element',
            tagName: 'figure',
            properties: {},
            children: alt
              ? [child, { type: 'element', tagName: 'figcaption', properties: {}, children: [{ type: 'text', value: alt }] }]
              : [child]
          };
        }
        wrap(child);
        return child;
      });
    }
    wrap(tree);
  };
}

// https://astro.build/config
export default defineConfig({
  site: 'https://www.ripplet.org',
  integrations: [
    sitemap({
      filter: (page) => ![
        'https://www.ripplet.org/thanks/',
        'https://www.ripplet.org/subscribed/',
        'https://www.ripplet.org/umami-opt-out/',
      ].includes(page),
    }),
  ],
  markdown: {
    rehypePlugins: [rehypeFigureCaption],
  },
});
