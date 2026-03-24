import { memo, useCallback, useRef, useState } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import type { InfoLevel } from '../../types/app/settings';
import type { Agency, RouteType, Stop } from '../../types/app/transit';
import type { TimetableEntry, StopWithContext } from '../../types/app/transit-composed';
import { createStopIcon } from '../../lib/leaflet-helpers';
import { primaryRouteType } from '../../domain/transit/route-type-color';
import { createLogger } from '../../utils/logger';
import { MARKER_STYLES } from '../../config/marker-styles';
import { StopSummary } from './stop-summary';

const logger = createLogger('StopMarkerDom');

function StopMarkerDomItem({
  stop,
  routeTypes,
  agencies,
  isSelected,
  dimmed,
  zIndexOffset,
  preloadedEntries,
  now,
  infoLevel,
  onFetchDepartures,
  showTooltip,
  onClick,
}: {
  stop: Stop;
  routeTypes: RouteType[];
  agencies: Agency[];
  isSelected: boolean;
  dimmed: boolean;
  zIndexOffset: number;
  preloadedEntries?: TimetableEntry[];
  now?: Date;
  infoLevel: InfoLevel;
  onFetchDepartures?: (stopId: string) => Promise<StopWithContext | null>;
  showTooltip: boolean;
  onClick: () => void;
}) {
  const [hoverEntries, setHoverEntries] = useState<TimetableEntry[] | null>(null);
  const [hoverAgencies, setHoverAgencies] = useState<Agency[] | null>(null);
  const fetchedRef = useRef<string | null>(null);

  const entries = preloadedEntries ?? hoverEntries;
  const hasEntries = entries && entries.length > 0;

  const handleMouseOver = useCallback(() => {
    if (!onFetchDepartures) {
      return;
    }
    if (preloadedEntries || fetchedRef.current === stop.stop_id) {
      return;
    }
    fetchedRef.current = stop.stop_id;
    onFetchDepartures(stop.stop_id)
      .then((result) => {
        if (result) {
          setHoverEntries(result.departures);
          if (result.agencies) {
            setHoverAgencies(result.agencies);
          }
        }
      })
      .catch((error) => {
        logger.error('Failed to fetch departures for stop:', error);
      });
  }, [stop.stop_id, preloadedEntries, onFetchDepartures]);

  return (
    <Marker
      position={[stop.stop_lat, stop.stop_lon]}
      icon={createStopIcon(primaryRouteType(routeTypes), isSelected, stop.stop_name, infoLevel)}
      opacity={dimmed ? MARKER_STYLES.dimmedOpacity : 1}
      // Leaflet computes base z-index from latitude (lat * -100000), so
      // zIndexOffset must be large enough to override latitude ordering.
      zIndexOffset={isSelected ? 10_000_000 : zIndexOffset * 10_000}
      eventHandlers={{
        click: () => {
          logger.debug('click', stop.stop_id, stop.stop_name);
          handleMouseOver();
          onClick();
        },
        ...(onFetchDepartures && { mouseover: handleMouseOver }),
      }}
    >
      {showTooltip && (
        <Tooltip
          key={isSelected ? 'permanent' : 'hover'}
          direction="top"
          offset={[0, -24]}
          permanent={isSelected}
          className="w-max max-w-80 whitespace-normal"
        >
          <StopSummary
            stop={stop}
            routeTypes={routeTypes}
            agencies={hoverAgencies ?? agencies}
            entries={hasEntries ? entries : undefined}
            now={now}
            infoLevel={infoLevel}
          />
        </Tooltip>
      )}
    </Marker>
  );
}

interface StopMarkersDomProps {
  stops: Stop[];
  selectedStopId: string | null;
  routeTypeMap: Map<string, RouteType[]>;
  nearbyDepartures?: Map<string, TimetableEntry[]>;
  time?: Date;
  infoLevel: InfoLevel;
  onStopSelected: (stop: Stop) => void;
  onFetchDepartures?: (stopId: string) => Promise<StopWithContext | null>;
  /** Whether to show tooltip on hover/select. Defaults to true. */
  showTooltip?: boolean;
  /** Map of stop ID to agencies operating at each stop. */
  agenciesMap?: Map<string, Agency[]>;
}

/**
 * Render all stop markers using standard DOM-based Leaflet markers.
 *
 * This is the standard-mode counterpart to {@link StopMarkersCanvas},
 * providing the same props interface for symmetric usage in MapView.
 *
 * No viewport culling is applied here: Leaflet's DOM marker layer
 * automatically hides markers outside the viewport. React reconciliation
 * cost remains, but the actual DOM render savings are handled by Leaflet.
 */
export const StopMarkersDom = memo(function StopMarkersDom({
  stops,
  selectedStopId,
  routeTypeMap,
  nearbyDepartures,
  time: now,
  infoLevel,
  onStopSelected,
  onFetchDepartures,
  showTooltip = true,
  agenciesMap,
}: StopMarkersDomProps) {
  if (stops.length === 0) {
    logger.verbose('stops=0, skipping render');
    return null;
  }

  logger.verbose(`stops=${stops.length}, selectedStopId=${selectedStopId}`);

  return (
    <>
      {stops.map((stop, index) => (
        <StopMarkerDomItem
          key={stop.stop_id}
          stop={stop}
          routeTypes={routeTypeMap.get(stop.stop_id) ?? [3]}
          agencies={agenciesMap?.get(stop.stop_id) ?? []}
          isSelected={selectedStopId === stop.stop_id}
          dimmed={!!selectedStopId && selectedStopId !== stop.stop_id}
          zIndexOffset={index}
          preloadedEntries={nearbyDepartures?.get(stop.stop_id)}
          now={now}
          infoLevel={infoLevel}
          onFetchDepartures={onFetchDepartures}
          showTooltip={showTooltip}
          onClick={() => onStopSelected(stop)}
        />
      ))}
    </>
  );
});
