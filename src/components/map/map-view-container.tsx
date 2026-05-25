import type { ReactNode } from 'react';
import { useMapSlotElement } from '../../hooks/use-map-slot';
import { useElementRect } from '../../hooks/use-element-rect';

/**
 * Always-mounted positioning wrapper for the App-root map layer.
 *
 * The hoisted `MapView` lives inside this container (case 1A) so its
 * Leaflet map instance survives every layout-mode and orientation
 * transition. The container's job is to **size and position MapView to
 * match the visible map area declared by the current layout**, so
 * Leaflet's `getBounds()` / `getCenter()` / `getSize()` correspond to
 * the area the user actually sees — and so features that depend on
 * them (Edge Markers, "current location" centring, the "stops in
 * viewport" feed) keep working correctly.
 *
 * Coordination flow:
 * 1. The active layout (`MapBottomSheetLayout` / `MultiPaneLayout`)
 *    renders a `<div>` that marks the visible map slot and registers
 *    it via `useSetMapSlotElement` (passed as a React `ref` callback).
 * 2. This container reads the slot through `useMapSlotElement` and
 *    observes its viewport-relative bounding rect with
 *    `useElementRect` (`ResizeObserver`-backed). Multi-pane drag
 *    handle resizes therefore propagate live.
 * 3. The container's positioning wrapper applies the rect as
 *    `position: absolute` + explicit `top/left/width/height`, so
 *    MapView's own outer `<div>` (sized `w-full h-full`) matches the
 *    slot exactly. MapView's internal `ResizeObserver` then calls
 *    Leaflet `map.invalidateSize()` automatically.
 *
 * The wrapper deliberately has **no z-index** to avoid creating a
 * stacking context — descendant chrome (z-1000+) continues to bubble
 * to the root stacking context, per DEVELOPMENT.md "z-index 階層".
 *
 * Before the layout registers its slot (a single render frame at
 * App start-up at most), the wrapper falls back to `inset-0` so
 * MapView still mounts and Leaflet initialises against a non-zero
 * container. The slot's first `ref` callback then takes over.
 */
export function MapViewContainer({ children }: { children: ReactNode }) {
  const slotElement = useMapSlotElement();
  const slotRect = useElementRect(slotElement);

  if (!slotRect) {
    // Slot has not been registered yet; fall back to viewport-fill so
    // MapView mounts on a non-zero container. This branch is brief —
    // typically a single render frame between the provider mounting
    // and the layout's slot div committing.
    return <div className="absolute inset-0">{children}</div>;
  }

  return (
    <div
      className="absolute"
      style={{
        top: slotRect.top,
        left: slotRect.left,
        width: slotRect.width,
        height: slotRect.height,
      }}
    >
      {children}
    </div>
  );
}
