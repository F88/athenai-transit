import { useCallback, useEffect, useState } from 'react';
import type L from 'leaflet';
import type { InfoLevel } from '../../types/app/settings';
import { MapToggleButton } from '../button/map-toggle-button';
import { ControlPanel } from '../shared/control-panel';

function setZoomLevel(map: L.Map, zoom: number): void {
  const currentZoom = map.getZoom();
  const nextZoom = Math.max(map.getMinZoom(), Math.min(zoom, map.getMaxZoom()));
  if (nextZoom === currentZoom) {
    return;
  }

  map.setZoom(nextZoom, { animate: true });
}

function changeZoom(map: L.Map, delta: 1 | -1): void {
  setZoomLevel(map, map.getZoom() + delta);
}

function ZoomInButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <MapToggleButton active={active} onClick={onClick} label="拡大">
      +
    </MapToggleButton>
  );
}

function ZoomOutButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <MapToggleButton active={active} onClick={onClick} label="縮小">
      -
    </MapToggleButton>
  );
}

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
      <ZoomInButton active={canZoomIn} onClick={handleZoomIn} />
      <ZoomOutButton active={canZoomOut} onClick={handleZoomOut} />
    </ControlPanel>
  );
}
