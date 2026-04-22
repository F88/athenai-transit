import { useEffect, useState } from 'react';

function getViewportHeight(): number {
  if (typeof window === 'undefined') {
    return 0;
  }

  return window.visualViewport?.height ?? window.innerHeight;
}

/**
 * Observe the effective viewport height for responsive mobile layout decisions.
 *
 * Uses `visualViewport.height` when available so the value tracks browser UI
 * chrome changes on mobile Safari more closely than `window.innerHeight`.
 *
 * @returns Current viewport height in CSS pixels.
 */
export function useViewportHeight(): number {
  const [viewportHeight, setViewportHeight] = useState(() => getViewportHeight());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const updateViewportHeight = () => {
      setViewportHeight(getViewportHeight());
    };

    updateViewportHeight();

    window.addEventListener('resize', updateViewportHeight);
    window.visualViewport?.addEventListener('resize', updateViewportHeight);
    window.visualViewport?.addEventListener('scroll', updateViewportHeight);

    return () => {
      window.removeEventListener('resize', updateViewportHeight);
      window.visualViewport?.removeEventListener('resize', updateViewportHeight);
      window.visualViewport?.removeEventListener('scroll', updateViewportHeight);
    };
  }, []);

  return viewportHeight;
}
