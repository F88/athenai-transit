import type L from 'leaflet';
import type { InfoLevel, PerfMode, RenderMode, Theme } from '../../types/app/settings';
import type { AnchorEntry } from '../../domain/portal/anchor';
import type { StopHistoryEntry } from '../../domain/transit/stop-history';
import type { UserLocation } from '../../types/app/map';
import type { Stop } from '../../types/app/transit';
import { InfoPanel } from '../panel/info-panel';
import { MapControlPanel } from '../panel/map-control-panel';
import { MapLayerPanel } from '../panel/map-layer-panel';
import { MapNavigationPanel } from '../panel/map-navigation-panel';
import { RenderingPanel } from '../panel/rendering-panel';
import { StopControlPanel } from '../panel/stop-control-panel';
import { StopTypeFilterPanel } from '../panel/stop-type-filter-panel';
import { Portals } from '../portals';
import { StopHistory } from '../stop-history';

interface MapOverlayPanelsProps {
  map: L.Map | null;
  infoLevel: InfoLevel;
  visibleRouteShapes: Set<number>;
  visibleStopTypes: Set<number>;
  renderMode: RenderMode;
  perfMode: PerfMode;
  theme: Theme;
  selectedStopId: string | null;
  stopHistory: StopHistoryEntry[];
  anchors: AnchorEntry[];
  onCycleTile: () => void;
  onToggleBusShapes: () => void;
  onToggleNonBusShapes: () => void;
  onToggleRenderMode: () => void;
  onTogglePerfMode: () => void;
  onCycleInfoLevel: () => void;
  onToggleDarkMode: () => void;
  onCycleLang: () => void;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
  onToggleStopType: (rt: number) => void;
  onSearchClick: () => void;
  onInfoClick: () => void;
  onLocated: (location: UserLocation) => void;
  onDeselectStop: () => void;
  onHistorySelect: (stop: Stop) => void;
  onPortalSelect: (entry: AnchorEntry) => void;
  tileIndex: number | null;
}

export function MapOverlayPanels({
  map,
  infoLevel,
  visibleRouteShapes,
  visibleStopTypes,
  renderMode,
  perfMode,
  theme,
  selectedStopId,
  stopHistory,
  anchors,
  onCycleTile,
  onToggleBusShapes,
  onToggleNonBusShapes,
  onToggleRenderMode,
  onTogglePerfMode,
  onCycleInfoLevel,
  onToggleDarkMode,
  onCycleLang,
  dataLang,
  onToggleStopType,
  onSearchClick,
  onInfoClick,
  onLocated,
  onDeselectStop,
  onHistorySelect,
  onPortalSelect,
  tileIndex,
}: MapOverlayPanelsProps) {
  return (
    <>
      {map && <MapControlPanel map={map} infoLevel={infoLevel} />}
      {map && (
        <MapNavigationPanel
          map={map}
          infoLevel={infoLevel}
          onLocated={onLocated}
          onDeselectStop={onDeselectStop}
        />
      )}
      <MapLayerPanel
        tileIndex={tileIndex}
        visibleRouteShapes={visibleRouteShapes}
        infoLevel={infoLevel}
        onCycleTile={onCycleTile}
        onToggleBusShapes={onToggleBusShapes}
        onToggleNonBusShapes={onToggleNonBusShapes}
      />
      <RenderingPanel
        renderMode={renderMode}
        perfMode={perfMode}
        infoLevel={infoLevel}
        theme={theme}
        lang={dataLang[0]}
        onToggleRenderMode={onToggleRenderMode}
        onTogglePerfMode={onTogglePerfMode}
        onCycleInfoLevel={onCycleInfoLevel}
        onToggleDarkMode={onToggleDarkMode}
        onCycleLang={onCycleLang}
      />
      <StopTypeFilterPanel
        visibleStopTypes={visibleStopTypes}
        infoLevel={infoLevel}
        onToggleStopType={onToggleStopType}
      />
      <StopControlPanel infoLevel={infoLevel} onSearchClick={onSearchClick} />
      <InfoPanel infoLevel={infoLevel} onInfoClick={onInfoClick} />
      <div className="pointer-events-none absolute top-[calc(4rem+env(safe-area-inset-top))] left-1/2 z-1001 flex -translate-x-1/2 gap-2 *:pointer-events-auto">
        <StopHistory
          history={stopHistory}
          selectedStopId={selectedStopId}
          infoLevel={infoLevel}
          onSelect={onHistorySelect}
        />
        <Portals anchors={anchors} infoLevel={infoLevel} onSelect={onPortalSelect} />
      </div>
    </>
  );
}
