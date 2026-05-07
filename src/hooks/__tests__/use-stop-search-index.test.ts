import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { makeRepo, makeStop } from '../../__tests__/helpers';
import type { AppRouteTypeValue } from '../../types/app/transit';
import { useStopSearchIndex } from '../use-stop-search-index';

describe('useStopSearchIndex', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not call the repository while disabled', () => {
    const getAllStops = vi.fn().mockResolvedValue({ success: true, data: [], truncated: false });
    const repo = makeRepo({ getAllStops });

    renderHook(() => useStopSearchIndex(repo, false));

    expect(getAllStops).not.toHaveBeenCalled();
  });

  it('builds the search index and route-type map when enabled', async () => {
    const stopA = makeStop('stop-a');
    const stopB = makeStop('stop-b');
    const getAllStops = vi.fn().mockResolvedValue({
      success: true,
      data: [stopA, stopB],
      truncated: false,
    });
    const getRouteTypesForStop = vi.fn((stopId: string) =>
      Promise.resolve({
        success: true as const,
        data: (stopId === 'stop-a' ? [3] : [1]) as AppRouteTypeValue[],
      }),
    );
    const repo = makeRepo({ getAllStops, getRouteTypesForStop });

    const { result } = renderHook(() => useStopSearchIndex(repo, true));

    await waitFor(() => {
      expect(result.current.searchIndex).toHaveLength(2);
      expect(result.current.routeTypeMap.size).toBe(2);
    });

    expect(result.current.searchIndex.map((entry) => entry.stop.stop_id)).toEqual([
      'stop-a',
      'stop-b',
    ]);
    expect(result.current.routeTypeMap.get('stop-a')).toEqual([3]);
    expect(result.current.routeTypeMap.get('stop-b')).toEqual([1]);
  });

  it('falls back to [-1] when route types cannot be resolved', async () => {
    const stop = makeStop('stop-unknown');
    const repo = makeRepo({
      getAllStops: vi.fn().mockResolvedValue({ success: true, data: [stop], truncated: false }),
      getRouteTypesForStop: vi.fn().mockResolvedValue({ success: false, error: 'not found' }),
    });

    const { result } = renderHook(() => useStopSearchIndex(repo, true));

    await waitFor(() => {
      expect(result.current.routeTypeMap.size).toBe(1);
    });

    expect(result.current.routeTypeMap.get('stop-unknown')).toEqual([-1]);
  });

  it('does not rebuild when the dialog is reopened against the same repo', async () => {
    const stop = makeStop('stop-cached');
    const getAllStops = vi
      .fn()
      .mockResolvedValue({ success: true, data: [stop], truncated: false });
    const getRouteTypesForStop = vi.fn().mockResolvedValue({ success: true, data: [3] });
    const repo = makeRepo({ getAllStops, getRouteTypesForStop });

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useStopSearchIndex(repo, enabled),
      { initialProps: { enabled: true } },
    );

    await waitFor(() => {
      expect(result.current.routeTypeMap.size).toBe(1);
    });

    expect(getAllStops).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });
    rerender({ enabled: true });

    expect(getAllStops).toHaveBeenCalledTimes(1);
    expect(getRouteTypesForStop).toHaveBeenCalledTimes(1);
  });

  it('rebuilds when the repo identity changes', async () => {
    const stopA = makeStop('stop-a');
    const stopB = makeStop('stop-b');
    const repo1 = makeRepo({
      getAllStops: vi.fn().mockResolvedValue({ success: true, data: [stopA], truncated: false }),
      getRouteTypesForStop: vi.fn().mockResolvedValue({ success: true, data: [3] }),
    });
    const repo2 = makeRepo({
      getAllStops: vi.fn().mockResolvedValue({ success: true, data: [stopB], truncated: false }),
      getRouteTypesForStop: vi.fn().mockResolvedValue({ success: true, data: [1] }),
    });

    const { result, rerender } = renderHook(
      ({ repo }: { repo: typeof repo1 }) => useStopSearchIndex(repo, true),
      { initialProps: { repo: repo1 } },
    );

    await waitFor(() => {
      expect(result.current.routeTypeMap.get('stop-a')).toEqual([3]);
    });

    rerender({ repo: repo2 });

    await waitFor(() => {
      expect(result.current.routeTypeMap.get('stop-b')).toEqual([1]);
    });
    expect(result.current.routeTypeMap.has('stop-a')).toBe(false);
  });

  it('ignores results when unmounted before getAllStops resolves', async () => {
    let resolveGetAllStops!: (value: {
      success: true;
      data: ReturnType<typeof makeStop>[];
      truncated: false;
    }) => void;
    const getAllStops = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGetAllStops = resolve;
        }),
    );
    const getRouteTypesForStop = vi.fn();
    const repo = makeRepo({ getAllStops, getRouteTypesForStop });

    const { unmount } = renderHook(() => useStopSearchIndex(repo, true));

    unmount();
    resolveGetAllStops({ success: true, data: [makeStop('stop-late')], truncated: false });

    // Allow microtasks to run after the late resolution.
    await Promise.resolve();
    await Promise.resolve();

    expect(getRouteTypesForStop).not.toHaveBeenCalled();
  });

  it('logs and recovers when getAllStops rejects', async () => {
    const getAllStops = vi.fn().mockRejectedValue(new Error('network down'));
    const repo = makeRepo({ getAllStops });

    const { result } = renderHook(() => useStopSearchIndex(repo, true));

    await waitFor(() => {
      expect(getAllStops).toHaveBeenCalledTimes(1);
    });

    expect(result.current.searchIndex).toEqual([]);
    expect(result.current.routeTypeMap.size).toBe(0);
  });
});
