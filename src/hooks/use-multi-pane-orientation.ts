import { useViewportHeight } from './use-viewport-height';
import { useViewportWidth } from './use-viewport-width';
import { resolveMultiPaneOrientation, type MultiPaneOrientation } from '../utils/multi-pane';

/**
 * Resolve the multi-pane split orientation from the current viewport
 * aspect ratio.
 *
 * Fully derived: compares the live viewport width and height (landscape
 * -> `'horizontal'`, portrait -> `'vertical'`). This hook is wiring only
 * — the aspect logic lives in {@link resolveMultiPaneOrientation}.
 *
 * @returns The split orientation for the multi-pane layout.
 */
export function useMultiPaneOrientation(): MultiPaneOrientation {
  const viewportWidth = useViewportWidth();
  const viewportHeight = useViewportHeight();
  return resolveMultiPaneOrientation(viewportWidth, viewportHeight);
}
