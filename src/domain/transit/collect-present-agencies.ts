import type { Agency } from '../../types/app/transit';
import type { StopWithContext } from '../../types/app/transit-composed';

/**
 * Collects unique agencies present across all stops, preserving encounter order.
 *
 * Deduplicates by `agency_id` while preserving the first-seen order
 * from `stops` and each stop's `agencies` array. This keeps the
 * agency filter UI aligned with the caller's stop ordering
 * (for example, nearby stops sorted by distance). No final sorting is
 * applied after collection.
 *
 * Intended for populating agency filter UI from the current
 * nearby stops snapshot — always run on the pre-filtered list
 * so that filter buttons remain visible after the user toggles
 * an agency off.
 *
 * @param stops - The list of stops to collect agencies from.
 * @returns Deduplicated agencies in first-seen order: the earliest
 * stop in `stops` wins, and within that stop the original `agencies`
 * array order is preserved.
 */
export function collectPresentAgencies(stops: readonly StopWithContext[]): Agency[] {
  const seenAgencyIds = new Set<string>();
  const agencies: Agency[] = [];

  for (const swc of stops) {
    for (const agency of swc.agencies) {
      if (!seenAgencyIds.has(agency.agency_id)) {
        seenAgencyIds.add(agency.agency_id);
        agencies.push(agency);
      }
    }
  }

  return agencies;
}
