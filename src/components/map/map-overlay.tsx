import type L from 'leaflet';
import type { AutoLocateOffReason } from '../../types/app/auto-locate';
import type { InfoLevel, PerfMode, RenderMode, Theme } from '../../types/app/settings';
import type { AnchorEntry } from '../../domain/portal/anchor';
import type { StopHistoryEntry } from '../../domain/transit/stop-history';
import type { UserLocation } from '../../types/app/map';
import type { StopWithMeta } from '../../types/app/transit-composed';
import { InfoPanel } from '../panel/info-panel';
import { MapControlPanel } from '../panel/map-control-panel';
import { MapLayerPanel } from '../panel/map-layer-panel';
import { MapNavigationPanel } from '../panel/map-navigation-panel';
import { RenderingPanel } from '../panel/rendering-panel';
import { StopControlPanel } from '../panel/stop-control-panel';
import { StopTypeFilterPanel } from '../panel/stop-type-filter-panel';
import { Portals } from '../portals';
import { StopHistory } from '../stop-history';
import { TimeControls } from '../time-controls';

/**
 * Props for {@link MapOverlay} — every chrome element that visually
 * overlays the map (corner panels, locate button, top-centre
 * dropdowns, time picker).
 *
 * `MapOverlay` is the sibling of `MapView` inside `MapViewContainer`:
 * MapView owns the Leaflet subtree, MapOverlay owns the surrounding
 * UI. Anything that should appear above the map but is *not* part of
 * the Leaflet rendering belongs here.
 */
interface MapOverlayProps {
  /**
   * The Leaflet `L.Map` instance published by MapView (via
   * `onMapInstance`). `null` until MapView has mounted Leaflet; the
   * map-aware children (`MapControlPanel`, `MapNavigationPanel`)
   * render only once it is non-null.
   */
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
  /** Whether continuous current-location tracking is currently enabled. */
  autoLocateEnabled: boolean;
  /** Turn auto-locate on. */
  onEnableAutoLocate: () => void;
  /** Turn auto-locate off, tagged with a typed reason for diagnostics. */
  onDisableAutoLocate: (reason: AutoLocateOffReason) => void;
  /** Counter that bumps on every successful geolocation fix; forwarded
   *  to the locate button to replay its ripple animation. */
  locatePulseKey: number;
  onDeselectStop: () => void;
  onHistorySelect: (entry: StopHistoryEntry) => void;
  onPortalSelect: (entry: AnchorEntry) => void;
  /** Removes the anchor for a Portal entry whose stop_id is no longer
   *  resolvable in the current GTFS dataset. */
  onPortalRemove: (entry: AnchorEntry) => void;
  /**
   * Looks up an anchored stop's current `StopWithMeta` from the
   * repository's full dataset. Forwarded to `Portals` so anchor
   * display names can be resolved against the latest GTFS data
   * at render time, regardless of viewport position.
   */
  lookupAnchorStopMeta: (stopId: string) => StopWithMeta | null;
  lookupHistoryStopMeta: (stopId: string) => StopWithMeta | null;
  tileIndex: number | null;
  /** The app's virtual "now" shown in the time-control bar (live clock, or a pinned custom time). */
  virtualNow: Date;
  /** True when the displayed time is user-pinned (not "now"). */
  isCustomTime: boolean;
  /** Reset the displayed time back to the live "now" clock. */
  onResetToNow: () => void;
  /** Pin the displayed time to the user-selected value. */
  onCustomTimeSet: (date: Date) => void;
}

/**
 * All chrome that overlays the map: corner panels, the locate
 * button, top-centre `StopHistory` / `Portals` dropdowns, and the
 * `TimeControls` time-pinning bar. Rendered as a sibling of
 * `MapView` inside `MapViewContainer` so each `absolute`-positioned
 * child resolves against the visible map area.
 *
 * This component is purely presentational and stateless — it forwards
 * props to its sub-components. Lifted state (`map` instance,
 * `userLocation` via `onLocated`, etc.) is owned by `app.tsx`.
 */
export function MapOverlay({
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
  autoLocateEnabled,
  onEnableAutoLocate,
  onDisableAutoLocate,
  locatePulseKey,
  onDeselectStop,
  onHistorySelect,
  onPortalSelect,
  onPortalRemove,
  lookupAnchorStopMeta,
  lookupHistoryStopMeta,
  tileIndex,
  virtualNow,
  isCustomTime,
  onResetToNow,
  onCustomTimeSet,
}: MapOverlayProps) {
  return (
    <>
      {/*
       * Corner-panel group: one deliberate stacking context (z-1000) so the
       * panels' overlap order on short viewports is decided by their local
       * z inside the group, without touching the global chrome layering.
       * See docs/map-architecture.md "MapOverlay corner-panel group".
       */}
      <div className="pointer-events-none absolute inset-0 z-1000">
        {map && <MapControlPanel map={map} infoLevel={infoLevel} />}
        {map && (
          <MapNavigationPanel
            map={map}
            infoLevel={infoLevel}
            autoLocateEnabled={autoLocateEnabled}
            onEnableAutoLocate={onEnableAutoLocate}
            onDisableAutoLocate={onDisableAutoLocate}
            locatePulseKey={locatePulseKey}
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
      </div>

      <TimeControls
        time={virtualNow}
        isCustomTime={isCustomTime}
        onResetToNow={onResetToNow}
        onCustomTimeSet={onCustomTimeSet}
      />

      <div className="pointer-events-none absolute top-[calc(4rem+env(safe-area-inset-top))] left-1/2 z-1001 flex -translate-x-1/2 gap-2 *:pointer-events-auto">
        <StopHistory
          history={stopHistory}
          selectedStopId={selectedStopId}
          infoLevel={infoLevel}
          dataLang={dataLang}
          lookupStopMeta={lookupHistoryStopMeta}
          onSelect={onHistorySelect}
        />
        <Portals
          anchors={anchors}
          infoLevel={infoLevel}
          dataLang={dataLang}
          lookupStopMeta={lookupAnchorStopMeta}
          onSelect={onPortalSelect}
          onRemove={onPortalRemove}
        />
      </div>
    </>
  );
}
