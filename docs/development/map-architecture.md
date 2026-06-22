# Map Architecture

Map-related implementation details live here so `DEVELOPMENT.md` can remain a short developer entry point.

## Layout composition

App uses two layout modes based on viewport size. In multi-pane mode, orientation is resolved from the viewport aspect ratio. `MapView` is mounted once at the app root and follows the bbox declared by the active layout slot.

### Layout mode

`useLayoutMode()` resolves layout from viewport width.

| viewport width                        | mode         |
| ------------------------------------- | ------------ |
| `< WIDE_VIEWPORT_MIN_WIDTH` (= 800px) | `simple`     |
| `>= WIDE_VIEWPORT_MIN_WIDTH`          | `multi-pane` |

The pure decision is `resolveLayoutMode(viewport: Viewport): LayoutMode` in `src/utils/layout-mode.ts`.

### Multi-pane orientation

`useMultiPaneOrientation()` resolves split direction from viewport aspect ratio.

| Condition         | orientation  | Visual layout                       |
| ----------------- | ------------ | ----------------------------------- |
| `width >= height` | `horizontal` | stop panel left / visible map right |
| `width < height`  | `vertical`   | visible map top / stop panel bottom |

The pure decision is `resolveMultiPaneOrientation(width, height): MultiPaneOrientation` in `src/utils/multi-pane.ts`.

### MapView hoist

`MapView` is mounted once at the app root and does not remount across layout mode or orientation transitions. The same Leaflet map instance, loaded tiles, gesture state, center, and zoom survive transitions.

This avoids both the historical `Map container is being reused` crash (`react-resizable-panels` + Leaflet + StrictMode) and center / zoom reset across modes.

```text
App root (relative h-dvh w-dvw)
└── MapSlotProvider
    ├── MapViewContainer
    │   ├── MapView
    │   └── MapOverlay
    └── AppLayout
        ├── simple -> MapBottomSheetLayout
        │            ├── slot div
        │            └── BottomSheet
        └── multi-pane -> MultiPaneLayout
                         └── ResizablePanelGroup
                             ├── sheet panel -> StopPanel
                             ├── ResizableHandle
                             └── map placeholder panel -> slot div
```

### Slot tracking

1. Layout side renders a slot div with `useSetMapSlotElement()`.
2. `MapViewContainer` reads the slot with `useMapSlotElement()` and observes its bbox with `useElementRect()`.
3. `MapView` wrapper is absolutely positioned to that bbox.
4. Leaflet is kept in sync by `ResizeObserver` calling `map.invalidateSize()`.

This makes Leaflet APIs such as `getCenter()`, `getBounds()`, and `getSize()` reflect the visible map area.

### Pointer-events plumbing

The multi-pane `ResizablePanelGroup` is a layout shell. The map placeholder area must pass clicks through to the hoisted `MapView` behind it.

- `ResizablePanelGroup` outer div: `pointer-events: none`
- sheet pane / resize handle: overridden to `pointer-events: auto`
- map placeholder pane: remains `none`, so clicks pass through

`react-resizable-panels` v4 puts `className` / `style` on an inner wrapper, so outer-panel styling is applied from the parent using descendant selectors. See `src/components/multi-pane-layout.tsx`.

### Transition behavior

| transition                         | MapView                         | StopPanel state            | crash |
| ---------------------------------- | ------------------------------- | -------------------------- | ----- |
| simple <-> multi-pane              | preserved                       | remounted                  | none  |
| multi-pane horizontal <-> vertical | preserved                       | preserved by `key="sheet"` | none  |
| BottomSheet expand/collapse        | preserved                       | internal state             | none  |
| ResizableHandle drag               | preserved and follows slot bbox | size only                  | none  |

### Related files

| File                                         | Role                                    |
| -------------------------------------------- | --------------------------------------- |
| `src/types/app/viewport.ts`                  | neutral `Viewport` type                 |
| `src/utils/layout-mode.ts`                   | layout mode type, threshold, resolver   |
| `src/utils/multi-pane.ts`                    | multi-pane orientation and panel sizing |
| `src/hooks/use-viewport.ts`                  | viewport resize subscription            |
| `src/hooks/use-layout-mode.ts`               | layout mode hook wiring                 |
| `src/hooks/use-multi-pane-orientation.ts`    | orientation hook wiring                 |
| `src/hooks/use-element-rect.ts`              | ResizeObserver bbox tracker             |
| `src/hooks/use-map-slot.ts`                  | map slot context accessors              |
| `src/contexts/map-slot-context.tsx`          | map slot context                        |
| `src/contexts/map-slot-provider.tsx`         | map slot state holder                   |
| `src/components/map/map-view-container.tsx`  | hoisted MapView positioning             |
| `src/components/map/map-overlay.tsx`         | map chrome overlay                      |
| `src/components/app-layout.tsx`              | layout selector                         |
| `src/components/map-bottom-sheet-layout.tsx` | simple mode overlay                     |
| `src/components/multi-pane-layout.tsx`       | multi-pane overlay                      |

