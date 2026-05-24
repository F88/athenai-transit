import { useViewportWidth } from './use-viewport-width';
import { isWideViewport, type LayoutMode } from '../utils/layout-mode';

export type { LayoutMode };

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
