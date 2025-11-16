// src/types/graph.ts

import rawContentMap from '../data/content-map.json';

export type LinkSubsetKind =
  | 'body'
  | 'resources'
  | 'chains'
  | 'source'
  | (string & {}); // keep it open-ended

export type LinkDirection = 'outbound' | 'inbound' | 'chain';

export interface RawEdge {
  id: string;
  cuid: string | null;
  title: string;
  slug: string;
  collection: string;
  kind: LinkSubsetKind;
}

export interface RawNode {
  id: string;
  cuid: string | null;
  slug: string;
  collection: string;
  title: string;
  description?: string;
  tags: string[];
  aliases: string[];
  outboundLinks: RawEdge[];
  inboundLinks: RawEdge[];
  chainedLinks: RawEdge[];
}

export const contentMap = rawContentMap as RawNode[];

/**
 * Flattened edge used by UI components.
 * - `direction` tells us if this is outbound/inbound/chain from the POV of the current node.
 * - `kind` is your sub-kind (resources, chains, body, source, etc.).
 */
export interface ContentLink {
  id: string;
  cuid: string | null;
  slug: string;
  collection: string;
  title: string;
  direction: LinkDirection;
  kind: LinkSubsetKind;
}

/**
 * Look up a node by slug (the slug stored in content-map.json, e.g. "aessay-b").
 */
export function getNodeBySlug(slug: string): RawNode | undefined {
  return contentMap.find((node) => node.slug === slug);
}

/**
 * Look up a node by cuid (when present).
 */
export function getNodeByCuid(cuid: string): RawNode | undefined {
  return contentMap.find((node) => node.cuid === cuid);
}

/**
 * From a single node, produce a flat list of link edges with direction.
 *
 * You use this per page and then pass the resulting `ContentLink[]`
 * into your layout + link components.
 */
export function flattenNodeLinks(node: RawNode): ContentLink[] {
  const mapEdge = (edge: RawEdge, direction: LinkDirection): ContentLink => ({
    id: edge.id,
    cuid: edge.cuid,
    slug: edge.slug,
    collection: edge.collection,
    title: edge.title,
    direction,
    kind: edge.kind,
  });

  return [
    ...node.outboundLinks.map((edge) => mapEdge(edge, 'outbound')),
    ...node.inboundLinks.map((edge) => mapEdge(edge, 'inbound')),
    ...node.chainedLinks.map((edge) => mapEdge(edge, 'chain')),
  ];
}
