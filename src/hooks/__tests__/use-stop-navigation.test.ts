import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeStop } from '../../__tests__/helpers';
import { useStopNavigation, type UseStopNavigationParams } from '../use-stop-navigation';

function makeParams(overrides: Partial<UseStopNavigationParams> = {}): UseStopNavigationParams {
  return {
    disableAutoLocate: vi.fn(),
    selectStopById: vi.fn(),
    focusStop: vi.fn(),
    ...overrides,
  };
}

describe('useStopNavigation', () => {
  it('selectStop does not record translated snapshot data directly', () => {
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
      result.current.selectStop({ stopId: 'A', reason: 'select-bottom-sheet' });
    });

    expect(disableAutoLocate).toHaveBeenCalledWith('select-bottom-sheet');
    expect(selectStopById).toHaveBeenCalledWith('A', undefined);
  });

  it('selectStop disables auto-locate and selects the stop', () => {
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
