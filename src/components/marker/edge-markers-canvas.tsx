import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EdgeMarker } from '../../types/app/map';
import type { InfoLevel } from '../../types/app/settings';
import type { Agency, Stop } from '../../types/app/transit';
import { primaryRouteType } from '../../domain/transit/route-type-priority';
import { getRouteTypeColor } from '../../lib/leaflet-helpers';
import { formatDistance } from '../../domain/transit/distance';
import { distanceStyle } from '../../utils/distance-style';
import { StopSummary } from './stop-summary';
import { createLogger } from '../../lib/logger';

const logger = createLogger('EdgeMarkersCanvas');

/** Arrow size in CSS pixels. */
const ARROW_SIZE = 16;
/** Hit radius for click detection in CSS pixels. */
const HIT_RADIUS = 16;

/**
 * Draws a filled arrow (triangle) on the canvas.
 *
 * @param ctx - Canvas 2D rendering context.
 * @param x - Center x in canvas pixels (already scaled by dpr).
 * @param y - Center y in canvas pixels (already scaled by dpr).
 * @param angle - Arrow direction in radians.
 * @param size - Arrow size in canvas pixels (already scaled by dpr).
 * @param color - Fill color.
 */
function drawArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  size: number,
  color: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Triangle pointing right (angle=0), centered on origin
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.6, -size * 0.7);
  ctx.lineTo(-size * 0.6, size * 0.7);
  ctx.closePath();

  ctx.fillStyle = color;
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.restore();
}

interface EdgeMarkersCanvasProps {
  markers: EdgeMarker[];
  /** Whether to show distance badges on markers. */
  showDistance: boolean;
  /** The Leaflet map container element, used to control cursor style. */
  mapContainer: HTMLElement;
  /** Info level for controlling tooltip display verbosity. */
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
  /** Measured container height for top/bottom tooltip alignment. */
  containerHeight: number;
  agenciesMap?: Map<string, Agency[]>;
  onStopSelected: (stop: Stop) => void;
}

/**
 * Renders edge markers as simple arrows on an HTML Canvas.
 *
 * Used in lightweight render mode for minimal overhead.
 * Supports click-to-select via hit detection on marker positions.
 */
export function EdgeMarkersCanvas({
  markers,
  showDistance,
  mapContainer,
  infoLevel,
  dataLang,
  containerHeight,
  agenciesMap,
  onStopSelected,
}: EdgeMarkersCanvasProps) {
  const { i18n } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markersRef = useRef(markers);
  const [hoveredMarker, setHoveredMarker] = useState<EdgeMarker | null>(null);

  useEffect(() => {
    markersRef.current = markers;
  });

  // Draw all arrows
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const parent = canvas.parentElement;
    if (!parent) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaledSize = ARROW_SIZE * dpr;
    for (const m of markers) {
      const style = distanceStyle(m.distance);
      const color = getRouteTypeColor(primaryRouteType(m.routeTypes));
      ctx.globalAlpha = style.opacity;
      drawArrow(ctx, m.x * dpr, m.y * dpr, m.angle, scaledSize, color);

      if (showDistance) {
        const label = formatDistance(m.distance, i18n.language, false);
        const fontSize = 9 * dpr;
        const padX = 3 * dpr;
        const padY = 2 * dpr;
        ctx.font = `bold ${fontSize}px sans-serif`;
        const textW = ctx.measureText(label).width;

        // Position badge on the screen-interior side of the arrow
        const offset = scaledSize + padX + textW / 2;
        const tx = m.x * dpr - Math.cos(m.angle) * offset;
        const ty = m.y * dpr - Math.sin(m.angle) * offset;

        // Background badge colored by distance
        const bgW = textW + padX * 2;
        const bgH = fontSize + padY * 2;
        const radius = 3 * dpr;
        ctx.fillStyle = style.color;
        ctx.beginPath();
        ctx.roundRect(tx - bgW / 2, ty - bgH / 2, bgW, bgH, radius);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = style.textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, tx, ty);
      }
      ctx.globalAlpha = 1;
    }
  }, [markers, showDistance, i18n.language]);

  // Document-level capture phase listeners for hit detection.
  // The canvas itself is pointer-events-none so it never blocks map
  // interaction (pan/drag/pinch). Instead, we intercept events at the
  // document level and check if they land on a marker.
  const onStopSelectedRef = useRef(onStopSelected);
  useEffect(() => {
    onStopSelectedRef.current = onStopSelected;
  });

  useEffect(() => {
    /** Returns the closest marker within HIT_RADIUS, or null. */
    function hitTest(clientX: number, clientY: number): EdgeMarker | null {
      const canvas = canvasRef.current;
      if (!canvas) {
        return null;
      }

      const rect = canvas.getBoundingClientRect();
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;

      let closest: EdgeMarker | null = null;
      let closestDist = HIT_RADIUS;

      for (const m of markersRef.current) {
        const dx = m.x - cx;
        const dy = m.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          closest = m;
        }
      }
      return closest;
    }

    function handleClick(e: MouseEvent) {
      const hit = hitTest(e.clientX, e.clientY);
      if (hit) {
        e.stopPropagation();
        logger.debug('click', hit.stop.stop_id, hit.stop.stop_name);
        onStopSelectedRef.current(hit.stop);
      }
    }

    // Show pointer cursor when hovering over a marker.
    // Must target .leaflet-container directly because Leaflet sets its
    // own cursor (grab/grabbing) on that element, overriding body styles.
    let cursorOverridden = false;

    function handleMouseMove(e: MouseEvent) {
      const hit = hitTest(e.clientX, e.clientY);
      if (hit) {
        if (!cursorOverridden) {
          mapContainer.style.cursor = 'pointer';
          cursorOverridden = true;
        }
        setHoveredMarker(hit);
      } else {
        if (cursorOverridden) {
          mapContainer.style.cursor = '';
          cursorOverridden = false;
        }
        setHoveredMarker(null);
      }
    }

    document.addEventListener('click', handleClick, true);
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('mousemove', handleMouseMove);
      if (cursorOverridden) {
        mapContainer.style.cursor = '';
      }
    };
  }, [mapContainer]);

  // Tooltip position: show toward screen interior from the marker
  const tooltipVClass =
    hoveredMarker && hoveredMarker.y > containerHeight / 2
      ? 'bottom-[calc(100%+6px)]'
      : 'top-[calc(100%+6px)]';

  let tooltipHClass: string;
  if (!hoveredMarker || hoveredMarker.hAlign === 'center') {
    tooltipHClass = 'left-1/2 -translate-x-1/2';
  } else if (hoveredMarker.hAlign === 'left') {
    tooltipHClass = 'left-0';
  } else {
    tooltipHClass = 'right-0';
  }

  return (
    <>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />
      {hoveredMarker && (
        <div
          className="pointer-events-none absolute"
          style={{ left: hoveredMarker.x, top: hoveredMarker.y }}
        >
          <div
            className={`pointer-events-none absolute z-10 rounded-md bg-white px-2 py-1.5 whitespace-nowrap shadow-[0_2px_8px_rgba(0,0,0,0.25)] dark:bg-gray-800 ${tooltipVClass} ${tooltipHClass}`}
          >
            <StopSummary
              stop={hoveredMarker.stop}
              routeTypes={hoveredMarker.routeTypes}
              agencies={agenciesMap?.get(hoveredMarker.stop.stop_id) ?? []}
              infoLevel={infoLevel}
              dataLang={dataLang}
            />
          </div>
        </div>
      )}
    </>
  );
}
