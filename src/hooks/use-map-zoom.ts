import { useCallback, useEffect, useState } from 'react';
import type L from 'leaflet';
import { changeZoom } from '../lib/map-zoom';

interface UseMapZoomResult {
  canZoomIn: boolean;
  canZoomOut: boolean;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
}

/**
 * Tracks the current zoom level of a Leaflet map and provides
 * zoom-in / zoom-out handlers with boundary checks.
 *
 * @param map - Leaflet map instance to observe.
 */
export function useMapZoom(map: L.Map): UseMapZoomResult {
  const [zoom, setZoom] = useState(() => map.getZoom());

  useEffect(() => {
    const handleZoomEnd = () => {
      setZoom(map.getZoom());
    };

    map.on('zoomend', handleZoomEnd);
    handleZoomEnd();

    return () => {
      map.off('zoomend', handleZoomEnd);
    };
  }, [map]);

  const handleZoomIn = useCallback(() => {
    changeZoom(map, 1);
  }, [map]);

  const handleZoomOut = useCallback(() => {
    changeZoom(map, -1);
  }, [map]);

  return {
    canZoomIn: zoom < map.getMaxZoom(),
    canZoomOut: zoom > map.getMinZoom(),
    handleZoomIn,
    handleZoomOut,
  };
}
