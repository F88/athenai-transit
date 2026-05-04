import { useCallback } from 'react';
import type L from 'leaflet';
import type { UserLocation } from '../types/app/map';
import { smoothMoveTo } from '../lib/leaflet-helpers';
import { pickRandomHome } from '../config/map-defaults';
import { useMapLocate } from './use-map-locate';

interface UseMapNavigationActionsOptions {
  /**
   * When the resolved location is near the map center, the locate button
   * enables this callback so the caller can flip auto-tracking on instead
   * of moving the map.
   */
  onNearMapCenter?: () => void;
}

interface UseMapNavigationActionsResult {
  locating: boolean;
  handleLocate: () => void;
  handleRandomJump: () => void;
}

/**
 * Bundles map navigation actions used by the navigation panel.
 *
 * @param map - Leaflet map instance.
 * @param onLocated - Callback fired with the resolved user location.
 * @param onDeselectStop - Callback fired before jumping to a random home.
 */
export function useMapNavigationActions(
  map: L.Map,
  onLocated: (location: UserLocation) => void,
  onDeselectStop: () => void,
  options?: UseMapNavigationActionsOptions,
): UseMapNavigationActionsResult {
  const { locating, handleLocate } = useMapLocate(map, onLocated, {
    onNearMapCenter: options?.onNearMapCenter,
  });

  const handleRandomJump = useCallback(() => {
    onDeselectStop();
    const { center, zoom } = pickRandomHome();
    smoothMoveTo(map, center, zoom);
  }, [map, onDeselectStop]);

  return {
    locating,
    handleLocate,
    handleRandomJump,
  };
}
