import { useCallback, useEffect, useState, type RefObject } from 'react';

/** The two observed flags (pure state held in useState). */
interface ScrollOverflowFlags {
  hasContentAbove: boolean;
  hasContentBelow: boolean;
}

/** What consumers receive: the flags plus the updater that keeps them fresh. */
interface ScrollOverflow extends ScrollOverflowFlags {
  /** Re-reads the container's scroll metrics and recomputes the flags. Attach to the container's `onScroll` (or call directly after a programmatic change). */
  update: () => void;
}

/**
 * Observes a scroll container and reports whether content overflows (is
 * hidden) beyond its top or bottom edge.
 *
 * Observes both the container and its first child so content reflow updates
 * the flags, including mobile browser viewport changes. Consumers use the
 * flags to gate edge affordances such as `ScrollFadeEdge` or
 * `ScrollToTopButton`.
 *
 * @param ref Scroll container ref.
 * @param resetKey Key that forces a flags refresh when the rendered content changes.
 * @returns Current overflow flags and an `update` callback to attach to the container's `onScroll`.
 */
export function useScrollOverflow(
  ref: RefObject<HTMLDivElement | null>,
  resetKey: string,
): ScrollOverflow {
  const [overflowFlags, setOverflowFlags] = useState<ScrollOverflowFlags>({
    hasContentAbove: false,
    hasContentBelow: false,
  });

  const updateOverflowFlags = useCallback(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const hasContentAbove = element.scrollTop > 1;
    const hasContentBelow = element.scrollTop + element.clientHeight < element.scrollHeight - 1;

    setOverflowFlags((prev) =>
      prev.hasContentAbove === hasContentAbove && prev.hasContentBelow === hasContentBelow
        ? prev
        : { hasContentAbove, hasContentBelow },
    );
  }, [ref]);

  useEffect(() => {
    updateOverflowFlags();

    const element = ref.current;
    if (!element) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      updateOverflowFlags();
    });

    resizeObserver.observe(element);
    if (element.firstElementChild instanceof HTMLElement) {
      resizeObserver.observe(element.firstElementChild);
    }

    window.addEventListener('resize', updateOverflowFlags);
    const frameId = requestAnimationFrame(updateOverflowFlags);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', updateOverflowFlags);
      resizeObserver.disconnect();
    };
  }, [ref, resetKey, updateOverflowFlags]);

  return {
    update: updateOverflowFlags,
    hasContentAbove: overflowFlags.hasContentAbove,
    hasContentBelow: overflowFlags.hasContentBelow,
  };
}
