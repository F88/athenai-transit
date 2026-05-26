import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useGlobalFilter } from '../use-global-filter';

// `getServiceDayMinutes` returns midnight-based local-time minutes
// when `getHours() >= 03:00` (the service-day boundary), and adds
// 1440 for pre-boundary times. The hook compares the result against
// `LATE_NIGHT_THRESHOLD_MINUTES = 22 * 60 = 1320`:
//
//   - Local-time 12:00 -> 12 * 60 = 720, below the threshold (daytime).
//   - Local-time 23:00 -> 23 * 60 = 1380, above the threshold (late
//     night).
//
// `new Date(year, month, day, hours, ...)` uses the runner's local
// timezone, and `getHours()` returns the same local hour, so this
// stays deterministic regardless of where the test runs.
const NOON_LOCAL = new Date(2026, 4, 26, 12, 0, 0);
const LATE_NIGHT_LOCAL = new Date(2026, 4, 26, 23, 0, 0);

describe('useGlobalFilter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with all three filter inputs off (daytime baseline)', () => {
    const { result } = renderHook(() => useGlobalFilter(NOON_LOCAL));

    expect(result.current.showOriginOnly).toBe(false);
    expect(result.current.showBoardableOnly).toBe(false);
    expect(result.current.effectiveOmitEmptyStops).toBe(false);
    expect(result.current.globalFilter).toMatchObject({
      showOriginOnly: false,
      showBoardableOnly: false,
      omitEmptyStops: false,
      isOmitEmptyStopsForced: false,
    });
  });

  it('auto-enables omitEmptyStops when dateTime is past the late-night threshold', () => {
    const { result } = renderHook(() => useGlobalFilter(LATE_NIGHT_LOCAL));

    expect(result.current.effectiveOmitEmptyStops).toBe(true);
    expect(result.current.globalFilter.omitEmptyStops).toBe(true);
    expect(result.current.globalFilter.isOmitEmptyStopsForced).toBe(false);
  });

  it('toggles showOriginOnly via onToggleShowOriginOnly and forces omitEmptyStops on', () => {
    const { result } = renderHook(() => useGlobalFilter(NOON_LOCAL));

    act(() => {
      result.current.globalFilter.onToggleShowOriginOnly();
    });

    expect(result.current.showOriginOnly).toBe(true);
    expect(result.current.effectiveOmitEmptyStops).toBe(true);
    expect(result.current.globalFilter.isOmitEmptyStopsForced).toBe(true);
  });

  it('toggles showBoardableOnly via onToggleShowBoardableOnly and forces omitEmptyStops on', () => {
    const { result } = renderHook(() => useGlobalFilter(NOON_LOCAL));

    act(() => {
      result.current.globalFilter.onToggleShowBoardableOnly();
    });

    expect(result.current.showBoardableOnly).toBe(true);
    expect(result.current.effectiveOmitEmptyStops).toBe(true);
    expect(result.current.globalFilter.isOmitEmptyStopsForced).toBe(true);
  });

  it('treats onToggleOmitEmptyStops as a no-op while forced', () => {
    const { result } = renderHook(() => useGlobalFilter(NOON_LOCAL));

    // Force on via showOriginOnly.
    act(() => {
      result.current.globalFilter.onToggleShowOriginOnly();
    });
    expect(result.current.effectiveOmitEmptyStops).toBe(true);
    expect(result.current.globalFilter.isOmitEmptyStopsForced).toBe(true);

    // Attempting to toggle while forced must not flip the underlying
    // override state.
    act(() => {
      result.current.globalFilter.onToggleOmitEmptyStops();
    });
    expect(result.current.effectiveOmitEmptyStops).toBe(true);
    expect(result.current.globalFilter.isOmitEmptyStopsForced).toBe(true);
  });

  it('allows manual override off via onToggleOmitEmptyStops at late night when not forced', () => {
    const { result } = renderHook(() => useGlobalFilter(LATE_NIGHT_LOCAL));

    expect(result.current.effectiveOmitEmptyStops).toBe(true);

    act(() => {
      result.current.globalFilter.onToggleOmitEmptyStops();
    });

    expect(result.current.effectiveOmitEmptyStops).toBe(false);
    expect(result.current.globalFilter.omitEmptyStops).toBe(false);
  });

  it('allows manual override on via onToggleOmitEmptyStops during daytime when not forced', () => {
    const { result } = renderHook(() => useGlobalFilter(NOON_LOCAL));

    expect(result.current.effectiveOmitEmptyStops).toBe(false);

    act(() => {
      result.current.globalFilter.onToggleOmitEmptyStops();
    });

    expect(result.current.effectiveOmitEmptyStops).toBe(true);
    expect(result.current.globalFilter.omitEmptyStops).toBe(true);
    expect(result.current.globalFilter.isOmitEmptyStopsForced).toBe(false);
  });

  it('returns a stable globalFilter reference across renders when no input changes', () => {
    const { result, rerender } = renderHook(({ dt }) => useGlobalFilter(dt), {
      initialProps: { dt: NOON_LOCAL },
    });
    const firstBundle = result.current.globalFilter;

    rerender({ dt: NOON_LOCAL });
    rerender({ dt: NOON_LOCAL });

    expect(result.current.globalFilter).toBe(firstBundle);
  });

  it('recomputes globalFilter when isLateNight flips because dateTime crosses the threshold', () => {
    const { result, rerender } = renderHook(({ dt }) => useGlobalFilter(dt), {
      initialProps: { dt: NOON_LOCAL },
    });
    expect(result.current.effectiveOmitEmptyStops).toBe(false);

    rerender({ dt: LATE_NIGHT_LOCAL });

    expect(result.current.effectiveOmitEmptyStops).toBe(true);
    expect(result.current.globalFilter.omitEmptyStops).toBe(true);
  });

  it('keeps manual override sticky as dateTime crosses the threshold', () => {
    const { result, rerender } = renderHook(({ dt }) => useGlobalFilter(dt), {
      initialProps: { dt: NOON_LOCAL },
    });

    // Manually override on during daytime.
    act(() => {
      result.current.globalFilter.onToggleOmitEmptyStops();
    });
    expect(result.current.effectiveOmitEmptyStops).toBe(true);

    // Crossing into late night does not undo the manual override.
    rerender({ dt: LATE_NIGHT_LOCAL });
    expect(result.current.effectiveOmitEmptyStops).toBe(true);

    // Toggling off works even at late night because forced is false.
    act(() => {
      result.current.globalFilter.onToggleOmitEmptyStops();
    });
    expect(result.current.effectiveOmitEmptyStops).toBe(false);
  });
});
