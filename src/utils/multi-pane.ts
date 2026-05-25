/**
 * Split orientation of the multi-pane layout.
 *
 * - `'horizontal'` — panel on the left, map on the right (landscape).
 * - `'vertical'` — map on top, sheet panel on the bottom (portrait).
 */
export type MultiPaneOrientation = 'horizontal' | 'vertical';

/**
 * Default / min / max size of the **map pane** in the resizable
 * multi-pane split, keyed by split orientation. `horizontal` values
 * size the map pane's width (map on the right); `vertical` values
 * size its height (map on top).
 *
 * The sheet pane (the opposite side) takes the remaining space and
 * carries no explicit size constraints — its effective range is the
 * inverse of the map pane's. Constraining the map pane (not the
 * sheet) is the project's primary intent because the map area has to
 * be tall / wide enough to host overlay chrome (TimeControls,
 * top-centre dropdowns, etc.) without those elements colliding.
 *
 * Sizes accept `'NN%'` or `'NNNpx'` per `react-resizable-panels` v4.
 */
export const MULTI_PANE_MAP_PANE_SIZE: Record<
  MultiPaneOrientation,
  { defaultSize: string; minSize: string; maxSize: string }
> = {
  vertical: { defaultSize: '50%', minSize: '400px', maxSize: '75%' },
  horizontal: { defaultSize: '50%', minSize: '400px', maxSize: '75%' },
};

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
