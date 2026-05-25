import { useViewport } from './use-viewport';
import { resolveLayoutMode, type LayoutMode } from '../utils/layout-mode';

/**
 * Resolve the active {@link LayoutMode} from the current viewport.
 *
 * The mode is derived, not stored: it switches automatically based on
 * the live viewport. This hook is wiring only — the multi-pane /
 * simple decision logic lives in {@link resolveLayoutMode}.
 *
 * @returns `'multi-pane'` when the viewport qualifies for multi-pane,
 *   `'simple'` otherwise.
 */
export function useLayoutMode(): LayoutMode {
  return resolveLayoutMode(useViewport());
}
