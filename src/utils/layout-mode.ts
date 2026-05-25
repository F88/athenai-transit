import type { Viewport } from '../types/app/viewport';

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
export const WIDE_VIEWPORT_MIN_WIDTH = 800;

/**
 * Resolve the {@link LayoutMode} the App should render for the given
 * viewport.
 *
 * Pure decision function — returns `'multi-pane'` when the viewport
 * is wide enough to fit the full-height map + side stop panel split,
 * otherwise `'simple'` (stacked map / bottom-sheet). Pairs with
 * `useLayoutMode`, which only wires this resolver to the live viewport.
 *
 * Takes the whole `Viewport` object (not just width) so future
 * decision logic that needs the height / aspect ratio can be added
 * without changing the signature or its callers.
 *
 * @param viewport - Effective viewport dimensions in CSS pixels.
 * @returns The layout mode to render.
 */
export function resolveLayoutMode(viewport: Viewport): LayoutMode {
  return viewport.width >= WIDE_VIEWPORT_MIN_WIDTH ? 'multi-pane' : 'simple';
}
