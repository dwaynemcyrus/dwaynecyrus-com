// src/scripts/generate-content-map.mjs
// Generates both:
//   - src/data/content-map.json
//   - src/data/content-health.json
//
// Requires: gray-matter
//   npm install gray-matter --save-dev

import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

// ====================================================================
// Helpers
// ====================================================================

/**
 * Slugify a title or arbitrary string with the rules:
 * - lowercase
 * - whitespace -> single '-'
 * - strip non [a-z0-9-]
 * - collapse multiple '-'
 * - trim leading/trailing '-'
 */
export function slugifyTitle(input) {
  return String(input)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Recursively find all .md / .mdx files under a directory.
 */
async function findMarkdownFiles(rootDir) {
  const result = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (err.code === "ENOENT") return;
      throw err;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        if (/\.(md|mdx)$/i.test(entry.name)) {
          result.push(fullPath);
        }
      }
    }
  }

  await walk(rootDir);
  return result;
}

/**
 * Parse all wiki-links from a string.
 *
 * Supports:
 *   [[title]]
 *   [[title|alias]]
 *   [[title#HeaderName]]
 *   [[title#HeaderName|alias]]
 *
 * For graph purposes we only care about the `title` part
 * (before '|' and before '#').
 */
export function parseWikiLinksFromString(text) {
  const links = [];
  if (!text || typeof text !== "string") return links;

  const regex = /\[\[([^[\]]+?)\]\]/g;
  let match;

  while ((match = regex.exec(text))) {
    const inner = match[1].trim();
    if (!inner) continue;

    const [beforeAlias] = inner.split("|", 1); // "title#Header|alias" -> "title#Header"
    const [titlePart] = beforeAlias.split("#", 1); // "title#Header" -> "title"
    const cleanTitle = titlePart.trim();
    if (!cleanTitle) continue;

    links.push({ title: cleanTitle, raw: match[0] });
  }

  return links;
}

/**
 * Normalize frontmatter fields that may contain wiki-links into an array of strings.
 * - Handles strings and arrays of strings.
 * - Ignores anything else.
 */
function normalizeFieldToStrings(value) {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string");
  return [];
}

// ====================================================================
// Data Types (JSDoc only)
// ====================================================================

/**
 * kind/origin for links
 * - "body"      => from markdown body
 * - "resources" => from frontmatter.resources
 * - "source"    => from frontmatter.source
 * - "chains"    => from frontmatter.chains
 */

/**
 * @typedef {{ id:string, cuid:string|null, title:string, slug:string, collection:string, kind:string }} LinkRef
 *
 * @typedef {{
 *   id:string,
 *   cuid:string|null,
 *   slug:string,
 *   collection:string,
 *   title:string,
 *   description:string,
 *   tags:string[],
 *   aliases:string[],
 *   rawLinks:Array<{targetTitle:string, origin:string}>,
 *   outboundLinks:LinkRef[],
 *   inboundLinks:LinkRef[],
 *   chainedLinks:LinkRef[],
 *   filePath:string,
 * }} NodeInternal
 */

// ====================================================================
// Load content nodes (with error capture)
// ====================================================================

/**
 * Load all content nodes from src/content.
 *
 * @param {{
 *   badFiles:any[],
 *   unresolvedWikiLinks:string[],
 *   idCollisions:any[],
 *   missingCuids:any[]
 * }} contentHealth
 * @returns {Promise<Map<string, NodeInternal>>}
 */
