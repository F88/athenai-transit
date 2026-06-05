import { StopPanel } from './stop-panel';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './ui/resizable';
import type { LayoutProps } from './layout-props';
import { useMultiPaneOrientation } from '../hooks/use-multi-pane-orientation';
import { useSetMapSlotElement } from '../hooks/use-map-slot';
import { MULTI_PANE_MAP_PANE_SIZE } from '../utils/multi-pane';

/**
 * Multi-pane-mode overlay for wide viewports: a resizable split that
 * frames the hoisted MapView (which lives at App root, behind this
 * layout) with the stop panel on one side and a transparent map
 * placeholder on the other.
 *
 * The map placeholder pane contains a slot `<div>` registered with
 * `MapViewContainer` via `useSetMapSlotElement`. The hoisted MapView
 * sizes itself to that slot's bounding rect, so as the user drags
 * the `ResizableHandle` the visible map area follows in real time —
 * and Leaflet's `getBounds()` / `getCenter()` stay in sync with what
 * the user actually sees.
 *
 * Visual placement follows the conventional map-app layout:
 * - horizontal — stop panel on the left, visible map on the right.
 * - vertical   — visible map on top, stop panel on the bottom.
 *
 * Achieving both at once requires swapping the JSX child order per
 * orientation. Each `ResizablePanel` carries a stable React `key`
 * and library `id`, so the StopPanel fiber (its filter state, scroll
 * position) and the library's panel sizes survive the reorder. This
 * used to crash with "Map container is being reused" when MapView
 * lived inside one of the panels (the reorder triggered a Leaflet
 * remount); after the case 1A hoist the placeholder pane is empty
 * apart from the slot div, so the reorder is safe.
 *
 * Pointer-events: the layout shell — the `ResizablePanelGroup` and
 * the map placeholder pane — is `pointer-events: none` so clicks
 * fall through to the hoisted MapView behind. The sheet pane and
 * resize handle override back to `auto`. See the inline
 * `groupClassName` comment for why this has to be forced via parent
 * selectors rather than props on the panel components themselves.
 */
export function MultiPaneLayout({
  bottomSheetProps,
  globalFilter,
  nearbyStopsCounts,
  filteredNearbyStopsCounts,
  stopBrowserState,
  onStopBrowserStateChange,
}: LayoutProps) {
  const orientation = useMultiPaneOrientation();
  const mapPaneSize = MULTI_PANE_MAP_PANE_SIZE[orientation];
  const setMapSlot = useSetMapSlotElement();

  const sheetPane = (
    // Sheet pane has no explicit size props — it takes the residual
    // space left after the map pane's size constraints
    // (`MULTI_PANE_MAP_PANE_SIZE`) are honoured.
    <ResizablePanel key="sheet" id="sheet">
      <StopPanel
        {...bottomSheetProps}
        globalFilter={globalFilter}
        nearbyStopsCounts={nearbyStopsCounts}
        filteredNearbyStopsCounts={filteredNearbyStopsCounts}
        stopBrowserState={stopBrowserState}
        onStopBrowserStateChange={onStopBrowserStateChange}
      />
    </ResizablePanel>
  );

  const mapPlaceholderPane = (
    // The outer `<div data-panel>` rendered by `react-resizable-panels`
    // v4 accepts neither our `className` nor our `style` on itself —
    // both land on an internal scroll-wrapper div the library inserts
    // between us and the panel. So `pointer-events: none` can't be
    // set on the outer from this call site; it is forced from the
    // parent via the Tailwind arbitrary descendant selector on
    // `ResizablePanelGroup` below (`[&_#multi-pane-map-pane]:
    // pointer-events-none`). Without that, clicks in the map area
    // would hit this outer panel (default `auto`) and Leaflet would
    // never receive drag / tap.
    //
    // The `pointer-events-none` on the inner wrapper `className` and
    // on the slot div is **defensive** — CSS `pointer-events` IS an
    // inherited property so they would inherit `none` from the outer
    // panel anyway, but the explicit annotation keeps the intent
    // visible at each layer and guards against any future refactor
    // that breaks the inheritance chain.
    <ResizablePanel
      key="map"
      id="multi-pane-map-pane"
      defaultSize={mapPaneSize.defaultSize}
      minSize={mapPaneSize.minSize}
      maxSize={mapPaneSize.maxSize}
      className="pointer-events-none bg-transparent"
    >
      {/* Slot for MapViewContainer: the hoisted MapView tracks this
       * element's bbox so Leaflet's view bounds match the visible
       * area as the resize handle is dragged. */}
      <div ref={setMapSlot} className="pointer-events-none h-full w-full" aria-hidden />
    </ResizablePanel>
  );

  // `absolute inset-0` with no z-index intentionally avoids creating a
  // stacking context, so descendant z-1000+ (e.g. StopPanel's z-1000,
  // dropdowns at z-1002) bubble to the root context exactly as in
  // pre-multi-pane code. The App root container provides the
  // positioned ancestor that this `absolute` fills.
  //
  // Pointer-events plumbing — CSS `pointer-events` IS an inherited
  // property, so the rule is:
  // - Group: `pointer-events-none` so the empty layout shell falls
  //   through to the hoisted MapView behind.
  // - Sheet panel + resize handle: arbitrary descendant selectors set
  //   `pointer-events-auto` to override the inherited `none`. The
  //   library's outer `<div>` for these panes ignores `className` /
  //   `style` props (both land on an inner wrapper the library inserts),
  //   so it must be targeted via the parent's selector.
  // - Map panel: inherits `none` from the group (correct — the map
  //   area must let clicks reach MapView). The `#multi-pane-map-pane`
  //   selector also keeps it `none` defensively if the inheritance
  //   chain ever changes.
  const groupClassName =
    'pointer-events-none absolute inset-0 ' +
    '[&_#multi-pane-map-pane]:pointer-events-none ' +
    '[&_#sheet]:pointer-events-auto ' +
    '[&_[data-slot=resizable-handle]]:pointer-events-auto';

  if (orientation === 'horizontal') {
    return (
      <ResizablePanelGroup orientation="horizontal" className={groupClassName}>
        {sheetPane}
        <ResizableHandle withHandle />
        {mapPlaceholderPane}
      </ResizablePanelGroup>
    );
  }

  return (
    <ResizablePanelGroup orientation="vertical" className={groupClassName}>
      {mapPlaceholderPane}
      <ResizableHandle withHandle />
      {sheetPane}
    </ResizablePanelGroup>
  );
}
