import type L from 'leaflet';
import type { UserLocation } from '../types/app/map';
import { smoothMoveTo } from './leaflet-helpers';
import { createLogger } from './logger';

const CURRENT_LOCATION_TARGET_ZOOM = 16;
const LOCATE_NEAR_THRESHOLD_METERS = 10;

const logger = createLogger('map-locate');

export type LocateAction =
  | { kind: 'move'; distanceToLocation: number }
  | { kind: 'near'; distanceToLocation: number };

/**
 * Subset of {@link LocateAction} that requests an actual map move.
 * Used as the input type of {@link applyLocateAction} so the function
 * cannot be invoked for the `'near'` case at compile time — that case
 * is handled by the caller (e.g. toggling auto-tracking) and does not
 * touch the map.
 */
export type MoveLocateAction = Extract<LocateAction, { kind: 'move' }>;

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
 * - If the map center is far from the user's location, the action is `move`
 *   and the caller should pan/zoom the map to the location.
 * - If the map center is already near, the action is `near` and the caller
 *   may use it as a signal for an alternative behavior (e.g. toggling auto
 *   tracking) instead of moving the map.
 *
 * @param map - Leaflet map instance.
 * @param loc - User's current location.
 * @returns The resolved action describing what should happen.
 */
export function resolveLocateAction(map: L.Map, loc: UserLocation): LocateAction {
  const center = map.getCenter();
  const distanceToLocation = map.distance(center, [loc.lat, loc.lng]);

  if (distanceToLocation > LOCATE_NEAR_THRESHOLD_METERS) {
    return { kind: 'move', distanceToLocation };
  }
  return { kind: 'near', distanceToLocation };
}

/**
 * Pan and zoom the map to the user's location. Call only after
 * {@link resolveLocateAction} returns a `'move'` kind — passing a
 * `'near'` kind is a type error.
 *
 * @param map - Leaflet map instance.
 * @param loc - User's current location.
 * @param action - The move action returned by {@link resolveLocateAction}.
 */
export function applyLocateAction(map: L.Map, loc: UserLocation, action: MoveLocateAction): void {
  logger.debug(
    `applyLocateAction: center far from current location (${action.distanceToLocation.toFixed(1)}m > ${LOCATE_NEAR_THRESHOLD_METERS}m), moving to zoom ${CURRENT_LOCATION_TARGET_ZOOM}`,
  );
  smoothMoveTo(map, [loc.lat, loc.lng], CURRENT_LOCATION_TARGET_ZOOM);
}
