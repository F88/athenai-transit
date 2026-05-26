import type { StopReferenceSnapshot } from '@/types/app/stop-reference-snapshot';

/** Maximum number of stops retained in history. */
export const MAX_HISTORY_SIZE = 20;

export const STOP_HISTORY_STORAGE_VERSION = 4;

/**
 * Entry in the stop selection history.
 */
export interface StopHistoryEntry {
  /** Last known data used when current repository metadata cannot be resolved. */
  snapshot: StopReferenceSnapshot;
  /** Epoch ms when the stop was last selected. */
  selectedAt: number;
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
 * @param snapshot - History selection payload to add.
 * @param now - Current timestamp in epoch ms.
 * @returns New history list with the entry at index 0.
 */
export function addToHistory(
  history: StopHistoryEntry[],
  snapshot: StopReferenceSnapshot,
  now: number,
): StopHistoryEntry[] {
  const stopId = snapshot.stopId;
  const filtered = history.filter((entry) => entry.snapshot.stopId !== stopId);
  const entry: StopHistoryEntry = {
    snapshot: snapshot,
    selectedAt: now,
  };
  return [entry, ...filtered].slice(0, MAX_HISTORY_SIZE);
}
