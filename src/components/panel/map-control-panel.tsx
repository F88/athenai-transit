import type L from 'leaflet';
import type { InfoLevel } from '../../types/app/settings';
import { useMapZoom } from '../../hooks/use-map-zoom';
import { MapToggleButton } from '../button/map-toggle-button';
import { ControlPanel } from '../shared/control-panel';

interface MapControlPanelProps {
  map: L.Map;
  infoLevel: InfoLevel;
}

export function MapControlPanel({ map, infoLevel }: MapControlPanelProps) {
  const { canZoomIn, canZoomOut, handleZoomIn, handleZoomOut } = useMapZoom(map);

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
