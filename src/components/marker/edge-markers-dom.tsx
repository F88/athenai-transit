import { useCallback, useRef, useState } from 'react';
import type { EdgeMarker } from '../../types/app/map';
import type { InfoLevel } from '../../types/app/settings';
import type { Agency, Stop } from '../../types/app/transit';
import type { StopWithContext } from '../../types/app/transit-composed';
import { truncateLabel } from '../../utils/truncate-label';
import { formatDistance } from '../../domain/transit/distance';
import { primaryRouteType } from '../../domain/transit/route-type-priority';
import { distanceStyle } from '../../utils/distance-style';
import { routeTypeColor } from '../../utils/route-type-color';
import { createInfoLevel } from '../../utils/create-info-level';
import { createLogger } from '../../utils/logger';
import { StopSummary } from './stop-summary';

const logger = createLogger('EdgeMarkersDom');

const EDGE_LABEL_MAX_LENGTH = 5;

/**
 * Converts a hex color and opacity to an rgba string.
 *
 * @param hex - Hex color string (e.g. "#f57f17").
 * @param opacity - Opacity value (0–1).
 * @returns CSS rgba string.
 */
function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

/**
 * Extra inward offset in pixels for DOM markers.
 * The shared EDGE_PADDING is tuned for Canvas (arrow center),
 * so DOM cards need additional inset to avoid touching the viewport edge.
 */
const DOM_INSET = -16;

/** Flex direction + transform for each edge alignment. */
const ALIGN_CLASSES = {
  left: 'flex-row -translate-y-1/2',
  right: 'flex-row-reverse translate-x-[-100%] -translate-y-1/2',
  top: 'flex-col -translate-x-1/2',
  bottom: 'flex-col-reverse -translate-x-1/2 translate-y-[-100%]',
} as const;

type AlignKey = keyof typeof ALIGN_CLASSES;

