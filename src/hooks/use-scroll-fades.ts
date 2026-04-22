import { useCallback, useEffect, useState, type RefObject } from 'react';

interface ScrollFadeState {
  showTop: boolean;
  showBottom: boolean;
}

interface UseScrollFadesResult extends ScrollFadeState {
  handleScroll: () => void;
}

/**
 * Tracks whether sticky top/bottom fade affordances should be visible for a scroll container.
 *
 * Observes both the container and its first child so content reflow updates the fade state,
 * including mobile browser viewport changes.
 *
 * @param ref Scroll container ref.
 * @param resetKey Key that forces a fade-state refresh when the rendered content changes.
 * @returns Current fade visibility and a scroll handler to attach to the container.
 */
export function useScrollFades(
  ref: RefObject<HTMLDivElement | null>,
  resetKey: string,
): UseScrollFadesResult {
  const [fadeState, setFadeState] = useState<ScrollFadeState>({
    showTop: false,
    showBottom: false,
  });

  const updateFadeState = useCallback(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const showTop = element.scrollTop > 1;
    const showBottom = element.scrollTop + element.clientHeight < element.scrollHeight - 1;

    setFadeState((prev) =>
      prev.showTop === showTop && prev.showBottom === showBottom ? prev : { showTop, showBottom },
    );
  }, [ref]);

  useEffect(() => {
    updateFadeState();

    const element = ref.current;
    if (!element) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      updateFadeState();
    });

    resizeObserver.observe(element);
    if (element.firstElementChild instanceof HTMLElement) {
      resizeObserver.observe(element.firstElementChild);
    }

    window.addEventListener('resize', updateFadeState);
    const frameId = requestAnimationFrame(updateFadeState);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', updateFadeState);
      resizeObserver.disconnect();
    };
  }, [ref, resetKey, updateFadeState]);

  return {
    handleScroll: updateFadeState,
    showTop: fadeState.showTop,
    showBottom: fadeState.showBottom,
  };
}
