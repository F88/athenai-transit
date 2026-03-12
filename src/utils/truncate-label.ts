/**
 * Truncate a label, appending "…" if it exceeds {@link maxLength}.
 *
 * When truncated, the returned string is `maxLength + 1` characters
 * (body + ellipsis). Callers typically pair this with CSS width
 * constraints, so the extra character is acceptable.
 *
 * @param name - The label text.
 * @param maxLength - Maximum body length before truncation (excludes the ellipsis).
 */
export function truncateLabel(name: string, maxLength: number): string {
  if (name.length <= maxLength) {
    return name;
  }
  return name.slice(0, maxLength) + '…';
}
