import type { StopReferenceSnapshot } from '@/types/app/stop-reference-snapshot';
import type { AppRouteTypeValue, Stop } from '@/types/app/transit';
import type { StopWithMeta } from '@/types/app/transit-composed';

import { createStopReferenceSnapshot } from '@/domain/transit/stop-reference-snapshot';

/** Maximum number of anchor entries. */
export const MAX_ANCHOR_SIZE = 100;

/**
 * A durable anchor (bookmarked stop) entry.
 */
export interface AnchorEntry {
  /** Durable stop reference used for fallback rendering and navigation. */
  snapshot: StopReferenceSnapshot;
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
  if (anchors.some((a) => a.snapshot.stopId === entry.snapshot.stopId)) {
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
  const index = anchors.findIndex((a) => a.snapshot.stopId === update.snapshot.stopId);
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
    existing.snapshot.stopId === updated.snapshot.stopId &&
    existing.snapshot.name === updated.snapshot.name &&
    existing.snapshot.lat === updated.snapshot.lat &&
    existing.snapshot.lon === updated.snapshot.lon &&
    existing.snapshot.platformCode === updated.snapshot.platformCode &&
    existing.portal === updated.portal &&
    existing.snapshot.routeTypes.length === updated.snapshot.routeTypes.length &&
    existing.snapshot.routeTypes.every((rt, i) => rt === updated.snapshot.routeTypes[i]) &&
    existing.snapshot.agencyNames.length === updated.snapshot.agencyNames.length &&
    existing.snapshot.agencyNames.every((name, i) => name === updated.snapshot.agencyNames[i])
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
  if (!anchors.some((a) => a.snapshot.stopId === stopId)) {
    return anchors;
  }
  return anchors.filter((a) => a.snapshot.stopId !== stopId);
}

/**
 * Checks if a stop is in the anchor list.
 *
 * @param anchors - Current anchor list.
 * @param stopId - The stop ID to check.
 * @returns True if the stop is in the anchor list.
 */
export function isAnchor(anchors: AnchorEntry[], stopId: string): boolean {
  return anchors.some((a) => a.snapshot.stopId === stopId);
}

/**
 * Builds update entries for refreshing anchors with latest GTFS data.
 *
 * For each anchor that has a matching StopWithMeta, produces an update
 * with a refreshed StopReferenceSnapshot and the existing portal value.
 * Anchors without a match (removed from GTFS) are skipped. routeTypes
 * inside the refreshed snapshot are derived from meta.routes
 * (deduplicated, sorted ascending to match stopRouteTypeMap), falling
 * back to the anchor's existing routeTypes when the stop has no routes.
 *
 * Only entries where at least one field differs from the current
 * anchor are included. Returns an empty array when nothing needs
 * updating, so the caller can skip the batch update entirely.
 *
 * @param anchors - Current anchor list.
 * @param metas - Latest StopWithMeta entries from the repository.
 * @returns Update entries for anchors that have changed.
 */
export function buildAnchorRefreshUpdates(
  anchors: AnchorEntry[],
  metas: StopWithMeta[],
  preferredDisplayLangs: readonly string[],
): Omit<AnchorEntry, 'createdAt'>[] {
  if (metas.length === 0) {
    return [];
  }
  const metaMap = new Map(metas.map((m) => [m.stop.stop_id, m]));
  return anchors
    .filter((a) => metaMap.has(a.snapshot.stopId))
    .map((anchor) => {
      const meta = metaMap.get(anchor.snapshot.stopId)!;
      const routeTypes: AppRouteTypeValue[] =
        meta.routes.length > 0
          ? [...new Set(meta.routes.map((route) => route.route_type))].sort((a, b) => a - b)
          : [...anchor.snapshot.routeTypes];
      return {
        anchor,
        update: {
          snapshot: createStopReferenceSnapshot(meta, routeTypes, preferredDisplayLangs),
          portal: anchor.portal,
        },
      };
    })
    .filter(
      ({ anchor, update }) =>
        anchor.snapshot.name !== update.snapshot.name ||
        anchor.snapshot.lat !== update.snapshot.lat ||
        anchor.snapshot.lon !== update.snapshot.lon ||
        anchor.snapshot.platformCode !== update.snapshot.platformCode ||
        anchor.snapshot.routeTypes.length !== update.snapshot.routeTypes.length ||
        anchor.snapshot.routeTypes.some((rt, i) => rt !== update.snapshot.routeTypes[i]) ||
        anchor.snapshot.agencyNames.length !== update.snapshot.agencyNames.length ||
        anchor.snapshot.agencyNames.some((name, i) => name !== update.snapshot.agencyNames[i]),
    )
    .map(({ update }) => update);
}

/**
 * Build a minimal Stop for anchor navigation from the persisted snapshot.
 */
export function buildAnchorSelectionStop(entry: AnchorEntry): Stop | null {
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
