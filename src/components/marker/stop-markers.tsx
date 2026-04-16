import L from 'leaflet';
import type { EffectiveRenderMode } from '../../domain/map/render-mode';
import type { InfoLevel } from '../../types/app/settings';
import type { Agency, AppRouteTypeValue, Stop } from '../../types/app/transit';
import type { ContextualTimetableEntry, StopWithContext } from '../../types/app/transit-composed';
import { StopMarkersDom } from './stop-markers-dom';
import { StopMarkersCanvas } from './stop-markers-canvas';

interface StopMarkersProps {
  /** Stops to render as markers. */
  stops: Stop[];
  /** Currently selected stop ID. Used for highlight and permanent tooltip. */
  selectedStopId: string | null;
  /** Map of stop ID to GTFS route_type values. Determines marker color. */
  routeTypeMap: Map<string, AppRouteTypeValue[]>;
  /** Controls display detail (e.g. stop name labels). */
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
  /** Resolved render mode. Switches between DOM and Canvas rendering. */
  renderMode: EffectiveRenderMode;
  /** Called when a stop marker is clicked. */
  onStopSelected: (stop: Stop) => void;
  /** Preloaded stop times keyed by stop ID. Omit for far stops. */
  stopTimes?: Map<string, ContextualTimetableEntry[]>;
  /** Current time for relative stop times display ("in X min"). Omit for far stops. */
  time?: Date;
  /** Fetches stop times on hover/click. Omit for far stops (no on-demand fetch). */
  onFetchStopTimes?: (stopId: string) => Promise<StopWithContext | null>;
  /** Whether to show tooltip on hover/select. Defaults to true. */
  showTooltip?: boolean;
  /** Shared Canvas renderer. Required so multiple Canvas instances share
   *  a single <canvas> element and don't block each other's pointer events. */
  renderer: L.Canvas;
  /** When true, Canvas mode uses incremental updates instead of full rebuild.
   *  Passed through to StopMarkersCanvas. Defaults to false. */
  incremental?: boolean;
  /** Map of stop ID to agencies operating at each stop. */
  agenciesMap?: Map<string, Agency[]>;
  /** When true, disables dimming of non-selected stops. Selected stop highlight is preserved. */
  disableDimming?: boolean;
}

export function StopMarkers({
  stops,
  selectedStopId,
  routeTypeMap,
  infoLevel,
  dataLang,
  renderMode,
  onStopSelected,
  stopTimes,
  time,
  onFetchStopTimes,
  showTooltip = true,
  renderer,
  incremental = false,
  agenciesMap,
  disableDimming = false,
}: StopMarkersProps) {
  return renderMode === 'lightweight' ? (
    <StopMarkersCanvas
      stops={stops}
      selectedStopId={selectedStopId}
      routeTypeMap={routeTypeMap}
      infoLevel={infoLevel}
      dataLang={dataLang}
      onStopSelected={onStopSelected}
      stopTimes={stopTimes}
      time={time}
      onFetchStopTimes={onFetchStopTimes}
      showTooltip={showTooltip}
      renderer={renderer}
      incremental={incremental}
      agenciesMap={agenciesMap}
      disableDimming={disableDimming}
    />
  ) : (
    <StopMarkersDom
      stops={stops}
      selectedStopId={selectedStopId}
      routeTypeMap={routeTypeMap}
      infoLevel={infoLevel}
      dataLang={dataLang}
      onStopSelected={onStopSelected}
      stopTimes={stopTimes}
      time={time}
      onFetchStopTimes={onFetchStopTimes}
      showTooltip={showTooltip}
      agenciesMap={agenciesMap}
      disableDimming={disableDimming}
    />
  );
}
