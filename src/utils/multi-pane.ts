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
