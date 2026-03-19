/**
 * Build StopV2Json[] from ODPT Station data.
 */

import type { StopV2Json } from '../../../../../src/types/data/transit-v2-json';
import type { OdptStation, OdptStationOrder } from '../../../../types/odpt-train';

/**
 * Extract short station name from ODPT station ID.
 * e.g. "odpt.Station:Yurikamome.Shimbashi" -> "Shimbashi"
 */
export function extractStationShortId(odptId: string): string {
  const parts = odptId.split('.');
  return parts[parts.length - 1];
}

/**
 * Build StopV2Json[] from ODPT station data.
 *
 * ODPT stations are always location_type=0 (stop/platform).
 * No wheelchair_boarding, parent_station, or platform_code data available.
 *
 * @param prefix - Source prefix for ID namespacing.
 * @param stations - ODPT station data.
 * @param stationOrder - Merged station orders from all railways.
 * @returns Array of StopV2Json records sorted by station order.
 */
export function buildStopsV2(
  prefix: string,
  stations: OdptStation[],
  stationOrder: OdptStationOrder[],
): StopV2Json[] {
  // Build order map for consistent sorting
  const orderMap = new Map<string, number>();
  for (const entry of stationOrder) {
    orderMap.set(entry['odpt:station'], entry['odpt:index']);
  }

  // Sort by station order
  const sorted = [...stations].sort((a, b) => {
    const aIdx = orderMap.get(a['owl:sameAs']) ?? 999;
    const bIdx = orderMap.get(b['owl:sameAs']) ?? 999;
    return aIdx - bIdx;
  });

  return sorted.map((s) => {
    const shortId = extractStationShortId(s['owl:sameAs']);
    const title = s['odpt:stationTitle'];
    return {
      v: 2 as const,
      i: `${prefix}:${shortId}`,
      n: title.ja,
      a: s['geo:lat'],
      o: s['geo:long'],
      l: 0,
    };
  });
}
