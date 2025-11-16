// @ts-check
import { defineConfig } from 'astro/config';
import { remarkWikiLink } from './src/plugins/remark-wiki-link.js';

// https://astro.build/config
export default defineConfig({
  site: 'https://dwaynemcyrus.com',
  markdown: {
    remarkPlugins: [remarkWikiLink],
  },
});