## z-index hierarchy

Leaflet custom panes and app chrome use reserved z-index ranges. Decide which stacking context a value belongs to before assigning it.

### Reserved ranges

- `100-999`: global map layer, including MapView / Leaflet panes / map overlays
- `1000-1999`: global app chrome, including BottomSheet, StopPanel, floating controls, dropdowns
- `2000-2999`: global dialogs / modals
- `0-99`: local layer guide inside a surface only

### Current main assignments

| z-index | Purpose                                                |
| ------- | ------------------------------------------------------ |
| 200     | `tilePane` base map tiles                              |
| 340     | `routeShapeOutlinePane` selected route outline         |
| 350     | `routeShapePane` route fill                            |
| 400     | `overlayPane` stop markers                             |
| 500     | EdgeMarkerOverlay                                      |
| 600     | `shadowPane` marker shadows                            |
| 700     | `markerPane` markers                                   |
| 1000    | MapOverlayButton, BottomSheet, StopPanel, TimeControls |
| 1001    | SelectionIndicator, Portal / History dropdown trigger  |
| 1002    | Portal / History SelectContent                         |
| 2000    | modal dialogs                                          |

Outline pane must remain below fill pane. Separate panes avoid same-pane mount-order dependence from Leaflet polyline insertion.

### Component-local z-index

- `z-0` / `z-10` are fine inside a local stacking context.
- Do not add z-index only for decoration.
- `ScrollFadeEdge` and `ScrollToTopButton` are local overlays; scroll-container `z-10` does not mean global layer 10.
- Shared primitives such as `Select` / `Popover` should not own app-specific global z-index. Callers should override when they need app chrome layering.

### MapOverlay corner-panel group

The corner panels (`MapControlPanel`, `MapNavigationPanel`, `MapLayerPanel`, `RenderingPanel`, `StopTypeFilterPanel`, `StopControlPanel`, `InfoPanel`) form one chrome group: a single `absolute inset-0 z-1000` wrapper inside `MapOverlay` that is deliberately a stacking context. Globally the group is one unit at 1000 (BottomSheet still covers it, dropdowns at 1001+ stay above); the panels' mutual overlap order is local (`0-99` range).

On viewports shorter than the app's ~400px minimum design height the panels overlap by design; the local order decides which control stays usable. Panels stay on their assigned side (left / right), so the order is per side:

| local z | Panels                       | Rationale                                       |
| ------- | ---------------------------- | ----------------------------------------------- |
| 10      | `StopControlPanel` (left)    | stop search wins over `StopTypeFilterPanel`     |
| 10      | `MapNavigationPanel` (right) | locate / random-jump wins over `RenderingPanel` |
| auto    | every other panel            | DOM order; no deliberate priority assigned      |

### App shell wrappers

App shell wrappers must not create stacking contexts. App root, hoisted `MapView` wrapper, and multi-pane layout shell should provide positioning only.

Avoid `relative z-0` or `fixed inset-0 z-0` on shell wrappers. Those create new stacking contexts and make the reserved global ranges compose incorrectly. Use `position: relative` / `absolute` with `z-index: auto`.

This prohibition is for pass-through shells, which must let their children's global z-index (chrome 1000-1999, dialogs 2000+) compose at the root. A chrome group that deliberately closes over its children to localize their ordering (see the MapOverlay corner-panel group above) is the opposite pattern and is allowed, but it must be documented here.

## Map pan / zoom control

All programmatic panning goes through `smoothMoveTo()` in `src/lib/leaflet-helpers.ts`.

| Operation                | Method                  | Zoom           | Pan style          |
| ------------------------ | ----------------------- | -------------- | ------------------ |
| StopMarker click         | `selectStop()`          | preserved      | `PanToFocus`       |
| EdgeMarker click         | `selectStop()`          | preserved      | `PanToFocus`       |
| BottomSheet stop tap     | `selectStopById()`      | preserved      | `PanToFocus`       |
| Search result            | `focusStop()`           | preserved      | `PanToFocus`       |
| History selection        | `focusStop()`           | preserved      | `PanToFocus`       |
| SelectionIndicator click | direct `smoothMoveTo()` | preserved      | currently disabled |
| Locate button            | direct `smoothMoveTo()` | `LOCATE_ZOOM`  | direct             |
| Home button              | direct `smoothMoveTo()` | `INITIAL_ZOOM` | direct             |

No-pan operations: route-shape click selects only, map background click deselects, user pan clears stale focus.

### `smoothMoveTo`

