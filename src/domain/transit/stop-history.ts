import { DEFAULT_AGENCY_LANG, resolveAgencyLang } from '@/config/transit-defaults';
import { resolveDisplayNamesWithTranslatableText } from '@/domain/transit/i18n/resolve-display-names-with-translatable-text';
import { getAgencyDisplayNames } from '@/domain/transit/name-resolver/get-agency-display-name';
import { getStopDisplayNames } from '@/domain/transit/name-resolver/get-stop-display-names';
import type { StopReferenceSnapshot } from '@/types/app/stop-reference-snapshot';
import type { AppRouteTypeValue, Stop } from '@/types/app/transit';
import type { StopWithMeta } from '@/types/app/transit-composed';

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

/**
 * Builds a history selection payload from the latest stop data.
 */
export function createStopReferenceSnapshot(
  stopOrMeta: Stop | StopWithMeta,
  routeTypes: readonly AppRouteTypeValue[],
  preferredDisplayLangs: readonly string[] = DEFAULT_AGENCY_LANG,
): StopReferenceSnapshot {
  const stop = 'stop' in stopOrMeta ? stopOrMeta.stop : stopOrMeta;
  const name =
    'agencies' in stopOrMeta
      ? getStopDisplayNames(
          stop,
          preferredDisplayLangs,
          resolveAgencyLang(stopOrMeta.agencies, stop.agency_id),
        ).name || stop.stop_name
      : resolveDisplayNamesWithTranslatableText(
          { name: stop.stop_name, names: stop.stop_names },
          preferredDisplayLangs,
          [],
        ).name || stop.stop_name;
  const agencyNames =
    'agencies' in stopOrMeta
      ? [
          ...new Set(
            stopOrMeta.agencies
              .map((agency) => {
                const agencyLangs = resolveAgencyLang(stopOrMeta.agencies, agency.agency_id);
                return (
                  getAgencyDisplayNames(agency, preferredDisplayLangs, agencyLangs, 'short')
                    .resolved.name || agency.agency_id
                );
              })
              .filter(Boolean),
          ),
        ]
      : [];

  return {
    stopId: stop.stop_id,
    name,
    lat: stop.stop_lat,
    lon: stop.stop_lon,
    routeTypes: [...routeTypes],
    agencyNames,
    platformCode: stop.platform_code,
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
    stop_id: entry.snapshot.stopId,
    stop_name: entry.snapshot.name,
    stop_names: {},
    stop_lat: entry.snapshot.lat,
    stop_lon: entry.snapshot.lon,
    location_type: 0,
    agency_id: '',
    platform_code: entry.snapshot.platformCode,
  };
}
