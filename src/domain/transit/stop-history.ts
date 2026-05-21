import type { AppRouteTypeValue, Stop } from '../../types/app/transit';

/** Maximum number of stops retained in history. */
export const MAX_HISTORY_SIZE = 20;

export const STOP_HISTORY_STORAGE_VERSION = 3;

export interface StopHistorySnapshot {
  /** Display string captured at selection time after i18n resolution. */
  name: string;
  /** Last known stop latitude; null for older migrated entries without coordinates. */
  lat: number | null;
  /** Last known stop longitude; null for older migrated entries without coordinates. */
  lon: number | null;
  /** Last known route types for the stop. */
  routeTypes: AppRouteTypeValue[];
}

/**
 * Entry in the stop selection history.
 */
export interface StopHistoryEntry {
  stopId: string;
  /** Last known data used when current repository metadata cannot be resolved. */
  snapshot: StopHistorySnapshot;
  /** Epoch ms when the stop was last selected. */
  selectedAt: number;
}

/**
 * History payload captured at selection time before the timestamp is assigned.
 */
export interface StopHistorySelection {
  stopId: string;
  snapshot: StopHistorySnapshot;
}

export interface StoredStopHistory {
  version: typeof STOP_HISTORY_STORAGE_VERSION;
  entries: StopHistoryEntry[];
}

/**
 * Adds a stop to the front of the history list.
 *
 * If the stop already exists, it is moved to the front with an updated
 * timestamp. The list is capped at {@link MAX_HISTORY_SIZE}.
 *
 * @param history - Current history list (most recent first).
 * @param selection - History selection payload to add.
 * @param now - Current timestamp in epoch ms.
 * @returns New history list with the entry at index 0.
 */
export function addToHistory(
  history: StopHistoryEntry[],
  selection: StopHistorySelection,
  now: number,
): StopHistoryEntry[] {
  const stopId = selection.stopId;
  const filtered = history.filter((e) => e.stopId !== stopId);
  const entry: StopHistoryEntry = {
    stopId,
    snapshot: selection.snapshot,
    selectedAt: now,
  };
  return [entry, ...filtered].slice(0, MAX_HISTORY_SIZE);
}

/**
 * Builds a history selection payload from the latest stop data.
 */
export function createStopHistorySelection(
  stop: Stop,
  routeTypes: AppRouteTypeValue[],
): StopHistorySelection {
  return {
    stopId: stop.stop_id,
    snapshot: {
      name: stop.stop_name,
      lat: stop.stop_lat,
      lon: stop.stop_lon,
      routeTypes,
    },
  };
}

/**
 * Build a minimal Stop for history-based selection when current repository
 * metadata is unavailable but the persisted snapshot still has coordinates.
 */
export function buildHistorySelectionStop(entry: StopHistoryEntry): Stop | null {
  if (entry.snapshot.lat === null || entry.snapshot.lon === null) {
    return null;
  }

  return {
    stop_id: entry.stopId,
    stop_name: entry.snapshot.name,
    stop_names: {},
    stop_lat: entry.snapshot.lat,
    stop_lon: entry.snapshot.lon,
    location_type: 0,
    agency_id: '',
  };
}
