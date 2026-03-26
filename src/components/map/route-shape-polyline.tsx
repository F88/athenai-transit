import { memo, useMemo } from 'react';
import { Polyline } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import type { RouteShape } from '../../types/app/map';
import { getRouteShapeStyle } from '../../domain/transit/route-selection';

/**
 * Extract [lat, lon] positions from shape points, stripping the
 * optional third element (shape_dist_traveled) to prevent Leaflet
 * from interpreting it as altitude.
 */
function toLatLng(points: [number, number, number?][]): LatLngExpression[] {
  return points.map((p) => [p[0], p[1]] as [number, number]);
}

interface RouteShapePolylinesProps {
  /** Route shapes to render. */
  shapes: RouteShape[];
  /** Set of selected route IDs for highlight/dim styling, or null if nothing is selected. */
  selectedRouteIds: Set<string> | null;
  /** Leaflet pane for fill polylines. */
  pane?: string;
  /** Whether to render outlines (render-mode dependent: standard = true, lightweight = false). */
  outline: boolean;
  /** Leaflet pane for outline polylines. Must have lower z-index than `pane`. */
  outlinePane?: string;
  /** Called when a route shape is clicked. */
  onRouteShapeSelected?: (routeId: string) => void;
}

/**
 * Renders route shape polylines with correct z-ordering.
 *
 * The `outline` prop controls whether outlines are rendered (render-mode
 * dependent — standard mode enables outlines, lightweight mode disables).
 * When enabled, each shape's `style.outline` determines whether an outline
 * is actually drawn: only highlighted styles include outlines.
 * Default and dimmed styles skip them (outline is null) to prevent
 * overlapping outlines from accumulating opacity on shared segments.
 *
 * Outlines are rendered into a separate Leaflet pane (`outlinePane`) with a
 * lower z-index than fills (`pane`). This guarantees correct z-ordering
 * regardless of React/Leaflet mount order — when `outline` switches from
 * false to true, newly mounted outline layers are appended to the pane's
 * SVG container, but pane-level z-index ensures they stay behind fills.
 *
 * Rendering order (back to front):
 * 1. Outlines in `outlinePane` (skipped for dimmed routes)
 * 2. Fills in `pane` — when a selection is active, dimmed routes render first,
 *    then highlighted routes on top so they are not obscured
 */
export const RouteShapePolylines = memo(function RouteShapePolylines({
  shapes,
  selectedRouteIds,
  pane,
  outline,
  outlinePane,
  onRouteShapeSelected,
}: RouteShapePolylinesProps) {
  // Precompute styles and sort so dimmed routes render before highlighted.
  // When freq is available, scale line weight by frequency.
  const styledShapes = useMemo(() => {
    const items = shapes.map((shape, idx) => ({
      shape,
      positions: toLatLng(shape.points),
      style: getRouteShapeStyle(selectedRouteIds, shape.routeId, shape.routeType, shape.freq),
      stableIndex: idx,
    }));
    if (selectedRouteIds === null) {
      return items;
    }
    return items.sort((a, b) => {
      const aSelected = selectedRouteIds.has(a.shape.routeId) ? 1 : 0;
      const bSelected = selectedRouteIds.has(b.shape.routeId) ? 1 : 0;
      return aSelected - bSelected;
    });
  }, [shapes, selectedRouteIds]);

  return (
    <>
      {/* Outlines — rendered into a separate pane with lower z-index */}
      {outline &&
        styledShapes.map(
          ({ shape, positions, style, stableIndex }) =>
            style.outline && (
              <Polyline
                key={`${shape.routeId}-${stableIndex}-outline`}
                positions={positions}
                interactive={false}
                pane={outlinePane}
                pathOptions={{ color: '#000000', ...style.outline }}
              />
            ),
        )}

      {/* Fills */}
      {styledShapes.map(({ shape, positions, style, stableIndex }) => (
        <Polyline
          key={`${shape.routeId}-${stableIndex}`}
          positions={positions}
          interactive={true}
          bubblingMouseEvents={false}
          pane={pane}
          pathOptions={{
            color: shape.color,
            weight: style.weight,
            opacity: style.opacity,
          }}
          eventHandlers={{
            click: () => onRouteShapeSelected?.(shape.routeId),
          }}
        />
      ))}
    </>
  );
});
