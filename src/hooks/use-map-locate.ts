import { useCallback, useState } from 'react';
import type L from 'leaflet';
import type { UserLocation } from '../types/app/map';
import { applyLocateAction, resolveLocateAction, toUserLocation } from '../lib/map-locate';

interface UseMapLocateResult {
  locating: boolean;
  handleLocate: () => void;
}

/**
 * Wires the browser Geolocation API to map locate behavior and loading state.
 *
 * @param map - Leaflet map instance.
 * @param onLocated - Callback fired after a location is resolved and applied.
 */
export function useMapLocate(
  map: L.Map,
  onLocated: (location: UserLocation) => void,
): UseMapLocateResult {
  const [locating, setLocating] = useState(false);

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) {
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = toUserLocation(pos);
        const action = resolveLocateAction(map, loc);
        applyLocateAction(map, loc, action);
        onLocated(loc);
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [map, onLocated]);

  return {
    locating,
    handleLocate,
  };
}
