import { useCallback, useState } from 'react';
import type L from 'leaflet';
import type { UserLocation } from '../types/app/map';
import { applyLocateAction, resolveLocateAction, toUserLocation } from '../lib/map-locate';
import { createLogger } from '../lib/logger';

const logger = createLogger('MapLocate');

interface UseMapLocateOptions {
  /**
   * Invoked when the resolved location is near the current map center
   * (i.e. {@link resolveLocateAction} returns `near`). Lets the caller
   * react with an alternative behavior such as toggling tracking on
   * instead of zooming/moving the map.
   */
  onNearMapCenter?: () => void;
  /** Invoked when the Geolocation API reports an error. */
  onError?: (error: GeolocationPositionError) => void;
}

interface UseMapLocateResult {
  locating: boolean;
  handleLocate: () => void;
}

/**
 * Wires the browser Geolocation API to map locate behavior and loading state.
 *
 * @param map - Leaflet map instance.
 * @param onLocated - Callback fired after a location is resolved and applied.
 * @param options - Optional callbacks for near-map-center and error cases.
 */
export function useMapLocate(
  map: L.Map,
  onLocated: (location: UserLocation) => void,
  options?: UseMapLocateOptions,
): UseMapLocateResult {
  const [locating, setLocating] = useState(false);
  const onNearMapCenter = options?.onNearMapCenter;
  const onError = options?.onError;

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) {
      logger.debug('manual locate: geolocation unavailable');
      return;
    }

    const startTime = Date.now();
    logger.debug('manual locate: requesting position');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = toUserLocation(pos);
        logger.debug(
          `manual locate: acquired (elapsed=${Date.now() - startTime}ms, lat=${loc.lat.toFixed(5)}, lng=${loc.lng.toFixed(5)}, accuracy=${loc.accuracy.toFixed(0)}m)`,
        );
        const action = resolveLocateAction(map, loc);
        if (action.kind === 'move') {
          applyLocateAction(map, loc, action);
        } else if (action.kind === 'near' && onNearMapCenter) {
          onNearMapCenter();
        }
        onLocated(loc);
        setLocating(false);
      },
      (error) => {
        logger.debug(
          `manual locate: failed (elapsed=${Date.now() - startTime}ms, code=${String(error.code)}, message=${error.message})`,
        );
        setLocating(false);
        onError?.(error);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, [map, onLocated, onNearMapCenter, onError]);

  return {
    locating,
    handleLocate,
  };
}
