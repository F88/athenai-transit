import type { SourceGroup } from '../../types/app/source-group';

/**
 * Return the IDs of all groups that are enabled by default.
 *
 * @param groups - Source groups to inspect.
 * @returns Set of group IDs whose `enabled` flag is `true`.
 */
export function getDefaultEnabledIds(groups: SourceGroup[]): Set<string> {
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
  groups: SourceGroup[],
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
  groups: SourceGroup[],
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
  groups: SourceGroup[],
  enabledIds: Set<string>,
): string[] {
  return groups.filter((group) => enabledIds.has(group.id)).flatMap((group) => group.prefixes);
}