function EdgeMarkerItem({
  marker,
  now,
  infoLevel,
  showDistance,
  containerHeight,
  agencies,
  onStopSelected,
  onFetchDepartures,
}: {
  marker: EdgeMarker;
  now: Date;
  infoLevel: InfoLevel;
  showDistance: boolean;
  /** Measured container height for top/bottom alignment decision. */
  containerHeight: number;
  agencies: Agency[];
  onStopSelected: (stop: Stop) => void;
  onFetchDepartures: (stopId: string) => Promise<StopWithContext | null>;
}) {
  const [departures, setDepartures] = useState<StopWithContext | null>(null);
  const [hovered, setHovered] = useState(false);
  const fetchedRef = useRef<string | null>(null);

  const handleMouseEnter = useCallback(() => {
    setHovered(true);
    if (fetchedRef.current === marker.stop.stop_id) {
      return;
    }
    fetchedRef.current = marker.stop.stop_id;
    onFetchDepartures(marker.stop.stop_id)
      .then((result) => {
        if (result) {
          setDepartures(result);
        }
      })
      .catch((error) => {
        logger.error('Failed to fetch departures for edge marker:', error);
      });
  }, [marker.stop.stop_id, onFetchDepartures]);

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
  }, []);

  const rotateDeg = (marker.angle * 180) / Math.PI;
  const hasLabel = createInfoLevel(infoLevel).isNormalEnabled;

  const bgColor = routeTypeColor(primaryRouteType(marker.routeTypes));

  // Apply inward offset so DOM cards don't touch the viewport edge
  let markerX = marker.x;
  let markerY = marker.y;
  let alignKey: AlignKey;
  if (marker.hAlign === 'left') {
    alignKey = 'left';
    markerX += DOM_INSET;
  } else if (marker.hAlign === 'right') {
    alignKey = 'right';
    markerX -= DOM_INSET;
  } else {
    if (marker.y < containerHeight / 2) {
      alignKey = 'top';
      markerY += DOM_INSET;
    } else {
      alignKey = 'bottom';
      markerY -= DOM_INSET;
    }
  }
  const alignClass = ALIGN_CLASSES[alignKey];

  const hasData = departures && departures.departures.length > 0;

  // Vertical: show above if marker is in lower half, below otherwise
  const tooltipVClass =
    marker.y > containerHeight / 2 ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]';

  // Horizontal: expand toward screen center based on which edge the marker sits on
  let tooltipHClass: string;
  switch (marker.hAlign) {
    case 'left':
      tooltipHClass = 'left-0';
      break;
    case 'right':
      tooltipHClass = 'right-0';
      break;
    default:
      tooltipHClass = 'left-1/2 -translate-x-1/2';
  }

  const dStyle = distanceStyle(marker.distance);

  return (
    <div
      className={`pointer-events-auto absolute flex cursor-pointer items-center gap-0.5 rounded-lg border-2 border-white py-1 shadow-[0_1px_4px_rgba(0,0,0,0.35)] ${hasLabel || showDistance ? 'px-1.5' : 'px-1'} ${alignClass}`}
      style={{ left: markerX, top: markerY, backgroundColor: hexToRgba(bgColor, dStyle.opacity) }}
      onClick={() => {
        logger.debug('click', marker.stop.stop_id, marker.stop.stop_name);
        onStopSelected(marker.stop);
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="h-3.5 w-3.5 shrink-0 bg-white [clip-path:polygon(0%_15%,100%_50%,0%_85%)]"
        style={{ transform: `rotate(${rotateDeg}deg)` }}
      />
      {hasLabel && (
        <span className="pointer-events-none max-w-18 overflow-hidden text-center text-[10px] leading-tight font-semibold text-ellipsis whitespace-nowrap text-white">
          {truncateLabel(marker.stop.stop_name, EDGE_LABEL_MAX_LENGTH)}
        </span>
      )}
      {showDistance && (
        <span
          className="pointer-events-none rounded-sm border-2 border-white px-0.5 text-[9px] leading-tight font-bold"
          style={{
            backgroundColor: dStyle.color,
            color: dStyle.textColor,
          }}
        >
          {formatDistance(marker.distance, false)}
        </span>
      )}
      {hovered && (
        <div
          className={`pointer-events-none absolute z-10 rounded-md bg-white px-2 py-1.5 whitespace-nowrap shadow-[0_2px_8px_rgba(0,0,0,0.25)] dark:bg-gray-800 ${tooltipVClass} ${tooltipHClass}`}
        >
          <StopSummary
            stop={marker.stop}
            routeTypes={marker.routeTypes}
            agencies={departures?.agencies ?? agencies}
            entries={hasData ? departures.departures : undefined}
            now={now}
            infoLevel={infoLevel}
          />
        </div>
      )}
    </div>
  );
}

interface EdgeMarkersDomProps {
  markers: EdgeMarker[];
  now: Date;
  infoLevel: InfoLevel;
  /** Whether to show distance badges on markers. */
  showDistance: boolean;
  /** Measured container height for top/bottom alignment. */
  containerHeight: number;
  agenciesMap?: Map<string, Agency[]>;
  onStopSelected: (stop: Stop) => void;
  onFetchDepartures: (stopId: string) => Promise<StopWithContext | null>;
}

/**
 * Renders edge markers as DOM elements with labels, hover tooltips, and click handling.
 *
 * Used in standard render mode.
 */
export function EdgeMarkersDom({
  markers,
  now,
  infoLevel,
  showDistance,
  containerHeight,
  agenciesMap,
  onStopSelected,
  onFetchDepartures,
}: EdgeMarkersDomProps) {
  return (
    <>
      {markers.map((marker) => (
        <EdgeMarkerItem
          key={marker.stop.stop_id}
          marker={marker}
          now={now}
          infoLevel={infoLevel}
          showDistance={showDistance}
          containerHeight={containerHeight}
          agencies={agenciesMap?.get(marker.stop.stop_id) ?? []}
          onStopSelected={onStopSelected}
          onFetchDepartures={onFetchDepartures}
        />
      ))}
    </>
  );
}