async function loadContentNodes(contentHealth) {
  const projectRoot = process.cwd();
  const contentRoot = path.resolve(projectRoot, "src", "content");
  const files = await findMarkdownFiles(contentRoot);

  /** @type {Map<string, NodeInternal>} */
  const nodesById = new Map();

  for (const absPath of files) {
    const relFromContent = path.relative(contentRoot, absPath);
    const pathParts = relFromContent.split(path.sep);

    // Expect at least "collection/file.md"
    if (pathParts.length < 2) {
      contentHealth.badFiles.push({
        filePath: relFromContent,
        error: "No collection segment (expected src/content/<collection>/file.md)",
      });
      continue;
    }

    const collection = pathParts[0];
    const restPath = pathParts.slice(1).join("/");
    const withoutExt = restPath.replace(/\.(md|mdx)$/i, "");

    const slugSegments = withoutExt
      .split(/[\\/]/)
      .map((s) => slugifyTitle(s))
      .filter(Boolean);

    const slug = slugSegments.join("/");

    // ------------------------------
    // Read + parse file
    // ------------------------------
    let fileContent;
    try {
      fileContent = await fs.readFile(absPath, "utf8");
    } catch (err) {
      contentHealth.badFiles.push({
        filePath: relFromContent,
        error: `File read error: ${err.message}`,
      });
      continue;
    }

    let parsed;
    try {
      parsed = matter(fileContent);
    } catch (err) {
      contentHealth.badFiles.push({
        filePath: relFromContent,
        error: `Frontmatter parse error: ${err.message}`,
      });
      continue;
    }

    const fm = parsed.data || {};
    const body = parsed.content || "";

    // ------------------------------
    // Identity: CUID or fallback
    // ------------------------------
    const fmCuid = typeof fm.cuid === "string" ? fm.cuid.trim() : "";
    const cuid = fmCuid || null;
    const fallbackId = `${collection}/${slug}`;
    const id = fmCuid || fallbackId;

    if (!cuid) {
      contentHealth.missingCuids.push({
        filePath: relFromContent,
        collection,
        slug,
        title: typeof fm.title === "string" ? fm.title.trim() : "",
      });
    }

    // ------------------------------
    // Basic metadata
    // ------------------------------
    const title =
      (typeof fm.title === "string" && fm.title.trim()) ||
      slugSegments[slugSegments.length - 1] ||
      withoutExt;

    const description =
      typeof fm.description === "string" ? fm.description.trim() : "";

    let tags = [];
    if (Array.isArray(fm.tags)) {
      tags = fm.tags
        .filter((t) => typeof t === "string")
        .map((t) => t.trim())
        .filter(Boolean);
    } else if (typeof fm.tags === "string") {
      tags = fm.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }

    let aliases = [];
    if (Array.isArray(fm.aliases)) {
      aliases = fm.aliases
        .filter((a) => typeof a === "string")
        .map((a) => a.trim())
        .filter(Boolean);
    } else if (typeof fm.aliases === "string") {
      aliases = fm.aliases
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
    }

    // ------------------------------
    // Collect raw wiki-links with origin kind
    // ------------------------------
    const rawLinks = [];

    // From body
    for (const link of parseWikiLinksFromString(body)) {
      rawLinks.push({ targetTitle: link.title, origin: "body" });
    }

    // From frontmatter.resources
    for (const s of normalizeFieldToStrings(fm.resources)) {
      for (const link of parseWikiLinksFromString(s)) {
        rawLinks.push({ targetTitle: link.title, origin: "resources" });
      }
    }

    // From frontmatter.source
    for (const s of normalizeFieldToStrings(fm.source)) {
      for (const link of parseWikiLinksFromString(s)) {
        rawLinks.push({ targetTitle: link.title, origin: "source" });
      }
    }

    // From frontmatter.chains
    for (const s of normalizeFieldToStrings(fm.chains)) {
      for (const link of parseWikiLinksFromString(s)) {
        rawLinks.push({ targetTitle: link.title, origin: "chains" });
      }
    }

    /** @type {NodeInternal} */
    const node = {
      id,
      cuid,
      slug,
      collection,
      title,
      description,
      tags,
      aliases,
      rawLinks,
      outboundLinks: [],
      inboundLinks: [],
      chainedLinks: [],
      filePath: relFromContent,
    };

    // ------------------------------
    // Handle ID collisions (CUID or fallback)
    // ------------------------------
    if (nodesById.has(id)) {
      const existing = nodesById.get(id);
      contentHealth.idCollisions.push({
        id,
        existingFile: existing.filePath,
        duplicateFile: relFromContent,
      });
      // Keep the existing node, skip the new one
      continue;
    }

    nodesById.set(id, node);
  }

  return nodesById;
}

// ====================================================================
// Indices for resolution (title-based only, no alias resolution)
// ====================================================================

/**
 * Build lookup indices for resolving wiki-link titles.
 */
function buildIndices(nodesById) {
  const titleIndex = new Map();
  const slugIndex = new Map();

  const add = (map, key, id) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(id);
  };

  for (const [id, node] of nodesById) {
    const t = node.title || "";
    const tl = t.toLowerCase();

    // Title indices (exact + lowercase)
    add(titleIndex, t, id);
    add(titleIndex, tl, id);

    // Slug indices (slugified title + node.slug)
    add(slugIndex, slugifyTitle(t), id);
    add(slugIndex, slugifyTitle(node.slug), id);
  }

  return { titleIndex, slugIndex };
}

