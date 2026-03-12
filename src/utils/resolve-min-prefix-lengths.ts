/**
 * Compute the minimum prefix length for each string so that all are
 * visually distinguishable when truncated.
 *
 * Starting from `minLength`, the function progressively increases the
 * character count for colliding strings until every truncated prefix
 * is unique. Strings that are already unique at `minLength` keep that
 * length. Duplicate strings are deduplicated — the returned Map
 * contains one entry per unique string.
 *
 * @param strings - List of strings (may contain duplicates).
 * @param minLength - Minimum characters to start with. @default 1
 * @returns Map from original string → display length.
 */
export function resolveMinPrefixLengths(
  strings: string[],
  minLength: number = 1,
): Map<string, number> {
  // Clamp to at least 1 — displaying 0 characters is never useful
  // (empty strings are capped to 0 in the early-return path below).
  const effectiveMin = Math.max(1, minLength);

  // Deduplicate: only need to resolve unique strings.
  const unique = Array.from(new Set(strings));
  const result = new Map<string, number>();

  // If 0 or 1 unique string, no collision is possible.
  if (unique.length <= 1) {
    for (const s of unique) {
      result.set(s, Math.min(effectiveMin, s.length));
    }
    return result;
  }

  // Track remaining strings that still need resolution.
  let remaining = unique.map((s) => s);

  for (let len = effectiveMin; remaining.length > 1; len++) {
    // Group remaining strings by their truncated prefix at current length.
    const groups = new Map<string, string[]>();
    for (const s of remaining) {
      const prefix = s.slice(0, len);
      const list = groups.get(prefix);
      if (list) {
        list.push(s);
      } else {
        groups.set(prefix, [s]);
      }
    }

    const nextRemaining: string[] = [];
    for (const group of groups.values()) {
      if (group.length === 1) {
        // Unique at this length — resolved. Cap at string length.
        result.set(group[0], Math.min(len, group[0].length));
      } else {
        // Split: strings already fully shown at this length are resolved,
        // the rest continue to the next round.
        const fullyShown: string[] = [];
        const needMore: string[] = [];
        for (const s of group) {
          if (s.length <= len) {
            fullyShown.push(s);
          } else {
            needMore.push(s);
          }
        }

        // Fully shown strings cannot be extended further — resolve at full length.
        for (const s of fullyShown) {
          result.set(s, s.length);
        }

        if (needMore.length === 0) {
          // All strings in this group are fully shown — nothing left.
        } else {
          // Strings still collide, or a single string whose prefix
          // at this length matches a fully-shown peer (would look
          // identical). Continue extending.
          nextRemaining.push(...needMore);
        }
      }
    }
    remaining = nextRemaining;
  }

  // Any remaining single string that exited the loop.
  for (const s of remaining) {
    if (!result.has(s)) {
      result.set(s, s.length);
    }
  }

  return result;
}
