import type { Agency, StopWithContext } from '../../types/app/transit';

/**
 * Filters out stops whose agencies are ALL hidden.
 *
 * A stop is excluded only when every one of its agencies appears in
 * `hiddenAgencyIds`. Stops with an empty `agencies` array are never excluded
 * (they have no agency to hide).
 *
 * @param stops - The list of stops to filter.
 * @param hiddenAgencyIds - Set of agency IDs to hide.
 * @returns The filtered list of stops.
 */
export function filterStopsByAgency(
  stops: StopWithContext[],
  hiddenAgencyIds: Set<string>,
): StopWithContext[] {
  if (hiddenAgencyIds.size === 0) {
    return stops;
  }
  return stops.filter(
    (swc) =>
      swc.agencies.length === 0 || !swc.agencies.every((a) => hiddenAgencyIds.has(a.agency_id)),
  );
}

/**
 * Collects unique agencies present across all stops, sorted by short name.
 *
 * Deduplicates by `agency_id` and sorts alphabetically by
 * `agency_short_name` (falling back to `agency_name`).
 *
 * @param stops - The list of stops to collect agencies from.
 * @returns Deduplicated, sorted array of agencies.
 */
export function collectPresentAgencies(stops: StopWithContext[]): Agency[] {
  const map = new Map<string, Agency>();
  for (const swc of stops) {
    for (const agency of swc.agencies) {
      if (!map.has(agency.agency_id)) {
        map.set(agency.agency_id, agency);
      }
    }
  }
  return [...map.values()].sort((a, b) => {
    const nameA = a.agency_short_name || a.agency_name;
    const nameB = b.agency_short_name || b.agency_name;
    return nameA.localeCompare(nameB);
  });
}