/**
 * Resolve a wiki-link title to a node id using the strategy:
 * 1. Exact title match.
 * 2. slugify(title) and match against slug/indexed slugs.
 *
 * Adds messages to contentHealth.unresolvedWikiLinks for issues.
 * Aliases are NOT used for resolution; Obsidian handles rename behavior.
 */
function resolveWikiLinkTarget(
  rawTitle,
  indices,
  nodesById,
  warningTracker,
  contentHealth
) {
  const { titleIndex, slugIndex } = indices;

  const lower = rawTitle.toLowerCase();

  const warn = (msg) => {
    if (warningTracker.has(msg)) return;
    warningTracker.add(msg);
    contentHealth.unresolvedWikiLinks.push(msg);
  };

  // 1. Exact title
  const exact = titleIndex.get(rawTitle) || titleIndex.get(lower);
  if (exact && exact.size === 1) {
    return [...exact][0];
  }
  if (exact && exact.size > 1) {
    warn(`Ambiguous link "${rawTitle}" → ${[...exact].join(", ")}`);
    return null;
  }

  // 2. Slugified match
  const slugged = slugifyTitle(rawTitle);
  const slugMatches = slugIndex.get(slugged);
  if (slugMatches && slugMatches.size === 1) {
    return [...slugMatches][0];
  }
  if (slugMatches && slugMatches.size > 1) {
    warn(
      `Ambiguous slug "${rawTitle}" (→ ${slugged}) → ${[
        ...slugMatches,
      ].join(", ")}`
    );
    return null;
  }

  // 3. Unresolved
  warn(`Unresolved wiki-link "${rawTitle}"`);
  return null;
}

// ====================================================================
// Alias analysis (for content health only)
// ====================================================================

/**
 * Analyze aliases for conflicts:
 * - Same alias used by multiple nodes
 * - Alias colliding with another node's title
 *
 * Results go into contentHealth.aliasConflicts.
 */
function analyzeAliases(nodesById, contentHealth) {
  const aliasMap = new Map(); // aliasLower -> array of { id, title, filePath }
  const titleMap = new Map(); // titleLower -> { id, title, filePath }

  for (const [id, node] of nodesById) {
    const titleLower = (node.title || "").toLowerCase();
    if (titleLower) {
      if (!titleMap.has(titleLower)) {
        titleMap.set(titleLower, {
          id,
          title: node.title,
          filePath: node.filePath,
        });
      } else {
        // Two nodes share the same title; not strictly alias conflict, but we could track separately later if needed.
      }
    }

    for (const alias of node.aliases) {
      const lower = alias.toLowerCase();
      if (!aliasMap.has(lower)) {
        aliasMap.set(lower, []);
      }
      aliasMap.get(lower).push({
        id,
        title: node.title,
        alias,
        filePath: node.filePath,
      });
    }
  }

  /** @type {any[]} */
  const conflicts = [];

  // Duplicate alias used by multiple nodes
  for (const [aliasLower, nodes] of aliasMap) {
    if (nodes.length > 1) {
      conflicts.push({
        type: "duplicate-alias",
        alias: aliasLower,
        nodes,
      });
    }
  }

  // Alias matching another node's title
  for (const [aliasLower, nodes] of aliasMap) {
    const titleOwner = titleMap.get(aliasLower);
    if (!titleOwner) continue;

    for (const nodeInfo of nodes) {
      if (nodeInfo.id !== titleOwner.id) {
        conflicts.push({
          type: "alias-vs-title",
          alias: aliasLower,
          aliasNode: nodeInfo,
          titleNode: titleOwner,
        });
      }
    }
  }

  contentHealth.aliasConflicts = conflicts;
}

// ====================================================================
// Build graph
// ====================================================================

/**
 * Build outbound/inbound/chained links from rawLinks.
 *
 * @param {Map<string, NodeInternal>} nodesById
 * @param {{
 *   unresolvedWikiLinks:string[],
 *   aliasConflicts:any[],
 *   orphans:any
 * }} contentHealth
 * @returns {NodeInternal[]} nodes with populated link arrays
 */
