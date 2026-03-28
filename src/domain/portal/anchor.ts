import type { RouteType } from '../../types/app/transit';

/** Maximum number of anchor entries. */
export const MAX_ANCHOR_SIZE = 100;

/**
 * A lightweight anchor (bookmarked stop) entry.
 *
 * Stores only the fields needed for display (name, emoji) and
 * map navigation (lat/lon). Unlike {@link StopHistoryEntry} which
 * snapshots the full StopWithMeta, AnchorEntry is resilient to
 * GTFS data updates because it does not store agencies, routes,
 * or distance.
 */
export interface AnchorEntry {
  /** GTFS stop_id. Primary key — immutable after creation. */
  stopId: string;
  /** Display name snapshot. Refreshed from GTFS data on app load. */
  stopName: string;
  /** Latitude snapshot. Refreshed from GTFS data on app load. */
  stopLat: number;
  /** Longitude snapshot. Refreshed from GTFS data on app load. */
  stopLon: number;
  /** GTFS route_type values for emoji display. Refreshed from GTFS data on app load. */
  routeTypes: RouteType[];
  /** Epoch ms when the anchor was created. Immutable. */
  createdAt: number;
  /**
   * Portal (group) name for categorizing anchors.
   * Multiple anchors can share the same portal name, forming a group.
   * Ungrouped when omitted. User-defined — not derived from GTFS data.
   */
  portal?: string;
}

/**
 * Adds a stop to the anchor list.
 *
 * If the stop already exists (by stopId), the list is returned
 * unchanged — unlike history, anchors do not move to the front
 * on re-add. New entries are prepended. The list is capped at
 * {@link MAX_ANCHOR_SIZE}.
 *
 * @param anchors - Current anchor list (most recently added first).
 * @param entry - Anchor fields excluding createdAt.
 * @param now - Current timestamp in epoch ms.
 * @returns New anchor list, or the original list if already present.
 */
export function addAnchor(
  anchors: AnchorEntry[],
  entry: Omit<AnchorEntry, 'createdAt'>,
  now: number,
): AnchorEntry[] {
  if (anchors.some((a) => a.stopId === entry.stopId)) {
    return anchors;
  }
  const newEntry: AnchorEntry = { ...entry, createdAt: now };
  return [newEntry, ...anchors].slice(0, MAX_ANCHOR_SIZE);
}

/**
 * Updates an existing anchor entry's mutable fields.
 *
 * Matches by stopId. If the stop is not found, the list is returned
 * unchanged. The `createdAt` field is always preserved from the
 * existing entry. If `portal` is undefined in the update, the
 * existing portal value is preserved.
 *
 * @param anchors - Current anchor list.
 * @param update - Fields to update. stopId is used to find the entry.
 * @returns New anchor list with the updated entry, or the original list if not found.
 */
export function updateAnchor(
  anchors: AnchorEntry[],
  update: Omit<AnchorEntry, 'createdAt'>,
): AnchorEntry[] {
  const index = anchors.findIndex((a) => a.stopId === update.stopId);
  if (index === -1) {
    return anchors;
  }
  const existing = anchors[index];
  const updated: AnchorEntry = {
    ...update,
    createdAt: existing.createdAt,
    portal: update.portal ?? existing.portal,
  };
  // Skip update if nothing changed
  if (
    existing.stopName === updated.stopName &&
    existing.stopLat === updated.stopLat &&
    existing.stopLon === updated.stopLon &&
    existing.portal === updated.portal &&
    existing.routeTypes.length === updated.routeTypes.length &&
    existing.routeTypes.every((rt, i) => rt === updated.routeTypes[i])
  ) {
    return anchors;
  }
  const next = [...anchors];
  next[index] = updated;
  return next;
}

/**
 * Removes a stop from the anchor list by stopId.
 *
 * @param anchors - Current anchor list.
 * @param stopId - The stop ID to remove.
 * @returns New anchor list without the specified stop, or the original list if not found.
 */
export function removeAnchor(anchors: AnchorEntry[], stopId: string): AnchorEntry[] {
  if (!anchors.some((a) => a.stopId === stopId)) {
    return anchors;
  }
  return anchors.filter((a) => a.stopId !== stopId);
}

/**
 * Checks if a stop is in the anchor list.
 *
 * @param anchors - Current anchor list.
 * @param stopId - The stop ID to check.
 * @returns True if the stop is in the anchor list.
 */
export function isAnchor(anchors: AnchorEntry[], stopId: string): boolean {
  return anchors.some((a) => a.stopId === stopId);
}
