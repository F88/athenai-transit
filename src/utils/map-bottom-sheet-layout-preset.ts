export interface MapBottomSheetLayoutPreset {
  collapsedMapHeightClassName: string;
  expandedMapHeightClassName: string;
  collapsedSheetHeightClassName: string;
  expandedSheetHeightClassName: string;
}

const MEDIUM_VIEWPORT_MIN_HEIGHT = 800;
const TALL_VIEWPORT_MIN_HEIGHT = 1200;

/**
 * Minimum viewport width (CSS px) at which the multi-pane layout
 * (map + resizable stop panel) replaces the stacked map / bottom-sheet
 * layout. Targets PCs and tablets.
 */
export const WIDE_VIEWPORT_MIN_WIDTH = 1024;

/**
 * Split orientation of the multi-pane layout.
 *
 * - `'horizontal'` — panel on the left, map on the right (landscape).
 * - `'vertical'` — map on top, sheet panel on the bottom (portrait).
 */
export type MultiPaneOrientation = 'horizontal' | 'vertical';

/**
 * Default / min / max size of the sheet panel pane in the resizable
 * multi-pane split, keyed by split orientation. `horizontal` values
 * size the panel width (panel on the left); `vertical` values size its
 * height (panel on the bottom).
 */
export const MULTI_PANE_PANEL_SIZE: Record<
  MultiPaneOrientation,
  { defaultSize: string; minSize: string; maxSize: string }
> = {
  horizontal: { defaultSize: '50%', minSize: '25%', maxSize: '75%' },
  vertical: { defaultSize: '50%', minSize: '25%', maxSize: '75%' },
};

const REGULAR_LAYOUT_PRESET: MapBottomSheetLayoutPreset = {
  collapsedMapHeightClassName: 'h-[60dvh]',
  collapsedSheetHeightClassName: 'h-[40dvh]',
  expandedMapHeightClassName: 'h-[60dvh]',
  expandedSheetHeightClassName: 'h-[70dvh]',
};

const MEDIUM_LAYOUT_PRESET: MapBottomSheetLayoutPreset = {
  collapsedMapHeightClassName: 'h-[50dvh]',
  collapsedSheetHeightClassName: 'h-[50dvh]',
  expandedMapHeightClassName: 'h-[40dvh]',
  expandedSheetHeightClassName: 'h-[60dvh]',
};

const TALL_LAYOUT_PRESET: MapBottomSheetLayoutPreset = {
  collapsedMapHeightClassName: 'h-[40dvh]',
  collapsedSheetHeightClassName: 'h-[60dvh]',
  expandedMapHeightClassName: 'h-[30dvh]',
  expandedSheetHeightClassName: 'h-[70dvh]',
};

/**
 * Resolve map and bottom-sheet height classes from viewport height.
 *
 * The default layout keeps the map at 60dvh so map overlay controls remain
 * fully visible on most smartphones. Mid-height screens switch to 50dvh, and
 * very tall screens switch to 40dvh because they still preserve enough
 * absolute height for the same UI.
 *
 * @param viewportHeight - Effective viewport height in CSS pixels.
 * @returns Height class preset for the current screen size.
 */
export function resolveMapBottomSheetLayoutPreset(
  viewportHeight: number,
): MapBottomSheetLayoutPreset {
  if (viewportHeight >= TALL_VIEWPORT_MIN_HEIGHT) {
    return TALL_LAYOUT_PRESET;
  }

  if (viewportHeight >= MEDIUM_VIEWPORT_MIN_HEIGHT) {
    return MEDIUM_LAYOUT_PRESET;
  }

  return REGULAR_LAYOUT_PRESET;
}

/**
 * Decide whether the viewport is wide enough for the two-pane layout.
 *
 * @param viewportWidth - Effective viewport width in CSS pixels.
 * @returns `true` when the wide layout (full-height map + side panel)
 *   should be used instead of the stacked map / bottom-sheet layout.
 */
export function isWideViewport(viewportWidth: number): boolean {
  return viewportWidth >= WIDE_VIEWPORT_MIN_WIDTH;
}

/**
 * Decide the multi-pane split orientation from the viewport aspect.
 *
 * A landscape viewport splits left/right (`'horizontal'`); a portrait
 * viewport splits top/bottom (`'vertical'`) so the panes are not
 * cramped on a tall screen.
 *
 * @param viewportWidth - Effective viewport width in CSS pixels.
 * @param viewportHeight - Effective viewport height in CSS pixels.
 * @returns `'horizontal'` when the viewport is landscape (or square),
 *   `'vertical'` when it is portrait.
 */
export function resolveMultiPaneOrientation(
  viewportWidth: number,
  viewportHeight: number,
): MultiPaneOrientation {
  return viewportWidth >= viewportHeight ? 'horizontal' : 'vertical';
}
