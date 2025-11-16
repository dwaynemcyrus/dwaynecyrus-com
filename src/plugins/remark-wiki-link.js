// src/plugins/remark-wiki-link.js
import { visit } from 'unist-util-visit';
import contentMap from '../data/content-map.json' assert { type: 'json' };

/**
 * Normalize a string for slug/id comparison.
 * - Lowercase
 * - Replace whitespace with '-'
 * - Remove non alphanumeric / hyphen
 - Collapse multiple hyphens
 * - Trim leading/trailing hyphens
 */
function sanitizeSlug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '-')        // spaces -> hyphen
    .replace(/[^a-z0-9-]/g, '')  // strip non-alphanumeric/hyphen
    .replace(/-{2,}/g, '-')      // collapse multiple hyphens
    .replace(/^-+|-+$/g, '');    // trim leading/trailing hyphens
}

/**
 * Slugify heading text into an HTML id / fragment.
 * Uses the same rules as sanitizeSlug for consistency.
 */
function slugifyHeading(value) {
  return sanitizeSlug(value);
}

/**
 * Build lookup indexes from content-map.json
 * to make resolution fast and deterministic.
 */
function buildContentIndex(nodes) {
  const byTitle = new Map();
  const bySlugKey = new Map();
  const byIdKey = new Map();

  for (const entry of nodes) {
    if (!entry) continue;

    const titleKey = String(entry.title || '').trim().toLowerCase();
    const slugKey = sanitizeSlug(entry.slug || entry.id);
    const idKey = sanitizeSlug(entry.id);

    if (titleKey && !byTitle.has(titleKey)) {
      byTitle.set(titleKey, entry);
    }
    if (slugKey && !bySlugKey.has(slugKey)) {
      bySlugKey.set(slugKey, entry);
    }
    if (idKey && !byIdKey.has(idKey)) {
      byIdKey.set(idKey, entry);
    }
  }

  return { byTitle, bySlugKey, byIdKey };
}

const CONTENT_INDEX = buildContentIndex(
  Array.isArray(contentMap) ? contentMap : []
);

/**
 * Resolve a wiki-link "title" string to a content entry.
 *
 * Strategy:
 *  1. Exact match on entry.title (case-insensitive).
 *  2. Slugify title and match against slugified entry.slug.
 *  3. If still not found, match against slugified entry.id.
 */
function resolveTitleToEntry(title) {
  if (!title) return null;

  const normalizedTitle = String(title).trim().toLowerCase();
  const { byTitle, bySlugKey, byIdKey } = CONTENT_INDEX;

  // 1. Exact title match
  if (byTitle.has(normalizedTitle)) {
    return byTitle.get(normalizedTitle);
  }

  // 2 & 3. Slugified matches
  const titleSlug = sanitizeSlug(title);

  if (bySlugKey.has(titleSlug)) {
    return bySlugKey.get(titleSlug);
  }

  if (byIdKey.has(titleSlug)) {
    return byIdKey.get(titleSlug);
  }

  return null;
}

/**
 * Parse the inner body of a wiki-link.
 *
 * Examples:
 *  - "Title"                 => { title: "Title", header: null, alias: null }
 *  - "Title|Alias"           => { title: "Title", header: null, alias: "Alias" }
 *  - "Title#Header"          => { title: "Title", header: "Header", alias: null }
 *  - "Title#Header|Alias"    => { title: "Title", header: "Header", alias: "Alias" }
 */
function parseWikiLinkBody(body) {
  const raw = String(body || '');

  // Split on the first '|' to separate alias (if present)
  const [targetPart, aliasPart] = raw.split('|', 2);
  const alias = aliasPart ? aliasPart.trim() || null : null;

  // Within the target, split on the first '#'
  const [rawTitle, rawHeader] = targetPart.split('#', 2);
  const title = (rawTitle || '').trim();
  const header = rawHeader ? rawHeader.trim() || null : null;

  return { title, header, alias };
}

/**
 * Construct the URL for a resolved entry, optionally with a header fragment.
 * Follows the convention: /{collection}/{slug}/#heading
 */
