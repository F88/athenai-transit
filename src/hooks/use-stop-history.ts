import { useCallback, useState } from 'react';
import type { RouteType } from '../types/app/transit';
import type { StopWithMeta } from '../types/app/transit-composed';
import { addToHistory, type StopHistoryEntry } from '../domain/transit/stop-history';

const STORAGE_KEY = 'stop-history';

/**
 * Migrates a legacy history entry that has `routeType: number` (singular)
 * to the current `routeTypes: number[]` (plural) format.
 *
 * @param entry - A raw parsed entry that may have the old or new schema.
 * @returns A properly shaped {@link StopHistoryEntry}.
 */
function migrateEntry(entry: Record<string, unknown>): StopHistoryEntry | null {
  // Validate required nested structure
  const swm = entry.stopWithMeta;
  if (
    typeof swm !== 'object' ||
    swm === null ||
    typeof (swm as Record<string, unknown>).stop !== 'object' ||
    (swm as Record<string, unknown>).stop === null ||
    typeof ((swm as Record<string, unknown>).stop as Record<string, unknown>).stop_id !== 'string'
  ) {
    return null;
  }

  if ('routeTypes' in entry && Array.isArray(entry.routeTypes)) {
    return entry as unknown as StopHistoryEntry;
  }
  // Legacy format: routeType (singular number)
  const legacyType =
    'routeType' in entry && typeof entry.routeType === 'number'
      ? (entry.routeType as RouteType)
      : (3 as const);
  return {
    stopWithMeta: swm as StopHistoryEntry['stopWithMeta'],
    routeTypes: [legacyType],
    selectedAt: (entry.selectedAt as number) ?? 0,
  };
}

/**
 * Persists history to localStorage.
 *
 * @param history - History entries to save.
 */
function saveHistory(history: StopHistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

/**
 * Loads history from localStorage.
 *
 * Handles migration from the legacy `routeType: number` format
 * to the current `routeTypes: number[]` format. After parsing,
 * the data is always re-saved to ensure the new format persists.
 * This is called once on mount, so the extra write is negligible.
 *
 * @returns Stored history entries, or empty array on failure.
 */
function loadHistory(): StopHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>[];
    const migrated = parsed.map(migrateEntry).filter((e): e is StopHistoryEntry => e !== null);
    // Re-save immediately so legacy entries are persisted in the new format
    saveHistory(migrated);
    return migrated;
  } catch {
    return [];
  }
}

/**
 * Return type for the useStopHistory hook.
 */
export interface UseStopHistoryReturn {
  /** History entries, most recent first. */
  history: StopHistoryEntry[];
  /** Record a stop selection in history. */
  pushStop: (stopWithMeta: StopWithMeta, routeTypes: RouteType[]) => void;
}

/**
 * Manages a history of selected stops with localStorage persistence.
 *
 * @returns History state and a push function.
 */
export function useStopHistory(): UseStopHistoryReturn {
  const [history, setHistory] = useState<StopHistoryEntry[]>(loadHistory);

  const pushStop = useCallback((stopWithMeta: StopWithMeta, routeTypes: RouteType[]) => {
    setHistory((prev) => {
      const next = addToHistory(prev, stopWithMeta, routeTypes, Date.now());
      saveHistory(next);
      return next;
    });
  }, []);

  return { history, pushStop };
}
