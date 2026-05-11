import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeRepo, makeStop, makeStopMeta } from '../../__tests__/helpers';
import type { AppRouteTypeValue } from '../../types/app/transit';
import { useStopNavigation, type UseStopNavigationParams } from '../use-stop-navigation';

function makeParams(overrides: Partial<UseStopNavigationParams> = {}): UseStopNavigationParams {
  return {
    repo: makeRepo(),
    routeTypeMap: new Map<string, AppRouteTypeValue[]>(),
    radiusStops: [],
    inBoundStops: [],
    disableAutoLocate: vi.fn(),
    selectStopById: vi.fn(),
    focusStop: vi.fn(),
    pushStop: vi.fn(),
    ...overrides,
  };
}

describe('useStopNavigation', () => {
  it('selectStopWithFallback disables auto-locate, selects the stop, and pushes resolved meta', () => {
    const stop = makeStop('A');
    const stopMeta = makeStopMeta(stop);
    const disableAutoLocate = vi.fn();
    const selectStopById = vi.fn();
    const pushStop = vi.fn();
    const routeTypeMap = new Map<string, AppRouteTypeValue[]>([['A', [3]]]);
    const { result } = renderHook(() =>
      useStopNavigation(
        makeParams({
          routeTypeMap,
          radiusStops: [stopMeta],
          disableAutoLocate,
          selectStopById,
          pushStop,
        }),
      ),
    );

    act(() => {
      result.current.selectStopWithFallback('A', 'select-bottom-sheet');
    });

    expect(disableAutoLocate).toHaveBeenCalledWith('select-bottom-sheet');
    expect(selectStopById).toHaveBeenCalledWith('A', undefined);
    expect(pushStop).toHaveBeenCalledWith(stopMeta, [3]);
  });

  it('selectStopWithFallback uses fallback stop when visible meta is missing', () => {
    const stop = makeStop('A');
    const disableAutoLocate = vi.fn();
    const selectStopById = vi.fn();
    const pushStop = vi.fn();
    const routeTypeMap = new Map<string, AppRouteTypeValue[]>([['A', [1]]]);
    const { result } = renderHook(() =>
      useStopNavigation(
        makeParams({
          routeTypeMap,
          disableAutoLocate,
          selectStopById,
          pushStop,
        }),
      ),
    );

    act(() => {
      result.current.selectStopWithFallback('A', 'select-marker', stop);
    });

    expect(selectStopById).toHaveBeenCalledWith('A', stop);
    expect(pushStop).toHaveBeenCalledWith({ stop, agencies: [], routes: [] }, [1]);
  });

  it('navigateAndFocusStop disables auto-locate, focuses the stop, and pushes history', () => {
    const stop = makeStop('A');
    const stopMeta = makeStopMeta(stop);
    const disableAutoLocate = vi.fn();
    const focusStop = vi.fn();
    const pushStop = vi.fn();
    const routeTypes: AppRouteTypeValue[] = [11];
    const { result } = renderHook(() =>
      useStopNavigation(
        makeParams({
          radiusStops: [stopMeta],
          disableAutoLocate,
          focusStop,
          pushStop,
        }),
      ),
    );

    act(() => {
      result.current.navigateAndFocusStop(stop, 'select-history', routeTypes);
    });

    expect(disableAutoLocate).toHaveBeenCalledWith('select-history');
    expect(focusStop).toHaveBeenCalledWith(stop);
    expect(pushStop).toHaveBeenCalledWith(stopMeta, routeTypes);
  });

  it('navigateAndFocusStopById resolves stop meta and navigates on success', async () => {
    const stopMeta = makeStopMeta('A');
    const getStopMetaById = vi.fn().mockResolvedValue({ success: true, data: stopMeta });
    const repo = makeRepo({
      getStopMetaById,
    });
    const disableAutoLocate = vi.fn();
    const focusStop = vi.fn();
    const pushStop = vi.fn();
    const { result } = renderHook(() =>
      useStopNavigation(
        makeParams({
          repo,
          disableAutoLocate,
          focusStop,
          pushStop,
        }),
      ),
    );

    const resolved = await result.current.navigateAndFocusStopById('A', 'apply-stop-param');

    expect(getStopMetaById).toHaveBeenCalledWith('A');
    expect(resolved).toEqual({ success: true, data: stopMeta });
    expect(disableAutoLocate).toHaveBeenCalledWith('apply-stop-param');
    expect(focusStop).toHaveBeenCalledWith(stopMeta.stop);
    expect(pushStop).toHaveBeenCalledWith(stopMeta, [-1]);
  });

  it('navigateAndFocusStopById returns failure without navigating when lookup fails', async () => {
    const getStopMetaById = vi.fn().mockResolvedValue({ success: false, error: 'Not found' });
    const repo = makeRepo({
      getStopMetaById,
    });
    const disableAutoLocate = vi.fn();
    const focusStop = vi.fn();
    const pushStop = vi.fn();
    const { result } = renderHook(() =>
      useStopNavigation(
        makeParams({
          repo,
          disableAutoLocate,
          focusStop,
          pushStop,
        }),
      ),
    );

    const resolved = await result.current.navigateAndFocusStopById(
      'missing',
      'select-trip-inspection',
    );

    expect(resolved).toEqual({ success: false, error: 'Not found' });
    expect(disableAutoLocate).not.toHaveBeenCalled();
    expect(focusStop).not.toHaveBeenCalled();
    expect(pushStop).not.toHaveBeenCalled();
  });
});
