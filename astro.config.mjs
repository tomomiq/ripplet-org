// @ts-check
import { defineConfig } from 'astro/config';

function rehypeFigureCaption() {
  return (tree) => {
    function wrap(node) {
      if (!node.children) return;
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
  markdown: {
    rehypePlugins: [rehypeFigureCaption],
  },
});
