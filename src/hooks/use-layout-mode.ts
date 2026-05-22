import { useViewportWidth } from './use-viewport-width';
import { isWideViewport } from '../utils/map-bottom-sheet-layout-preset';

/**
 * Active app layout mode.
 *
 * - `'simple'` — small screens: one map surface with a bottom-sheet
 *   overlay (no real pane split). The existing layout.
 * - `'multi-pane'` — large screens: a multi-pane layout (map pane +
 *   stop panel pane) split by a resizable handle.
 */
export type LayoutMode = 'simple' | 'multi-pane';

/**
 * Resolve the active {@link LayoutMode} from the current viewport width.
 *
 * The mode is derived, not stored: it switches automatically at the
 * wide-viewport breakpoint. This hook is wiring only — the width-to-mode
 * threshold logic lives in {@link isWideViewport}.
 *
 * @returns `'multi-pane'` on wide viewports, `'simple'` otherwise.
 */
export function useLayoutMode(): LayoutMode {
  const viewportWidth = useViewportWidth();
  return isWideViewport(viewportWidth) ? 'multi-pane' : 'simple';
}
