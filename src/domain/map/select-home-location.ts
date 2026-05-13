import type { HomeLocation } from '../../types/app/home-location';

/**
 * Whether a {@link HomeLocation} is usable given the set of currently
 * loaded GTFS prefixes.
 *
 * Match semantics:
 *
 * - `requiredDataSource` is `undefined` → always usable (no requirement).
 * - `requiredDataSource` is `[]` → always usable (empty requirement
 *   list = no required data source at all = nothing to satisfy =
 *   vacuously matched).
 * - `requiredDataSource` is a non-empty array → usable when **at least
 *   one** listed prefix is in `loadedDataSources` (some-match).
 *
 * `undefined` and `[]` are equivalent: both express "this location has
 * no data-source requirement". Callers may use either, though omitting
 * the field is the more idiomatic way to mark a location as
 * unconstrained.
 *
 * @param location - The curated location to test.
 * @param loadedDataSources - GTFS prefixes that are currently loaded.
 * @returns `true` when the location should be a candidate, `false`
 *   when it should be filtered out.
 */
export function isHomeLocationUsable(
  location: HomeLocation,
  loadedDataSources: ReadonlySet<string>,
): boolean {
  if (location.requiredDataSource === undefined || location.requiredDataSource.length === 0) {
    return true;
  }
  return location.requiredDataSource.some((prefix) => loadedDataSources.has(prefix));
}

/**
 * Filter a curated location list down to the subset usable given the
 * current load state. Falls back to the full input list when nothing
 * matches, so callers always get at least one candidate (better than
 * returning empty and forcing the caller to handle null).
 *
 * The fallback is intentional: if a user has disabled every data
 * source we know about, sending them to a random place is still
 * better than crashing or showing nothing. They will see an empty
 * map, but the app structure stays intact.
 *
 * Empty input → empty output (no fallback). Callers must pass a
 * non-empty list of locations.
 *
 * @param locations - The full curated location list to filter.
 * @param loadedDataSources - GTFS prefixes that are currently loaded.
 * @returns The filtered list, or the full input when nothing matches.
 */
export function selectHomeCandidates(
  locations: readonly HomeLocation[],
  loadedDataSources: ReadonlySet<string>,
): readonly HomeLocation[] {
  const candidates = locations.filter((loc) => isHomeLocationUsable(loc, loadedDataSources));
  if (candidates.length > 0) {
    return candidates;
  }
  return locations;
}
