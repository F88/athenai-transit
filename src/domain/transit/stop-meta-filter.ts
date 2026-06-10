import type { StopWithMeta } from '../../types/app/transit-composed';

/**
 * Distance filter: stops whose precomputed `distance` is within
 * `maxDistanceMeters` of the query centre. `distance` is precomputed (metres),
 * so no coordinate maths is needed here.
 *
 * Generic over {@link StopWithMeta} (the type that carries `distance`), so the
 * concrete input type -- e.g. `StopWithContext` -- is preserved in the result.
 * Stops with an undefined `distance` are dropped; input order is preserved.
 *
 * @param stops - The stops to filter (each carrying a precomputed `distance`).
 * @param maxDistanceMeters - Inclusive upper bound in metres.
 * @returns The stops within the distance, in input order.
 */
export function filterStopsWithinDistance<T extends StopWithMeta>(
  stops: readonly T[],
  maxDistanceMeters: number,
): T[] {
  return stops.filter((stop) => stop.distance !== undefined && stop.distance <= maxDistanceMeters);
}
