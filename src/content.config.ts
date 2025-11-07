// Future reference: https://docs.astro.build/en/guides/content-collections/

// 1. Import utilities from `astro:content`
import { defineCollection, z } from 'astro:content';

// 2. Import loader(s)
import { glob, file } from 'astro/loaders';

// 3. Define your collection(s)

const dogs = defineCollection({ /* ... */ });

const essays = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: "./src/content/essays" }),

});

const notes = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: "./src/content/notes" }),

});

const projects = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: "./src/content/projects" }),

});

// 4. Export a single `collections` object to register your collection(s)
export const collections = { essays, notes, projects };
