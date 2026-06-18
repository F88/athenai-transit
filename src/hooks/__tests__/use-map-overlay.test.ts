import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { HighlightedCircle } from '@/types/app/map';

import {
  useHighlightedCircles,
  useMapOverlayControls,
  useShowDistanceRings,
} from '../use-map-overlay';

/**
 * Render the read hooks + the controls together so a single result exposes the
 * current overlay state and the mutators.
 */
function renderStore() {
  return renderHook(() => ({
    circles: useHighlightedCircles(),
    showDistanceRings: useShowDistanceRings(),
    controls: useMapOverlayControls(),
  }));
}

const CIRCLE: HighlightedCircle = { center: { lat: 35, lng: 139 }, radius: 100, color: '#009688' };

// The store is module-global state, so reset it to defaults after each test
// to keep cases independent.
afterEach(() => {
  const { result, unmount } = renderHook(() => useMapOverlayControls());
  act(() => {
    result.current.clearHighlightedCircles();
    result.current.setShowDistanceRings(true);
  });
  unmount();
});

describe('useMapOverlay store', () => {
  it('defaults to no circles and distance rings shown', () => {
    const { result } = renderStore();
    expect(result.current.circles).toEqual([]);
    expect(result.current.showDistanceRings).toBe(true);
  });

  it('re-renders subscribers when highlighted circles are set', () => {
    const { result } = renderStore();
    act(() => {
      result.current.controls.setHighlightedCircles([CIRCLE]);
    });
    expect(result.current.circles).toEqual([CIRCLE]);
  });

  it('clears highlighted circles back to empty', () => {
    const { result } = renderStore();
    act(() => {
      result.current.controls.setHighlightedCircles([CIRCLE]);
    });
    act(() => {
      result.current.controls.clearHighlightedCircles();
    });
    expect(result.current.circles).toEqual([]);
  });

  it('toggles distance rings visibility', () => {
    const { result } = renderStore();
    act(() => {
      result.current.controls.setShowDistanceRings(false);
    });
    expect(result.current.showDistanceRings).toBe(false);
  });

  it('keeps the two slots independent', () => {
    const { result } = renderStore();
    act(() => {
      result.current.controls.setHighlightedCircles([CIRCLE]);
    });
    // Setting circles must not flip the rings flag.
    expect(result.current.showDistanceRings).toBe(true);

    act(() => {
      result.current.controls.setShowDistanceRings(false);
    });
    // Toggling rings must not drop the circles.
    expect(result.current.circles).toEqual([CIRCLE]);
  });

  it('returns a stable controls reference across renders', () => {
    const { result, rerender } = renderHook(() => useMapOverlayControls());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('stops notifying a subscriber after it unmounts', () => {
    const { result: stateResult, unmount } = renderHook(() => useHighlightedCircles());
    const { result: controlsResult } = renderHook(() => useMapOverlayControls());

    act(() => {
      controlsResult.current.setHighlightedCircles([CIRCLE]);
    });
    expect(stateResult.current).toEqual([CIRCLE]);

    unmount();
    // Updating after unmount must not throw (listener was removed on cleanup).
    expect(() => {
      act(() => {
        controlsResult.current.clearHighlightedCircles();
      });
    }).not.toThrow();
  });
});
