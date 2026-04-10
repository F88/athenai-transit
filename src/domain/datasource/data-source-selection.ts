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
