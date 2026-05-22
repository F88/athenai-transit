import { useEffect, useState } from 'react';

function getViewportWidth(): number {
  if (typeof window === 'undefined') {
    return 0;
  }

  return window.visualViewport?.width ?? window.innerWidth;
}

/**
 * Observe the effective viewport width for responsive layout decisions.
 *
 * Mirrors {@link useViewportHeight}. Used to switch between the stacked
 * map / bottom-sheet layout and the wide two-pane layout. Unlike the
 * height hook, no `scroll` listener is needed because width does not
 * change while the page scrolls.
 *
 * @returns Current viewport width in CSS pixels.
 */
export function useViewportWidth(): number {
  const [viewportWidth, setViewportWidth] = useState(() => getViewportWidth());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const updateViewportWidth = () => {
      setViewportWidth(getViewportWidth());
    };

    updateViewportWidth();

    window.addEventListener('resize', updateViewportWidth);
    window.visualViewport?.addEventListener('resize', updateViewportWidth);

    return () => {
      window.removeEventListener('resize', updateViewportWidth);
      window.visualViewport?.removeEventListener('resize', updateViewportWidth);
    };
  }, []);

  return viewportWidth;
}
