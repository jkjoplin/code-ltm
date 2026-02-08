import type { Learning, LearningSummary } from "../types.js";

/**
 * Compact format helpers for token-efficient MCP output.
 * Abbreviates keys and strips nulls/empties.
 */

export function toCompactLearning(l: Learning): Record<string, unknown> {
  const c: Record<string, unknown> = {
    i: l.id,
    t: l.title,
    c: l.content,
    ty: l.type,
    sc: l.scope,
    cf: l.confidence,
    v: l.version,
    ca: l.created_at,
    ua: l.updated_at,
  };
  if (l.project_path) c.pp = l.project_path;
  if (l.tags.length > 0) c.tg = l.tags;
  if (l.file_references.length > 0) c.fr = l.file_references;
  if (l.related_ids.length > 0) c.ri = l.related_ids;
  if (l.created_by && l.created_by !== "unknown-agent") c.cb = l.created_by;
  if (l.deprecated) c.dep = true;
  if (l.deprecated_reason) c.dr = l.deprecated_reason;
  if (l.access_count > 0) c.ac = l.access_count;
  if (l.last_accessed_at) c.la = l.last_accessed_at;
  if (l.applies_to && l.applies_to.length > 0) c.at = l.applies_to;
  return c;
}

export function toCompactSummary(s: LearningSummary): Record<string, unknown> {
  const c: Record<string, unknown> = {
    i: s.id,
    t: s.title,
    ty: s.type,
    sc: s.scope,
    cf: s.confidence,
  };
  if (s.tags.length > 0) c.tg = s.tags;
  if (s.relevance_score !== undefined) c.rs = s.relevance_score;
  return c;
}

export function compactJson(data: unknown): string {
  return JSON.stringify(data);
}
