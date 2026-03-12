import type { RouteType, StopWithMeta } from '../../types/app/transit';

/** Maximum number of stops retained in history. */
export const MAX_HISTORY_SIZE = 20;

/**
 * Entry in the stop selection history.
 */
export interface StopHistoryEntry {
  stopWithMeta: StopWithMeta;
  routeTypes: RouteType[];
  /** Epoch ms when the stop was last selected. */
  selectedAt: number;
}

/**
 * Adds a stop to the front of the history list.
 *
 * If the stop already exists, it is moved to the front with an updated
 * timestamp. The list is capped at {@link MAX_HISTORY_SIZE}.
 *
 * @param history - Current history list (most recent first).
 * @param stopWithMeta - Stop with distance metadata to add.
 * @param routeTypes - GTFS route_type values for the stop.
 * @param now - Current timestamp in epoch ms.
 * @returns New history list with the entry at index 0.
 */
export function addToHistory(
  history: StopHistoryEntry[],
  stopWithMeta: StopWithMeta,
  routeTypes: RouteType[],
  now: number,
): StopHistoryEntry[] {
  const stopId = stopWithMeta.stop.stop_id;
  const filtered = history.filter((e) => e.stopWithMeta.stop.stop_id !== stopId);
  const entry: StopHistoryEntry = { stopWithMeta, routeTypes, selectedAt: now };
  return [entry, ...filtered].slice(0, MAX_HISTORY_SIZE);
}
