import { useEffect, useState } from 'react';

export interface Viewport {
  width: number;
  height: number;
}

function getViewport(): Viewport {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0 };
  }

  const vv = window.visualViewport;
  return {
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
  };
}

/**
 * Observe the effective viewport size for responsive layout decisions.
 *
 * Uses `visualViewport` when available so the value tracks mobile
 * Safari's URL-bar show / hide and pinch-zoom more closely than
 * `window.innerWidth` / `window.innerHeight`. Subscribes to
 * `visualViewport.scroll` too because mobile Safari fires it on URL-bar
 * transitions — a height-only signal not delivered via `resize`.
 *
 * Width and height share a single state / effect / listener set on
 * purpose: the viewport is one observable, and consumers that need only
 * width (e.g. layout-mode) accept the rare extra re-render from a
 * height-only change in exchange for the simpler primitive.
 *
 * @returns Current viewport width and height in CSS pixels.
 */
export function useViewport(): Viewport {
  const [viewport, setViewport] = useState(getViewport);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const update = () => {
      setViewport(getViewport());
    };

    update();

    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);

    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, []);

  return viewport;
}
