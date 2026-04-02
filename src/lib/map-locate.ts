import type L from 'leaflet';
import type { UserLocation } from '../types/app/map';
import { smoothMoveTo } from './leaflet-helpers';
import { createLogger } from '../utils/logger';

const CURRENT_LOCATION_TARGET_ZOOM = 16;
const LOCATE_NEAR_THRESHOLD_METERS = 10;

const logger = createLogger('map-locate');

export type LocateAction =
  | { kind: 'move'; distanceToLocation: number }
  | {
      kind: 'zoom-in';
      distanceToLocation: number;
      currentZoom: number;
      nextZoom: number;
    }
  | { kind: 'noop'; distanceToLocation: number; currentZoom: number };

/**
 * Convert a browser {@link GeolocationPosition} to a {@link UserLocation}.
 *
 * @param pos - Raw geolocation result from the Geolocation API.
 * @returns A simplified location object with lat, lng, and accuracy.
 */
export function toUserLocation(pos: GeolocationPosition): UserLocation {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
  };
}

/**
 * Determine what action to take when the user taps "locate me".
 *
 * - If the map center is far from the user's location, move there.
 * - If the map center is already near, zoom in one level.
 * - If already near and at max zoom, do nothing.
 *
 * @param map - Leaflet map instance.
 * @param loc - User's current location.
 * @returns The resolved action describing what should happen.
 */
export function resolveLocateAction(map: L.Map, loc: UserLocation): LocateAction {
  const center = map.getCenter();
  const currentZoom = map.getZoom();
  const distanceToLocation = map.distance(center, [loc.lat, loc.lng]);

  if (distanceToLocation > LOCATE_NEAR_THRESHOLD_METERS) {
    return { kind: 'move', distanceToLocation };
  }

  const nextZoom = Math.min(currentZoom + 1, map.getMaxZoom());
  if (nextZoom > currentZoom) {
    return {
      kind: 'zoom-in',
      distanceToLocation,
      currentZoom,
      nextZoom,
    };
  }

  return { kind: 'noop', distanceToLocation, currentZoom };
}

/**
 * Execute a {@link LocateAction} on the map.
 *
 * @param map - Leaflet map instance.
 * @param loc - User's current location.
 * @param action - The action to apply (from {@link resolveLocateAction}).
 */
export function applyLocateAction(map: L.Map, loc: UserLocation, action: LocateAction): void {
  switch (action.kind) {
    case 'move':
      logger.debug(
        `handleLocate: center far from current location (${action.distanceToLocation.toFixed(1)}m > ${String(LOCATE_NEAR_THRESHOLD_METERS)}m), moving to zoom ${String(CURRENT_LOCATION_TARGET_ZOOM)}`,
      );
      smoothMoveTo(map, [loc.lat, loc.lng], CURRENT_LOCATION_TARGET_ZOOM);
      return;
    case 'zoom-in':
      logger.debug(
        `handleLocate: center near current location (${action.distanceToLocation.toFixed(1)}m <= ${String(LOCATE_NEAR_THRESHOLD_METERS)}m), zooming in ${String(action.currentZoom)} -> ${String(action.nextZoom)}`,
      );
      map.setZoom(action.nextZoom, { animate: true });
      return;
    case 'noop':
      logger.debug(
        `handleLocate: center near current location (${action.distanceToLocation.toFixed(1)}m <= ${String(LOCATE_NEAR_THRESHOLD_METERS)}m) and zoom already at max (${String(action.currentZoom)})`,
      );
      return;
  }
}
