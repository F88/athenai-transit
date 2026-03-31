import type { ServiceGroupEntry } from '../../types/data/transit-v2-json';

/**
 * Select the best matching service group for a set of active service IDs.
 *
 * Compares each group's serviceIds against the active set and picks the
 * group with the most overlap. On tie, the earlier group wins (array
 * order is the tie-break rule, matching InsightsBundle docs).
 *
 * Returns the group key, or undefined if no group has any overlap.
 *
 * @param serviceGroups - Service group definitions from InsightsBundle.
 * @param activeServiceIds - Active service IDs for the current date.
 * @returns The key of the best matching group, or undefined.
 */
export function selectServiceGroup(
  serviceGroups: ServiceGroupEntry[],
  activeServiceIds: Set<string>,
): string | undefined {
  let bestKey: string | undefined;
  let bestOverlap = 0;

  for (const group of serviceGroups) {
    let overlap = 0;
    for (const sid of group.serviceIds) {
      if (activeServiceIds.has(sid)) {
        overlap++;
      }
    }
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestKey = group.key;
    }
  }

  return bestKey;
}
