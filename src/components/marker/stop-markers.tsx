import L from 'leaflet';
import type { InfoLevel } from '../../types/app/settings';
import type { EffectiveRenderMode } from '../../utils/render-mode';
import type { Agency, RouteType, Stop } from '../../types/app/transit';
import type { TimetableEntry, StopWithContext } from '../../types/app/transit-composed';
import { StopMarkersDom } from './stop-markers-dom';
import { StopMarkersCanvas } from './stop-markers-canvas';
import { createLogger } from '../../utils/logger';

const logger = createLogger('StopMarkers');

interface StopMarkersProps {
  /** Stops to render as markers. */
  stops: Stop[];
  /** Currently selected stop ID. Used for highlight and permanent tooltip. */
  selectedStopId: string | null;
  /** Map of stop ID to GTFS route_type values. Determines marker color. */
  routeTypeMap: Map<string, RouteType[]>;
  /** Controls display detail (e.g. stop name labels). */
  infoLevel: InfoLevel;
  /** Resolved render mode. Switches between DOM and Canvas rendering. */
  renderMode: EffectiveRenderMode;
  /** Called when a stop marker is clicked. */
  onStopSelected: (stop: Stop) => void;
  /** Preloaded departure groups keyed by stop ID. Omit for far stops. */
  nearbyDepartures?: Map<string, TimetableEntry[]>;
  /** Current time for relative departure display ("in X min"). Omit for far stops. */
  time?: Date;
  /** Fetches departures on hover/click. Omit for far stops (no on-demand fetch). */
  onFetchDepartures?: (stopId: string) => Promise<StopWithContext | null>;
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
}

export function StopMarkers({
  stops,
  selectedStopId,
  routeTypeMap,
  infoLevel,
  renderMode,
  onStopSelected,
  nearbyDepartures,
  time,
  onFetchDepartures,
  showTooltip = true,
  renderer,
  incremental = false,
  agenciesMap,
}: StopMarkersProps) {
  logger.verbose(
    `stops=${stops.length}, renderMode=${renderMode}, incremental=${incremental}, selectedStopId=${selectedStopId}`,
  );
  return renderMode === 'lightweight' ? (
    <StopMarkersCanvas
      stops={stops}
      selectedStopId={selectedStopId}
      routeTypeMap={routeTypeMap}
      infoLevel={infoLevel}
      onStopSelected={onStopSelected}
      nearbyDepartures={nearbyDepartures}
      time={time}
      onFetchDepartures={onFetchDepartures}
      showTooltip={showTooltip}
      renderer={renderer}
      incremental={incremental}
      agenciesMap={agenciesMap}
    />
  ) : (
    <StopMarkersDom
      stops={stops}
      selectedStopId={selectedStopId}
      routeTypeMap={routeTypeMap}
      infoLevel={infoLevel}
      onStopSelected={onStopSelected}
      nearbyDepartures={nearbyDepartures}
      time={time}
      onFetchDepartures={onFetchDepartures}
      showTooltip={showTooltip}
      agenciesMap={agenciesMap}
    />
  );
}
