import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { makeRepo } from '../../__tests__/helpers';
import type { RouteShape } from '../../types/app/map';
import { useRouteShapes } from '../use-route-shapes';

const SHAPE_A: RouteShape = {
  routeId: 'route-a',
  routeType: 3,
  color: '#000000',
  route: null,
  points: [
    [35.65, 139.75],
    [35.66, 139.76],
  ],
};

const SHAPE_B: RouteShape = {
  routeId: 'route-b',
  routeType: 1,
  color: '#FF0000',
  route: null,
  points: [
    [35.45, 139.55],
    [35.46, 139.56],
  ],
};

describe('useRouteShapes', () => {
  it('returns an empty array before the fetch resolves', async () => {
    const repo = makeRepo();
    const { result } = renderHook(() => useRouteShapes(repo));

    expect(result.current).toEqual([]);

    // Flush the pending mount effect so the deferred state update
    // happens inside act() and does not leak to the next test.
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('returns the loaded shapes after the repo resolves successfully', async () => {
    const repo = makeRepo({
      getRouteShapes: vi.fn().mockResolvedValue({
        success: true,
        data: [SHAPE_A, SHAPE_B],
        truncated: false,
      }),
    });
    const { result } = renderHook(() => useRouteShapes(repo));

    await waitFor(() => {
      expect(result.current).toHaveLength(2);
    });
    expect(result.current).toEqual([SHAPE_A, SHAPE_B]);
  });

  it('keeps the empty fallback when the repo returns failure', async () => {
    const repo = makeRepo({
      getRouteShapes: vi.fn().mockResolvedValue({
        success: false,
        error: new Error('boom'),
      }),
    });
    const { result } = renderHook(() => useRouteShapes(repo));

    // Flush microtasks so the failure path settles inside act().
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toEqual([]);
  });

  it('calls repo.getRouteShapes exactly once per repo instance', async () => {
    const getRouteShapes = vi.fn().mockResolvedValue({
      success: true,
      data: [SHAPE_A],
      truncated: false,
    });
    const repo = makeRepo({ getRouteShapes });
    const { rerender, result } = renderHook(() => useRouteShapes(repo));

    await waitFor(() => {
      expect(result.current).toHaveLength(1);
    });
    expect(getRouteShapes).toHaveBeenCalledTimes(1);

    rerender();
    rerender();

    expect(getRouteShapes).toHaveBeenCalledTimes(1);
  });

  it('re-fetches when the repo identity changes', async () => {
    const getRouteShapesA = vi.fn().mockResolvedValue({
      success: true,
      data: [SHAPE_A],
      truncated: false,
    });
    const getRouteShapesB = vi.fn().mockResolvedValue({
      success: true,
      data: [SHAPE_B],
      truncated: false,
    });
    const repoA = makeRepo({ getRouteShapes: getRouteShapesA });
    const repoB = makeRepo({ getRouteShapes: getRouteShapesB });

    const { rerender, result } = renderHook(({ repo }) => useRouteShapes(repo), {
      initialProps: { repo: repoA },
    });
    await waitFor(() => {
      expect(result.current).toEqual([SHAPE_A]);
    });

    rerender({ repo: repoB });
    await waitFor(() => {
      expect(result.current).toEqual([SHAPE_B]);
    });
    expect(getRouteShapesA).toHaveBeenCalledTimes(1);
    expect(getRouteShapesB).toHaveBeenCalledTimes(1);
  });
});
