/**
 * Active app layout mode.
 *
 * - `'simple'` — small screens: one map surface with a bottom-sheet
 *   overlay (no real pane split).
 * - `'multi-pane'` — large screens: a multi-pane layout (map pane +
 *   stop panel pane) split by a resizable handle.
 */
export type LayoutMode = 'simple' | 'multi-pane';

/**
 * Minimum viewport width (CSS px) at which the layout switches from
 * `'simple'` to `'multi-pane'`. Targets PCs and tablets.
 */
export const WIDE_VIEWPORT_MIN_WIDTH = 1024;

/**
 * Decide whether the viewport is wide enough for the multi-pane layout.
 *
 * @param viewportWidth - Effective viewport width in CSS pixels.
 * @returns `true` when the multi-pane layout (full-height map + side
 *   panel) should be used instead of the stacked map / bottom-sheet
 *   layout.
 */
export function isWideViewport(viewportWidth: number): boolean {
  return viewportWidth >= WIDE_VIEWPORT_MIN_WIDTH;
}
