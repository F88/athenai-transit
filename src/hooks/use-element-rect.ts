import { useEffect, useState } from 'react';

interface ObservedRect {
  /** The element the rect was measured from. */
  element: HTMLElement | null;
  /** Viewport-relative bbox at last measurement. */
  rect: DOMRectReadOnly | null;
}

const EMPTY: ObservedRect = { element: null, rect: null };

/**
 * Observe an element's viewport-relative bounding rect via
 * `ResizeObserver`.
 *
 * Returns `null` when no element is given, or transiently while the
 * effect for a freshly-changed element has not re-synced yet. The
 * rect updates on every observed size change (e.g. multi-pane drag
 * handle moves a panel's size); the observer is cleaned up on
 * element change or unmount.
 *
 * Uses `getBoundingClientRect()` (viewport-relative) rather than
 * `ResizeObserverEntry.contentRect` (element-relative) so the
 * returned rect can be applied directly as `position: absolute`
 * coordinates against a viewport-anchored ancestor.
 */
export function useElementRect(element: HTMLElement | null): DOMRectReadOnly | null {
  const [observed, setObserved] = useState<ObservedRect>(EMPTY);

  useEffect(() => {
    if (!element) {
      return;
    }

    // Synchronous initial measurement avoids a one-frame visual flash
    // before `ResizeObserver`'s first asynchronous callback fires —
    // without it, the first paint after the tracked element changes
    // would render against a stale / null rect.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Bootstrap measurement of an external (DOM) source whose async observer would otherwise leave a one-frame gap.
    setObserved({ element, rect: element.getBoundingClientRect() });

    const observer = new ResizeObserver(() => {
      setObserved({ element, rect: element.getBoundingClientRect() });
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [element]);

  // Discard stale state from a previous element when it changes /
  // becomes null; the derivation returns `null` until the effect for
  // the new element has re-synced.
  return observed.element === element ? observed.rect : null;
}
