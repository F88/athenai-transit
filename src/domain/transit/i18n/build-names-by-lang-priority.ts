import { sortLangKeysByPriority } from './lang-priority';

/**
 * Build ordered names from language-keyed entries.
 *
 * Construction rules:
 * - Keys are sorted by {@link sortLangKeysByPriority} using `priorityLangs`.
 * - Sorted values are deduplicated by value.
 * - Keys such as `origin` are not treated specially; unless
 *   `priorityLangs` explicitly includes them, they are handled like any
 *   other unlisted keyed entry.
 *
 * @param names - Language-keyed name entries.
 * @param priorityLangs - Ordered language priority list used for sorting.
 * @returns Ordered and deduplicated names.
 *
 * @example
 * ```ts
 * buildNamesByLangPriority(
 *   { en: 'from-en', origin: 'from-origin', xx: 'from-xx' },
 *   ['en'],
 * );
 * // → ['from-en', 'from-origin', 'from-xx']
 * ```
 */
export function buildNamesByLangPriority(
  names: Readonly<Record<string, string>>,
  priorityLangs: readonly string[],
): string[] {
  const sortedKeys = sortLangKeysByPriority(Object.keys(names), priorityLangs);
  const seenValues = new Set<string>();
  const orderedNames: string[] = [];

  for (const key of sortedKeys) {
    const value = names[key];
    if (seenValues.has(value)) {
      continue;
    }
    seenValues.add(value);
    orderedNames.push(value);
  }

  return orderedNames;
}
