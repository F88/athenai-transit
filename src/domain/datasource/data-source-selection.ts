import type { SourceGroup } from '../../types/app/source-group';

/**
 * Return the IDs of all groups that are enabled by default.
 *
 * @param groups - Source groups to inspect.
 * @returns Set of group IDs whose `enabled` flag is `true`.
 */
export function getDefaultEnabledIds(groups: readonly SourceGroup[]): Set<string> {
  return new Set(groups.filter((group) => group.enabled).map((group) => group.id));
}

/**
 * Resolve enabled group IDs from a raw `sources` query parameter.
 *
 * `all` enables every group. Any other value is treated as a comma-separated
 * list of GTFS prefixes; if any prefix of a group matches, that entire group is
 * considered enabled.
 *
 * @param groups - Source groups to inspect.
 * @param sourcesParam - Raw `sources` query parameter value.
 * @returns Set of enabled group IDs.
 */
export function getEnabledIdsFromSourcesParam(
  groups: readonly SourceGroup[],
  sourcesParam: string,
): Set<string> {
  if (sourcesParam === 'all') {
    return new Set(groups.map((group) => group.id));
  }

  const requestedPrefixes = new Set(sourcesParam.split(',').map((prefix) => prefix.trim()));

  return new Set(
    groups
      .filter((group) => group.prefixes.some((prefix) => requestedPrefixes.has(prefix)))
      .map((group) => group.id),
  );
}

/**
 * Resolve the load-target data sources (= GTFS prefixes) from a raw
 * `sources` query parameter value.
 *
 * "Data source" in Athenai is a single GTFS prefix (e.g. `minkuru`).
 * `?sources=<prefixes>` is therefore a list of *data sources* to load,
 * not a list of group IDs. The returned array is intended to be passed
 * directly to {@link import('../../repositories/athenai-repository').AthenaiRepositoryV2.create}
 * as the load target.
 *
 * - `'all'` returns every prefix configured across all groups (including
 *   groups whose `enabled` flag is `false`).
 * - Any other value is parsed as a comma-separated list of prefixes.
 *   Unknown / empty entries are silently dropped here (callers use
 *   {@link findUnknownPrefixesInSourcesParam} to surface them).
 *
 * Unlike {@link getEnabledIdsFromSourcesParam}, this function does NOT
 * expand a requested prefix into its group's full prefix list — so when
 * a group bundles multiple prefixes (e.g. `toko` covering both
 * `minkuru` and `toaran`), `?sources=minkuru` returns only `['minkuru']`
 * and never drags `toaran` into the load target. That is what
 * `PRD.md:118` ("指定した prefix のデータソースのみ有効") prescribes.
 *
 * Duplicate prefixes in the URL (`?sources=minkuru,minkuru`) are
 * collapsed to a single entry, mirroring the dedupe that the
 * group-driven path performs via {@link DataSourceManager.getEnabledPrefixes}.
 * Without this, the same source would be fetched twice and would push
 * duplicate timetable groups / `sourceMetas` through the merge step
 * (see `merge-sources-v2.ts` `timetable[stopId].push(...groups)` and
 * `sourceMetas.push(...)`).
 *
 * @param groups - Source groups to inspect.
 * @param sourcesParam - Raw `sources` query parameter value.
 * @returns Array of prefixes to load, in the order the user first
 *   listed them. Each prefix appears at most once.
 */
export function getEnabledDataSourcesFromSourcesParam(
  groups: readonly SourceGroup[],
  sourcesParam: string,
): string[] {
  if (sourcesParam === 'all') {
    return [...new Set(groups.flatMap((group) => group.prefixes))];
  }
  const knownPrefixes = new Set(groups.flatMap((group) => group.prefixes));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of sourcesParam.split(',')) {
    const prefix = raw.trim();
    if (prefix.length === 0 || !knownPrefixes.has(prefix) || seen.has(prefix)) {
      continue;
    }
    seen.add(prefix);
    result.push(prefix);
  }
  return result;
}

/**
 * Returns prefixes from `sourcesParam` that did not match any group's prefix list.
 *
 * Used to surface a warning when a user passes an unknown / mistyped /
 * since-removed prefix in `?sources=`. The unknowns are silently dropped by
 * {@link getEnabledIdsFromSourcesParam}; this function exposes them so the
 * caller can decide how to surface the fact.
 *
 * @param groups - Source groups to inspect.
 * @param sourcesParam - Raw `sources` query parameter value.
 * @returns Array of requested prefixes that did not match any group, in the
 *   order they appeared in the parameter. Empty when `sourcesParam === 'all'`
 *   or when every requested prefix matched.
 */
export function findUnknownPrefixesInSourcesParam(
  groups: readonly SourceGroup[],
  sourcesParam: string,
): string[] {
  if (sourcesParam === 'all') {
    return [];
  }

  const requestedPrefixes = sourcesParam
    .split(',')
    .map((prefix) => prefix.trim())
    .filter((prefix) => prefix.length > 0);

  const knownPrefixes = new Set(groups.flatMap((group) => group.prefixes));

  return requestedPrefixes.filter((prefix) => !knownPrefixes.has(prefix));
}

/**
 * Parse a localStorage snapshot of enabled group IDs.
 *
 * This function preserves current behavior: any truthy JSON value is accepted
 * and passed to `Set`, while JSON parse errors are handled by the caller.
 *
 * @param stored - Raw localStorage value.
 * @returns Parsed enabled IDs, or `null` when storage is empty.
 */
export function parseStoredEnabledIds(stored: string | null): Set<string> | null {
  if (!stored) {
    return null;
  }

  return new Set(JSON.parse(stored) as string[]);
}

/**
 * Expand enabled group IDs into GTFS prefixes using group definition order.
 *
 * If a group is enabled, all of its prefixes are returned in group
 * definition order.
 *
 * @param groups - Source groups to inspect.
 * @param enabledIds - Enabled group IDs.
 * @returns Flat array of prefixes in group definition order.
 */
export function getEnabledPrefixesFromGroups(
  groups: readonly SourceGroup[],
  enabledIds: Set<string>,
): string[] {
  return groups.filter((group) => enabledIds.has(group.id)).flatMap((group) => group.prefixes);
}
