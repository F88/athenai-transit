/**
 * Truncate a label to the given max length, appending "…" if truncated.
 */
export function truncateLabel(name: string, maxLength: number): string {
  if (name.length <= maxLength) {
    return name;
  }
  return name.slice(0, maxLength) + '…';
}