function buildUrlForEntry(entry, header) {
  const base = `/${entry.collection}/${entry.slug}/`;
  if (!header) return base;

  const fragment = slugifyHeading(header);
  return fragment ? `${base}#${fragment}` : base;
}

/**
 * Choose the display text for a wiki-link.
 *
 * Rule:
 *  - If alias is provided, always use alias.
 *  - Else if header is present, use header text.
 *  - Else use the original title string.
 */
function buildDisplayText({ title, header, alias }) {
  if (alias && alias.trim()) return alias.trim();
  if (header && header.trim()) return header.trim();
  return title;
}

/**
 * Main remark plugin factory.
 *
 * Options (all optional, sane defaults):
 *  - warnOnUnresolved?: boolean (default: true in dev, false in prod)
 */
export function remarkWikiLink(options = {}) {
  const {
    warnOnUnresolved = process.env.NODE_ENV !== 'production',
  } = options;

  // Regex that finds wiki-links in text nodes: [[...]]
  const WIKILINK_PATTERN = /\[\[([^[\]]+)\]\]/g;

  return function transform(tree, file) {
    visit(tree, 'text', (node, index, parent) => {
      // Safety check – parent might be undefined in bizarre cases
      if (!parent || typeof node.value !== 'string') return;

      const value = node.value;
      let match;
      let lastIndex = 0;
      const newNodes = [];

      // Scan the text for all wiki-link matches
      while ((match = WIKILINK_PATTERN.exec(value)) !== null) {
        const fullMatch = match[0];    // e.g. "[[Title#Header|Alias]]"
        const inner = match[1];        // e.g. "Title#Header|Alias"
        const start = match.index;
        const end = start + fullMatch.length;

        // Push any plain text before this match
        if (start > lastIndex) {
          newNodes.push({
            type: 'text',
            value: value.slice(lastIndex, start),
          });
        }

        const parsed = parseWikiLinkBody(inner);

        // If we somehow have no title, just treat as plain text
        if (!parsed.title) {
          newNodes.push({ type: 'text', value: fullMatch });
          lastIndex = end;
          continue;
        }

        const entry = resolveTitleToEntry(parsed.title);

        if (!entry) {
          // Unresolved wiki-link:
          // - Render as an <a> with a special class and tooltip.
          // - href="#" so it doesn't navigate anywhere.
          const missingText = buildDisplayText(parsed);

          newNodes.push({
            type: 'link',
            url: '#',
            data: {
              hProperties: {
                className: ['wikilink', 'wikilink--missing'],
                title: 'this link is either private or yet to be connected',
                'aria-disabled': 'true',
                'data-wiki-missing': 'true',
              },
            },
            children: [
              {
                type: 'text',
                value: missingText,
              },
            ],
          });

          if (warnOnUnresolved) {
            const msg = `Unresolved wiki-link: ${fullMatch}`;
            if (file && typeof file.message === 'function') {
              file.message(msg);
            } else {
              // Fallback for environments without vfile.message
              console.warn(msg);
            }
          }

          lastIndex = end;
          continue;
        }

        // Resolved: build the URL and display text
        const url = buildUrlForEntry(entry, parsed.header);
        const text = buildDisplayText(parsed);

        newNodes.push({
          type: 'link',
          url,
          data: {
            hProperties: {
              className: ['wikilink'],
              'data-wiki-title': parsed.title,
              ...(parsed.header ? { 'data-wiki-header': parsed.header } : {}),
              'data-wiki-collection': entry.collection,
              'data-wiki-slug': entry.slug,
            },
          },
          children: [
            {
              type: 'text',
              value: text,
            },
          ],
        });

        lastIndex = end;
      }

      // If no matches, leave the node as-is
      if (newNodes.length === 0) return;

      // Push any trailing text after the last match
      if (lastIndex < value.length) {
        newNodes.push({
          type: 'text',
          value: value.slice(lastIndex),
        });
      }

      // Replace the original text node with our new sequence
      parent.children.splice(index, 1, ...newNodes);

      // Tell unist-util-visit to skip over the newly inserted nodes
      return index + newNodes.length;
    });
  };
}
