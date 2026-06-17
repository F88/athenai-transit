/**
 * Keep only ids in `tracked` that also exist in `present`.
 *
 * This is the set intersection of `tracked` and `present`. The function is neutral
 * with respect to allow-list / block-list semantics: callers decide whether
 * a `tracked` id means "show this" (allow list) or "hide this" (block list).
 * Either way, an id that has dropped out of the surrounding `present` set is
 * stale and gets removed here.
 *
 * Identity is preserved when nothing is dropped: the same `tracked` reference
 * is returned, which lets callers use the result as a stable dependency in
 * `useMemo` / `useEffect` arrays.
 *
 * @param tracked - ids currently held in state (active / hidden / selected ...).
 * @param present - ids that exist in the current surrounding population
 * (the pill set, the present agencies, etc.).
 * @returns the reconciled set, or `tracked` itself when no id was dropped.
 */
export function reconcileIdSet<T extends string>(
  tracked: ReadonlySet<T>,
  present: ReadonlySet<T>,
): ReadonlySet<T> {
  for (const id of tracked) {
    if (!present.has(id)) {
      const next = new Set<T>();
      for (const survivor of tracked) {
        if (present.has(survivor)) {
          next.add(survivor);
        }
      }
      return next;
    }
  }
  return tracked;
}
