import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PERF_PROFILES } from '../../config/perf-profiles';
import type { Bounds, LatLng } from '../../types/app/map';
import { makeRepo, makeStopMeta } from '../../__tests__/helpers';
import { useStopsForBounds } from '../use-stops-for-bounds';

const TEST_DEBOUNCE_MS = 50;

const BOUNDS_A: Bounds = {
  north: 35.7,
  south: 35.6,
  east: 139.8,
  west: 139.7,
};
const CENTER_A: LatLng = { lat: 35.65, lng: 139.75 };

const BOUNDS_B: Bounds = {
  north: 35.5,
  south: 35.4,
  east: 139.6,
  west: 139.5,
};
const CENTER_B: LatLng = { lat: 35.45, lng: 139.55 };

describe('useStopsForBounds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with empty stops, null mapCenter, and hasNearbyLoaded=false', () => {
    const repo = makeRepo();
    const { result } = renderHook(() =>
      useStopsForBounds({
        repo,
        perfProfile: PERF_PROFILES.lite,
        debounceMs: TEST_DEBOUNCE_MS,
      }),
    );

    expect(result.current.inBoundStops).toEqual([]);
    expect(result.current.radiusStops).toEqual([]);
    expect(result.current.mapCenter).toBeNull();
    expect(result.current.hasNearbyLoaded).toBe(false);
  });

  it('updates mapCenter immediately without waiting for the debounce', () => {
    const repo = makeRepo();
    const { result } = renderHook(() =>
      useStopsForBounds({
        repo,
        perfProfile: PERF_PROFILES.lite,
        debounceMs: TEST_DEBOUNCE_MS,
      }),
    );

    act(() => {
      result.current.handleBoundsChanged(BOUNDS_A, CENTER_A);
    });

    // No timers advanced, debounce has not elapsed — but mapCenter is set.
    expect(result.current.mapCenter).toEqual(CENTER_A);
    expect(result.current.hasNearbyLoaded).toBe(false);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repo.getStopsInBounds).not.toHaveBeenCalled();
  });

  it('commits stops and fires onStopsCommitted after the debounced fetch succeeds', async () => {
    const stopA = makeStopMeta('inbound-a');
    const stopB = makeStopMeta('nearby-b');
    const repo = makeRepo({
      getStopsInBounds: vi.fn().mockResolvedValue({
        success: true,
        data: [stopA],
        truncated: false,
      }),
      getStopsNearby: vi.fn().mockResolvedValue({
        success: true,
        data: [stopB],
        truncated: false,
      }),
    });
    const onStopsCommitted = vi.fn();

    const { result } = renderHook(() =>
      useStopsForBounds({
        repo,
        perfProfile: PERF_PROFILES.lite,
        onStopsCommitted,
        debounceMs: TEST_DEBOUNCE_MS,
      }),
    );

    act(() => {
      result.current.handleBoundsChanged(BOUNDS_A, CENTER_A);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TEST_DEBOUNCE_MS);
    });

    expect(result.current.hasNearbyLoaded).toBe(true);
    expect(result.current.inBoundStops).toEqual([stopA]);
    expect(result.current.radiusStops).toEqual([stopB]);
    expect(onStopsCommitted).toHaveBeenCalledTimes(1);
  });

  it('drops stale responses so a slow old fetch cannot overwrite a fresh result', async () => {
    const oldStop = makeStopMeta('old-stop');
    const newStop = makeStopMeta('new-stop');

    // Old request: stays pending until we resolve it manually.
    let resolveOldInBounds!: () => void;
    let resolveOldNearby!: () => void;
    const oldInBoundsPromise = new Promise<{
      success: true;
      data: (typeof oldStop)[];
      truncated: false;
    }>((resolve) => {
      resolveOldInBounds = () => {
        resolve({ success: true, data: [oldStop], truncated: false });
      };
    });
    const oldNearbyPromise = new Promise<{
      success: true;
      data: (typeof oldStop)[];
      truncated: false;
    }>((resolve) => {
      resolveOldNearby = () => {
        resolve({ success: true, data: [oldStop], truncated: false });
      };
    });

    const getStopsInBounds = vi
      .fn()
      .mockReturnValueOnce(oldInBoundsPromise)
      .mockResolvedValue({ success: true, data: [newStop], truncated: false });
    const getStopsNearby = vi
      .fn()
      .mockReturnValueOnce(oldNearbyPromise)
      .mockResolvedValue({ success: true, data: [newStop], truncated: false });

    const repo = makeRepo({ getStopsInBounds, getStopsNearby });
    const onStopsCommitted = vi.fn();

    const { result } = renderHook(() =>
      useStopsForBounds({
        repo,
        perfProfile: PERF_PROFILES.lite,
        onStopsCommitted,
        debounceMs: TEST_DEBOUNCE_MS,
      }),
    );

    // First bounds change -> debounce -> issue OLD request (pending).
    act(() => {
      result.current.handleBoundsChanged(BOUNDS_A, CENTER_A);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TEST_DEBOUNCE_MS);
    });

    // Second bounds change -> debounce -> issue NEW request (resolves immediately).
    act(() => {
      result.current.handleBoundsChanged(BOUNDS_B, CENTER_B);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TEST_DEBOUNCE_MS);
    });

    expect(result.current.hasNearbyLoaded).toBe(true);
    expect(result.current.inBoundStops).toEqual([newStop]);
    expect(result.current.radiusStops).toEqual([newStop]);
    expect(onStopsCommitted).toHaveBeenCalledTimes(1);

    // Now resolve the OLD request last. Stale-response guard must drop it.
    await act(async () => {
      resolveOldInBounds();
      resolveOldNearby();
      // Flush microtasks so the `.then` callback runs.
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.inBoundStops).toEqual([newStop]);
    expect(result.current.radiusStops).toEqual([newStop]);
    expect(onStopsCommitted).toHaveBeenCalledTimes(1);
  });

  it('falls back to empty arrays when the repo returns failed results', async () => {
    const repo = makeRepo({
      getStopsInBounds: vi.fn().mockResolvedValue({ success: false, error: 'boom-bounds' }),
      getStopsNearby: vi.fn().mockResolvedValue({ success: false, error: 'boom-nearby' }),
    });

    const { result } = renderHook(() =>
      useStopsForBounds({
        repo,
        perfProfile: PERF_PROFILES.lite,
        debounceMs: TEST_DEBOUNCE_MS,
      }),
    );

    act(() => {
      result.current.handleBoundsChanged(BOUNDS_A, CENTER_A);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TEST_DEBOUNCE_MS);
    });

    expect(result.current.hasNearbyLoaded).toBe(true);
    expect(result.current.inBoundStops).toEqual([]);
    expect(result.current.radiusStops).toEqual([]);
  });

  it('passes nearbyRadius and maxResults from the active perfProfile to the repo', async () => {
    const repo = makeRepo();

    const { result } = renderHook(() =>
      useStopsForBounds({
        repo,
        perfProfile: PERF_PROFILES.lite,
        debounceMs: TEST_DEBOUNCE_MS,
      }),
    );

    act(() => {
      result.current.handleBoundsChanged(BOUNDS_A, CENTER_A);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TEST_DEBOUNCE_MS);
    });

    const { nearbyRadius, maxResults } = PERF_PROFILES.lite.data.stops;
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repo.getStopsInBounds).toHaveBeenCalledWith(BOUNDS_A, maxResults);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repo.getStopsNearby).toHaveBeenCalledWith(CENTER_A, nearbyRadius, maxResults);
  });

  it('coalesces rapid bounds changes within the debounce window into a single fetch', async () => {
    const repo = makeRepo();

    const { result } = renderHook(() =>
      useStopsForBounds({
        repo,
        perfProfile: PERF_PROFILES.lite,
        debounceMs: TEST_DEBOUNCE_MS,
      }),
    );

    act(() => {
      result.current.handleBoundsChanged(BOUNDS_A, CENTER_A);
    });
    act(() => {
      // Within the debounce window: must reset the timer, not enqueue a 2nd fetch.
      result.current.handleBoundsChanged(BOUNDS_B, CENTER_B);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TEST_DEBOUNCE_MS);
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repo.getStopsInBounds).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repo.getStopsInBounds).toHaveBeenCalledWith(BOUNDS_B, expect.any(Number));
    // mapCenter follows the most recent bounds change, regardless of debounce.
    expect(result.current.mapCenter).toEqual(CENTER_B);
  });

  it('cancels the pending debounce on unmount so the fetch never fires', async () => {
    const repo = makeRepo();

    const { result, unmount } = renderHook(() =>
      useStopsForBounds({
        repo,
        perfProfile: PERF_PROFILES.lite,
        debounceMs: TEST_DEBOUNCE_MS,
      }),
    );

    act(() => {
      result.current.handleBoundsChanged(BOUNDS_A, CENTER_A);
    });

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TEST_DEBOUNCE_MS * 2);
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repo.getStopsInBounds).not.toHaveBeenCalled();
  });
});
