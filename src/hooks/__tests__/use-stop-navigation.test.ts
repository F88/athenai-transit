import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeRepo, makeStop, makeStopMeta } from '../../__tests__/helpers';
import { createStopReferenceSnapshot } from '../../domain/transit/stop-reference-snapshot';
import type { AppRouteTypeValue } from '../../types/app/transit';
import { useStopNavigation, type UseStopNavigationParams } from '../use-stop-navigation';

function makeParams(overrides: Partial<UseStopNavigationParams> = {}): UseStopNavigationParams {
  return {
    repo: makeRepo(),
    dataLang: [],
    routeTypeMap: new Map<string, AppRouteTypeValue[]>(),
    radiusStops: [],
    inBoundStops: [],
    disableAutoLocate: vi.fn(),
    selectStopById: vi.fn(),
    focusStop: vi.fn(),
    recordStopSelection: vi.fn(),
    ...overrides,
  };
}

describe('useStopNavigation', () => {
  it('stores resolved display strings when dataLang prefers translated names', () => {
    const stopMeta = makeStopMeta('A');
    stopMeta.stop.stop_name = '駅A';
    stopMeta.stop.stop_names = { en: 'Station A' };
    stopMeta.stop.agency_id = 'agency-1';
    stopMeta.agencies = [
      {
        agency_id: 'agency-1',
        agency_name: 'Agency Original',
        agency_long_name: 'Agency Long',
        agency_short_name: '事業者A',
        agency_names: { en: 'Agency Original' },
        agency_long_names: { en: 'Agency Long' },
        agency_short_names: { en: 'Agency A' },
        agency_url: 'https://example.com',
        agency_lang: 'ja',
        agency_timezone: 'Asia/Tokyo',
        agency_fare_url: '',
        agency_colors: [],
      },
    ];
    const recordStopSelection = vi.fn();
    const { result } = renderHook(() =>
      useStopNavigation(
        makeParams({
          dataLang: ['en'],
          radiusStops: [stopMeta],
          recordStopSelection,
        }),
      ),
    );

    act(() => {
      result.current.selectStopWithFallback('A', 'select-bottom-sheet');
    });

    expect(recordStopSelection).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Station A',
        agencyNames: ['Agency A'],
      }),
    );
  });

  it('selectStopWithFallback disables auto-locate, selects the stop, and pushes resolved meta', () => {
    const stop = makeStop('A');
    const stopMeta = makeStopMeta(stop);
    const disableAutoLocate = vi.fn();
    const selectStopById = vi.fn();
    const recordStopSelection = vi.fn();
    const routeTypeMap = new Map<string, AppRouteTypeValue[]>([['A', [3]]]);
    const { result } = renderHook(() =>
      useStopNavigation(
        makeParams({
          routeTypeMap,
          radiusStops: [stopMeta],
          disableAutoLocate,
          selectStopById,
          recordStopSelection,
        }),
      ),
    );

    act(() => {
      result.current.selectStopWithFallback('A', 'select-bottom-sheet');
    });

    expect(disableAutoLocate).toHaveBeenCalledWith('select-bottom-sheet');
    expect(selectStopById).toHaveBeenCalledWith('A', undefined);
    expect(recordStopSelection).toHaveBeenCalledWith(createStopReferenceSnapshot(stop, [3]));
  });

  it('selectStopWithFallback uses fallback stop when visible meta is missing', () => {
    const stop = makeStop('A');
    const disableAutoLocate = vi.fn();
    const selectStopById = vi.fn();
    const recordStopSelection = vi.fn();
    const routeTypeMap = new Map<string, AppRouteTypeValue[]>([['A', [1]]]);
    const { result } = renderHook(() =>
      useStopNavigation(
        makeParams({
          routeTypeMap,
          disableAutoLocate,
          selectStopById,
          recordStopSelection,
        }),
      ),
    );

    act(() => {
      result.current.selectStopWithFallback('A', 'select-marker', stop);
    });

    expect(selectStopById).toHaveBeenCalledWith('A', stop);
    expect(recordStopSelection).toHaveBeenCalledWith(createStopReferenceSnapshot(stop, [1]));
  });

  it('navigateAndFocusStop disables auto-locate, focuses the stop, and pushes history', () => {
    const stop = makeStop('A');
    const disableAutoLocate = vi.fn();
    const focusStop = vi.fn();
    const recordStopSelection = vi.fn();
    const selection = createStopReferenceSnapshot(makeStopMeta(stop), [11]);
    const { result } = renderHook(() =>
      useStopNavigation(
        makeParams({
          disableAutoLocate,
          focusStop,
          recordStopSelection,
        }),
      ),
    );

    act(() => {
      result.current.navigateAndFocusStop('select-history', stop, selection);
    });

    expect(disableAutoLocate).toHaveBeenCalledWith('select-history');
    expect(focusStop).toHaveBeenCalledWith(stop);
    expect(recordStopSelection).toHaveBeenCalledWith(selection);
  });

  it('navigateAndFocusStop records the provided selection snapshot', () => {
    const stop = makeStop('A');
    const disableAutoLocate = vi.fn();
    const focusStop = vi.fn();
    const recordStopSelection = vi.fn();
    const selection = createStopReferenceSnapshot(stop, [3]);
    const { result } = renderHook(() =>
      useStopNavigation(
        makeParams({
          disableAutoLocate,
          focusStop,
          recordStopSelection,
        }),
      ),
    );

    act(() => {
      result.current.navigateAndFocusStop('select-history', stop, selection);
    });

    expect(disableAutoLocate).toHaveBeenCalledWith('select-history');
    expect(focusStop).toHaveBeenCalledWith(stop);
    expect(recordStopSelection).toHaveBeenCalledWith(selection);
  });

  it('navigateAndFocusStopById resolves stop meta and navigates on success', async () => {
    const stopMeta = makeStopMeta('A');
    const getStopMetaById = vi.fn().mockResolvedValue({ success: true, data: stopMeta });
    const repo = makeRepo({
      getStopMetaById,
    });
    const disableAutoLocate = vi.fn();
    const focusStop = vi.fn();
    const recordStopSelection = vi.fn();
    const { result } = renderHook(() =>
      useStopNavigation(
        makeParams({
          repo,
          disableAutoLocate,
          focusStop,
          recordStopSelection,
        }),
      ),
    );

    const resolved = await result.current.navigateAndFocusStopById('A', 'apply-stop-param');

    expect(getStopMetaById).toHaveBeenCalledWith('A');
    expect(resolved).toEqual({ success: true, data: stopMeta });
    expect(disableAutoLocate).toHaveBeenCalledWith('apply-stop-param');
    expect(focusStop).toHaveBeenCalledWith(stopMeta.stop);
    expect(recordStopSelection).toHaveBeenCalledWith(createStopReferenceSnapshot(stopMeta, [-1]));
  });

  it('navigateAndFocusStopById returns failure without navigating when lookup fails', async () => {
    const getStopMetaById = vi.fn().mockResolvedValue({ success: false, error: 'Not found' });
    const repo = makeRepo({
      getStopMetaById,
    });
    const disableAutoLocate = vi.fn();
    const focusStop = vi.fn();
    const recordStopSelection = vi.fn();
    const { result } = renderHook(() =>
      useStopNavigation(
        makeParams({
          repo,
          disableAutoLocate,
          focusStop,
          recordStopSelection,
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
    expect(recordStopSelection).not.toHaveBeenCalled();
  });
});