`src/lib/leaflet-helpers.ts` chooses animation style by distance and zoom equality.

- distance < ~50m and zoom unchanged -> `map.setView()`
- otherwise -> `map.flyTo()`

### `PanToFocus`

`PanToFocus` in `src/components/map/map-view.tsx` watches `focusPosition` identity and calls `smoothMoveTo()` on changes.

`focusPosition` is resolved by `useSelection`:

1. `directFocusPosition` from search / history wins.
2. Otherwise find the selected stop in `radiusStops` then `inBoundStops`.
3. Otherwise return `null`.

Marker / BottomSheet selection uses stable lat/lng identity, so selecting the same coordinates does not repan. Search / history direct focus bypasses stabilization and can refocus the same stop.

## Click / tap event control

Leaflet default click behavior is overridden in several places. Changing one handler can affect the others.

### Event flow

```text
[touchstart] -> double-tap-detector: 2nd tap check
    ↓
[touchend] -> record 1st tap timestamp + position
    ↓ (300ms wait)
[click] -> capture phase delay -> redispatch unless a 2nd tap arrived
```

### Gestures

| Device | Gesture             | Behavior               | Implementation               |
| ------ | ------------------- | ---------------------- | ---------------------------- |
| touch  | tap                 | normal click           | Leaflet default              |
| touch  | double tap          | zoom in around tap     | `src/lib/double-tap-zoom.ts` |
| touch  | double tap + slide  | zoom by vertical slide | `src/lib/double-tap-zoom.ts` |
| touch  | pinch               | normal Leaflet zoom    | Leaflet default              |
| mouse  | click               | normal click           | Leaflet default              |
| mouse  | double click        | zoom in around click   | `src/lib/double-tap-zoom.ts` |
| mouse  | double click + drag | zoom by vertical drag  | `src/lib/double-tap-zoom.ts` |
| mouse  | wheel               | zoom                   | Leaflet default              |
| mouse  | drag                | pan                    | Leaflet default              |

Leaflet built-in doubleClickZoom is disabled by `enableDoubleTapZoom()` and replaced with custom mouse/touch detection.

### `doubleTapDrag` setting

| Value      | Drag up  | Drag down | Similar app |
| ---------- | -------- | --------- | ----------- |
| `zoom-out` | zoom out | zoom in   | Google Maps |
| `zoom-in`  | zoom in  | zoom out  | Apple Maps  |

### Click control mechanisms

| #   | Mechanism                  | File                                            | Event           | Phase   | Purpose                                       |
| --- | -------------------------- | ----------------------------------------------- | --------------- | ------- | --------------------------------------------- |
| 1   | click delay                | `src/lib/double-tap-detector.ts`                | `click`         | capture | delay first tap, cancel if second tap arrives |
| 2   | suppress click after pinch | `src/components/map/map-view.tsx`               | Leaflet `click` | -       | ignore clicks within 600ms after zoomend      |
| 3   | Edge Marker hit detection  | `src/components/marker/edge-markers-canvas.tsx` | `click`         | capture | detect canvas arrow hit and stop map click    |
| 4   | Stop Marker click          | `src/components/marker/stop-markers-canvas.tsx` | Leaflet `click` | -       | `bubblingMouseEvents: false`                  |
| 5   | Route Shape click          | `src/components/map/route-shape-polyline.tsx`   | Leaflet `click` | -       | `bubblingMouseEvents: false`                  |

### Constants

Constants live in `src/utils/map-click.ts`.

| Constant                | Value | Purpose                                 |
| ----------------------- | ----- | --------------------------------------- |
| `DOUBLE_TAP_WINDOW_MS`  | 300ms | allowed interval between taps           |
| `MAX_TAP_DRIFT_PX`      | 30px  | allowed drift between taps              |
| `PIXELS_PER_ZOOM_LEVEL` | 100px | slide distance to zoom-level conversion |
| `CLICK_SUPPRESSION_MS`  | 600ms | post-pinch click suppression window     |

### Leaflet overrides

| Setting           | Change                      | Reason                                | Restore timing     |
| ----------------- | --------------------------- | ------------------------------------- | ------------------ |
| `doubleClickZoom` | `disable()`                 | avoid conflict with custom double tap | cleanup `enable()` |
| `zoomSnap`        | `0` during slide, `1` after | smooth fractional zoom while sliding  | `touchend`         |
| `dragging`        | disabled while sliding      | avoid pan misdetection                | `touchend`         |

### Notes

- Every click is delayed by 300ms. If UI needs immediate touch response, use `touchend` or account for the capture-phase `allowNextClick` flag.
- `CLICK_SUPPRESSION_MS` depends on click delay. Update both if the delay changes.
- Multiple capture-phase listeners run in registration order. Be careful when changing listener registration.
