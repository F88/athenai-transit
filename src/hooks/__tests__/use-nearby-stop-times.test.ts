import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useNearbyDepartures } from '../use-nearby-stop-times';
import { makeStop, makeStopMeta, makeRepo } from '../../__tests__/helpers';
import { getServiceDay } from '../../domain/transit/service-day';

describe('useNearbyDepartures', () => {
  it('returns empty departures for empty stops', async () => {
    const repo = makeRepo();
    const now = new Date();
    const { result } = renderHook(() => useNearbyDepartures([], now, repo));

    await waitFor(() => {
      expect(result.current.isNearbyLoading).toBe(false);
    });

    expect(result.current.nearbyDepartures).toEqual([]);
  });

  it('fetches departures for each nearby stop', async () => {
    const stops = [makeStopMeta('A'), makeStopMeta('B')];
    const repo = makeRepo();
    const now = new Date();

    const { result } = renderHook(() => useNearbyDepartures(stops, now, repo));

    await waitFor(() => {
      expect(result.current.isNearbyLoading).toBe(false);
    });

    expect(result.current.nearbyDepartures).toHaveLength(2);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repo.getUpcomingTimetableEntries).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repo.getRouteTypesForStop).toHaveBeenCalledTimes(2);
  });

  it('sets isNearbyLoading to true while fetching', async () => {
    let resolvePromise: () => void;
    const pending = new Promise<void>((r) => {
      resolvePromise = r;
    });

    const repo = makeRepo({
      getUpcomingTimetableEntries: vi.fn().mockImplementation(() =>
        pending.then(() => ({
          success: true,
          data: [],
          truncated: false,
        })),
      ),
    });

    const stops = [makeStopMeta('A')];
    const now = new Date();
    const { result } = renderHook(() => useNearbyDepartures(stops, now, repo));

    // Should be loading immediately
    expect(result.current.isNearbyLoading).toBe(true);

    act(() => {
      resolvePromise!();
    });

    await waitFor(() => {
      expect(result.current.isNearbyLoading).toBe(false);
    });
  });

  it('cancels stale fetch when dependencies change', async () => {
    const repo = makeRepo();
    const stops1 = [makeStopMeta('A')];
    const stops2 = [makeStopMeta('B')];
    const now = new Date();

    const { result, rerender } = renderHook(({ stops }) => useNearbyDepartures(stops, now, repo), {
      initialProps: { stops: stops1 },
    });

    // Rerender with new stops before first fetch completes
    rerender({ stops: stops2 });

    await waitFor(() => {
      expect(result.current.isNearbyLoading).toBe(false);
    });

    // Final result should reflect the latest stops
    expect(result.current.nearbyDepartures).toHaveLength(1);
    expect(result.current.nearbyDepartures[0].stop.stop_id).toBe('B');
  });

  it('falls back to routeTypes [-1] when getRouteTypesForStop fails', async () => {
    const repo = makeRepo({
      getRouteTypesForStop: vi.fn().mockResolvedValue({
        success: false,
        error: 'Not found',
      }),
    });
    const stops = [makeStopMeta('A')];
    const now = new Date();

    const { result } = renderHook(() => useNearbyDepartures(stops, now, repo));

    await waitFor(() => {
      expect(result.current.isNearbyLoading).toBe(false);
    });

    expect(result.current.nearbyDepartures[0].routeTypes).toEqual([-1]);
  });

  it('falls back to empty groups when getUpcomingTimetableEntries fails', async () => {
    const repo = makeRepo({
      getUpcomingTimetableEntries: vi.fn().mockResolvedValue({
        success: false,
        error: 'No data',
      }),
    });
    const stops = [makeStopMeta('A')];
    const now = new Date();

    const { result } = renderHook(() => useNearbyDepartures(stops, now, repo));

    await waitFor(() => {
      expect(result.current.isNearbyLoading).toBe(false);
    });

    expect(result.current.nearbyDepartures[0].departures).toEqual([]);
  });

  it('passes correct dateTime to repo.getUpcomingTimetableEntries', async () => {
    const repo = makeRepo();
    const stops = [makeStopMeta('A')];
    const specificTime = new Date('2025-03-01T09:00:00');

    const { result } = renderHook(() => useNearbyDepartures(stops, specificTime, repo));

    await waitFor(() => {
      expect(result.current.isNearbyLoading).toBe(false);
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repo.getUpcomingTimetableEntries).toHaveBeenCalledWith('A', specificTime);
  });

  it('re-fetches when dateTime changes', async () => {
    const repo = makeRepo();
    const stops = [makeStopMeta('A')];
    const time1 = new Date('2025-01-01T08:00:00');
    const time2 = new Date('2025-01-01T12:00:00');

    const { result, rerender } = renderHook(
      ({ dateTime }) => useNearbyDepartures(stops, dateTime, repo),
      { initialProps: { dateTime: time1 } },
    );

    await waitFor(() => {
      expect(result.current.isNearbyLoading).toBe(false);
    });

    rerender({ dateTime: time2 });

    await waitFor(() => {
      expect(result.current.isNearbyLoading).toBe(false);
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest mock assertion
    expect(repo.getUpcomingTimetableEntries).toHaveBeenCalledWith('A', time2);
  });

  it('resets isNearbyLoading on promise rejection', async () => {
    const repo = makeRepo({
      getUpcomingTimetableEntries: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    const stops = [makeStopMeta('A')];
    const now = new Date();

    const { result } = renderHook(() => useNearbyDepartures(stops, now, repo));

    await waitFor(() => {
      expect(result.current.isNearbyLoading).toBe(false);
    });

    // Departures should remain empty after error
    expect(result.current.nearbyDepartures).toEqual([]);
  });

  it('preserves stop reference in result', async () => {
    const stop = makeStop('X');
    const meta = makeStopMeta(stop);
    const repo = makeRepo();
    const now = new Date();

    const { result } = renderHook(() => useNearbyDepartures([meta], now, repo));

    await waitFor(() => {
      expect(result.current.isNearbyLoading).toBe(false);
    });

    expect(result.current.nearbyDepartures[0].stop).toBe(stop);
  });

  it('passes through agencies from StopWithMeta', async () => {
    const mockAgency = {
      agency_id: 'a1',
      agency_name: 'Test Agency',
      agency_long_name: 'Test Agency',
      agency_short_name: 'Test',
      agency_names: {},
      agency_long_names: {},
      agency_short_names: {},
      agency_url: '',
      agency_lang: '',
      agency_timezone: '',
      agency_fare_url: '',
      agency_colors: [],
    };
    const repo = makeRepo();
    const stop = makeStop('A');
    const stops = [{ stop, distance: 100, agencies: [mockAgency], routes: [] }];
    const now = new Date();

    const { result } = renderHook(() => useNearbyDepartures(stops, now, repo));

    await waitFor(() => {
      expect(result.current.isNearbyLoading).toBe(false);
    });

    // Agencies come from StopWithMeta, not from departure groups
    expect(result.current.nearbyDepartures[0].agencies).toHaveLength(1);
    expect(result.current.nearbyDepartures[0].agencies[0].agency_id).toBe('a1');
  });

  it('preserves empty agencies from StopWithMeta', async () => {
    const repo = makeRepo();
    const stops = [makeStopMeta('A')];
    const now = new Date();

    const { result } = renderHook(() => useNearbyDepartures(stops, now, repo));

    await waitFor(() => {
      expect(result.current.isNearbyLoading).toBe(false);
    });

    expect(result.current.nearbyDepartures[0].agencies).toEqual([]);
  });

  it('uses resolveStopStats return value as stats', async () => {
    const mockStats = {
      freq: 42,
      routeCount: 3,
      routeTypeCount: 2,
      earliestDeparture: 360,
      latestDeparture: 1380,
    };
    const repo = makeRepo({
      resolveStopStats: vi.fn().mockReturnValue(mockStats),
    });
    const stops = [makeStopMeta('A')];
    const now = new Date('2026-03-11T10:00:00');

    const { result } = renderHook(() => useNearbyDepartures(stops, now, repo));

    await waitFor(() => {
      expect(result.current.isNearbyLoading).toBe(false);
    });

    expect(result.current.nearbyDepartures[0].stats).toBe(mockStats);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repo.resolveStopStats).toHaveBeenCalledWith('A', getServiceDay(now));
  });

  it('passes service day (not raw dateTime) to resolveStopStats', async () => {
    const repo = makeRepo({
      resolveStopStats: vi.fn().mockReturnValue(undefined),
    });
    const stops = [makeStopMeta('A')];
    // 02:30 is before the 03:00 service day boundary.
    // Service day should be the previous calendar day (Mar 11).
    const beforeBoundary = new Date('2026-03-12T02:30:00');

    const { result } = renderHook(() => useNearbyDepartures(stops, beforeBoundary, repo));

    await waitFor(() => {
      expect(result.current.isNearbyLoading).toBe(false);
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repo.resolveStopStats).toHaveBeenCalledWith(
      'A',
      getServiceDay(beforeBoundary), // Mar 11, not Mar 12
    );
    // Verify the service day is indeed Mar 11 (Wednesday)
    const serviceDay = getServiceDay(beforeBoundary);
    expect(serviceDay.getDate()).toBe(11);
  });

  it('returns undefined stats when resolveStopStats returns undefined', async () => {
    const repo = makeRepo({
      resolveStopStats: vi.fn().mockReturnValue(undefined),
    });
    const stops = [makeStopMeta('A')];
    const now = new Date();

    const { result } = renderHook(() => useNearbyDepartures(stops, now, repo));

    await waitFor(() => {
      expect(result.current.isNearbyLoading).toBe(false);
    });

    expect(result.current.nearbyDepartures[0].stats).toBeUndefined();
  });
});
