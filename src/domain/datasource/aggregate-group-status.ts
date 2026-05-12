import type { SourceLoadStatusEntry } from './source-load-state';

/**
 * Aggregated load status for a {@link SourceGroup} whose `prefixes` may
 * bundle multiple underlying sources.
 *
 * - `loaded`: every prefix loaded successfully.
 * - `failed`: no prefix is loaded; at least one failed. Pure failure
 *   from the user's perspective (nothing in this group is usable).
 * - `partial`: at least one prefix is loaded but the group is not
 *   fully loaded. The "missing" prefixes may be failures, not-attempted,
 *   or a mix of the two — the variant carries both sub-lists so the UI
 *   can surface per-prefix error messages and a `loaded/total` fraction.
 * - `notAttempted`: every prefix is absent from the load-status map and
 *   none failed. The URL / localStorage selection did not include them.
 *
 * The variant fields expose enough detail for the UI to render details
 * without re-walking the load-status map.
 */
export type GroupLoadStatus =
  | { status: 'loaded'; loadedPrefixes: readonly string[] }
  | {
      status: 'failed';
      failedPrefixes: readonly { prefix: string; error: Error }[];
      notAttemptedPrefixes: readonly string[];
    }
  | {
      status: 'partial';
      loadedPrefixes: readonly string[];
      failedPrefixes: readonly { prefix: string; error: Error }[];
      notAttemptedPrefixes: readonly string[];
    }
  | { status: 'notAttempted'; notAttemptedPrefixes: readonly string[] };

/**
 * Aggregate per-prefix load status into a single {@link GroupLoadStatus}
 * for the group described by `prefixes`.
 *
 * Precedence (top wins):
 * 1. At least one loaded AND not all loaded → `partial`. Covers
 *    "some loaded + some failed" and "some loaded + some not-attempted"
 *    uniformly.
 * 2. All loaded → `loaded`.
 * 3. At least one failed (no loaded) → `failed`. The group is unusable;
 *    not-attempted prefixes are reported alongside for context.
 * 4. Otherwise → `notAttempted` (all prefixes absent, none failed).
 *
 * Empty input is treated as `notAttempted` with an empty prefix list.
 *
 * @param prefixes - Prefixes the group bundles. Not mutated.
 * @param loadStatusByPrefix - Per-prefix status map from the load-state
 *   context. Absent keys mean "never attempted".
 * @returns A {@link GroupLoadStatus} discriminated union.
 */
export function aggregateGroupLoadStatus(
  prefixes: readonly string[],
  loadStatusByPrefix: ReadonlyMap<string, SourceLoadStatusEntry>,
): GroupLoadStatus {
  const loadedPrefixes: string[] = [];
  const failedPrefixes: { prefix: string; error: Error }[] = [];
  const notAttemptedPrefixes: string[] = [];

  for (const prefix of prefixes) {
    const entry = loadStatusByPrefix.get(prefix);
    if (!entry) {
      notAttemptedPrefixes.push(prefix);
    } else if (entry.status === 'loaded') {
      loadedPrefixes.push(prefix);
    } else {
      failedPrefixes.push({ prefix, error: entry.error });
    }
  }

  const totalMissing = failedPrefixes.length + notAttemptedPrefixes.length;
  if (loadedPrefixes.length > 0 && totalMissing > 0) {
    return {
      status: 'partial',
      loadedPrefixes,
      failedPrefixes,
      notAttemptedPrefixes,
    };
  }
  if (loadedPrefixes.length > 0) {
    return { status: 'loaded', loadedPrefixes };
  }
  if (failedPrefixes.length > 0) {
    return { status: 'failed', failedPrefixes, notAttemptedPrefixes };
  }
  return { status: 'notAttempted', notAttemptedPrefixes };
}
