/**
 * Extract the source/feed prefix from a prefixed transit ID.
 *
 * @param prefixedId - ID with prefix (e.g. "kobus:123").
 * @returns The prefix portion (e.g. "kobus"), or the full string if no colon.
 */
export function extractPrefix(prefixedId: string): string {
  const colonIdx = prefixedId.indexOf(':');
  return colonIdx >= 0 ? prefixedId.substring(0, colonIdx) : prefixedId;
}