function buildGraph(nodesById, contentHealth) {
  const indices = buildIndices(nodesById);
  const edges = [];
  const warningTracker = new Set();

  // Resolve rawLinks into edges
  for (const [fromId, node] of nodesById) {
    for (const raw of node.rawLinks) {
      const toId = resolveWikiLinkTarget(
        raw.targetTitle,
        indices,
        nodesById,
        warningTracker,
        contentHealth
      );
      if (!toId) continue;
      if (toId === fromId) continue; // skip self-links if you don't want them

      edges.push({ fromId, toId, origin: raw.origin });
    }
  }

  // Reset link arrays before populating
  for (const [, node] of nodesById) {
    node.outboundLinks = [];
    node.inboundLinks = [];
    node.chainedLinks = [];
  }

  const toRef = (id, kind) => {
    const n = nodesById.get(id);
    if (!n) return null;
    return {
      id: n.id,
      cuid: n.cuid,
      title: n.title,
      slug: n.slug,
      collection: n.collection,
      kind,
    };
  };

  // Populate outbound, inbound, chained
  for (const edge of edges) {
    const fromNode = nodesById.get(edge.fromId);
    const toNode = nodesById.get(edge.toId);
    if (!fromNode || !toNode) continue;

    const to = toRef(edge.toId, edge.origin);
    const from = toRef(edge.fromId, edge.origin);
    if (!to || !from) continue;

    fromNode.outboundLinks.push(to);
    toNode.inboundLinks.push(from);

    if (edge.origin === "chains") {
      fromNode.chainedLinks.push(to);
    }
  }

  // Analyze aliases (conflicts) now that all nodes exist
  analyzeAliases(nodesById, contentHealth);

  // Detect orphans
  const strictOrphans = [];
  const noInbound = [];
  const noOutbound = [];

  for (const [, node] of nodesById) {
    const hasInbound = node.inboundLinks.length > 0;
    const hasOutbound = node.outboundLinks.length > 0;

    if (!hasInbound) {
      noInbound.push({
        id: node.id,
        cuid: node.cuid,
        title: node.title,
        collection: node.collection,
        slug: node.slug,
        filePath: node.filePath,
      });
    }

    if (!hasOutbound) {
      noOutbound.push({
        id: node.id,
        cuid: node.cuid,
        title: node.title,
        collection: node.collection,
        slug: node.slug,
        filePath: node.filePath,
      });
    }

    if (!hasInbound && !hasOutbound) {
      strictOrphans.push({
        id: node.id,
        cuid: node.cuid,
        title: node.title,
        collection: node.collection,
        slug: node.slug,
        filePath: node.filePath,
      });
    }
  }

  contentHealth.orphans = {
    strict: strictOrphans,
    noInbound,
    noOutbound,
  };

  // Stable order for deterministic JSON
  return [...nodesById.values()].sort((a, b) => {
    if (a.collection !== b.collection) {
      return a.collection.localeCompare(b.collection);
    }
    return a.slug.localeCompare(b.slug);
  });
}

// ====================================================================
// Write JSON
// ====================================================================

async function writeJSON(files) {
  const projectRoot = process.cwd();
  const outDir = path.resolve(projectRoot, "src", "data");
  await fs.mkdir(outDir, { recursive: true });

  for (const { name, data } of files) {
    const outPath = path.join(outDir, name);
    await fs.writeFile(outPath, JSON.stringify(data, null, 2), "utf8");
    console.log(`[content-map] Wrote ${name}`);
  }
}

// ====================================================================
// Entrypoint
// ====================================================================

async function main() {
  console.log("[content-map] Generating content map…");

  const contentHealth = {
    badFiles: [],
    unresolvedWikiLinks: [],
    idCollisions: [],
    missingCuids: [],
    aliasConflicts: [],
    orphans: {
      strict: [],
      noInbound: [],
      noOutbound: [],
    },
  };

  const nodesById = await loadContentNodes(contentHealth);
  const nodes = buildGraph(nodesById, contentHealth);

  await writeJSON([
    {
      name: "content-map.json",
      data: nodes.map((n) => ({
        id: n.id,
        cuid: n.cuid,
        slug: n.slug,
        collection: n.collection,
        title: n.title,
        description: n.description,
        tags: n.tags,
        aliases: n.aliases,
        outboundLinks: n.outboundLinks,
        inboundLinks: n.inboundLinks,
        chainedLinks: n.chainedLinks,
      })),
    },
    {
      name: "content-health.json",
      data: contentHealth,
    },
  ]);

  console.log("[content-map] Done.");
}

main().catch((err) => {
  console.error("[content-map] Fatal error:", err);
  process.exit(1);
});
