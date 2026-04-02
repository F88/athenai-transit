import { useCallback, useEffect, useState } from 'react';
import type L from 'leaflet';
import type { InfoLevel } from '../../types/app/settings';
import { changeZoom } from '../../lib/map-zoom';
import { MapToggleButton } from '../button/map-toggle-button';
import { ControlPanel } from '../shared/control-panel';

interface MapControlPanelProps {
  map: L.Map;
  infoLevel: InfoLevel;
}

export function MapControlPanel({ map, infoLevel }: MapControlPanelProps) {
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

  const canZoomIn = zoom < map.getMaxZoom();
  const canZoomOut = zoom > map.getMinZoom();

  return (
    <ControlPanel
      side="right"
      edge="bottom"
      offset="2rem"
      infoLevel={infoLevel}
      className="right-14!"
    >
      <MapToggleButton active={canZoomIn} onClick={handleZoomIn} label="拡大">
        +
      </MapToggleButton>
      <MapToggleButton active={canZoomOut} onClick={handleZoomOut} label="縮小">
        -
      </MapToggleButton>
    </ControlPanel>
  );
}
