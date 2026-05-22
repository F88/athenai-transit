import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeStop, makeStopMeta } from '../../__tests__/helpers';
import { useStopNavigation, type UseStopNavigationParams } from '../use-stop-navigation';

function makeParams(overrides: Partial<UseStopNavigationParams> = {}): UseStopNavigationParams {
  return {
    radiusStops: [],
    inBoundStops: [],
    disableAutoLocate: vi.fn(),
    selectStopById: vi.fn(),
    focusStop: vi.fn(),
    ...overrides,
  };
}

describe('useStopNavigation', () => {
  it('selectStop does not record translated snapshot data directly', () => {
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
    const { result } = renderHook(() =>
      useStopNavigation(
        makeParams({
          radiusStops: [stopMeta],
        }),
      ),
    );

    act(() => {
      result.current.selectStop({ stopId: 'A', reason: 'select-bottom-sheet' });
    });
  });

  it('selectStop disables auto-locate and selects the stop', () => {
    const stop = makeStop('A');
    const stopMeta = makeStopMeta(stop);
    const disableAutoLocate = vi.fn();
    const selectStopById = vi.fn();
    const { result } = renderHook(() =>
      useStopNavigation(
        makeParams({
          radiusStops: [stopMeta],
          disableAutoLocate,
          selectStopById,
        }),
      ),
    );

    act(() => {
      result.current.selectStop({ stopId: 'A', reason: 'select-bottom-sheet' });
    });

    expect(disableAutoLocate).toHaveBeenCalledWith('select-bottom-sheet');
    expect(selectStopById).toHaveBeenCalledWith('A', undefined);
  });

  it('selectStop uses fallback stop when visible meta is missing', () => {
    const stop = makeStop('A');
    const disableAutoLocate = vi.fn();
    const selectStopById = vi.fn();
    const { result } = renderHook(() =>
      useStopNavigation(
        makeParams({
          disableAutoLocate,
          selectStopById,
        }),
      ),
    );

    act(() => {
      result.current.selectStop({ stopId: 'A', reason: 'select-marker', fallbackStop: stop });
    });

    expect(selectStopById).toHaveBeenCalledWith('A', stop);
  });

  it('navigateAndFocusStop disables auto-locate and focuses the stop', () => {
    const stop = makeStop('A');
    const disableAutoLocate = vi.fn();
    const focusStop = vi.fn();
    const { result } = renderHook(() =>
      useStopNavigation(
        makeParams({
          disableAutoLocate,
          focusStop,
        }),
      ),
    );

    act(() => {
      result.current.navigateAndFocusStop('select-history', stop);
    });

    expect(disableAutoLocate).toHaveBeenCalledWith('select-history');
    expect(focusStop).toHaveBeenCalledWith(stop);
  });

  it('navigateAndFocusStop does not record history directly', () => {
    const stop = makeStop('A');
    const disableAutoLocate = vi.fn();
    const focusStop = vi.fn();
    const { result } = renderHook(() =>
      useStopNavigation(
        makeParams({
          disableAutoLocate,
          focusStop,
        }),
      ),
    );

    act(() => {
      result.current.navigateAndFocusStop('select-history', stop);
    });

    expect(disableAutoLocate).toHaveBeenCalledWith('select-history');
    expect(focusStop).toHaveBeenCalledWith(stop);
  });
});
