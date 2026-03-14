import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useNearbyDepartures } from '../use-nearby-departures';
import { makeStop, makeStopMeta, makeRoute, makeRepo } from '../../__tests__/helpers';

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
    expect(repo.getUpcomingDepartures).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repo.getRouteTypesForStop).toHaveBeenCalledTimes(2);
  });

  it('sets isNearbyLoading to true while fetching', async () => {
    let resolvePromise: () => void;
    const pending = new Promise<void>((r) => {
      resolvePromise = r;
    });

    const repo = makeRepo({
      getUpcomingDepartures: vi.fn().mockImplementation(() =>
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

  it('falls back to routeTypes [3] when getRouteTypesForStop fails', async () => {
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

    expect(result.current.nearbyDepartures[0].routeTypes).toEqual([3]);
  });

  it('falls back to empty groups when getUpcomingDepartures fails', async () => {
    const repo = makeRepo({
      getUpcomingDepartures: vi.fn().mockResolvedValue({
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

    expect(result.current.nearbyDepartures[0].groups).toEqual([]);
  });

  it('passes correct dateTime to repo.getUpcomingDepartures', async () => {
    const repo = makeRepo();
    const stops = [makeStopMeta('A')];
    const specificTime = new Date('2025-03-01T09:00:00');

    const { result } = renderHook(() => useNearbyDepartures(stops, specificTime, repo));

    await waitFor(() => {
      expect(result.current.isNearbyLoading).toBe(false);
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repo.getUpcomingDepartures).toHaveBeenCalledWith('A', specificTime);
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
    expect(repo.getUpcomingDepartures).toHaveBeenCalledWith('A', time2);
  });

  it('resets isNearbyLoading on promise rejection', async () => {
    const repo = makeRepo({
      getUpcomingDepartures: vi.fn().mockRejectedValue(new Error('Network error')),
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

  it('includes empty agencies when no departures', async () => {
    const repo = makeRepo();
    const stops = [makeStopMeta('A')];
    const now = new Date();

    const { result } = renderHook(() => useNearbyDepartures(stops, now, repo));

    await waitFor(() => {
      expect(result.current.isNearbyLoading).toBe(false);
    });

    expect(result.current.nearbyDepartures[0].agencies).toEqual([]);
  });

  it('collects agencies from departure groups', async () => {
    const mockAgency = {
      agency_id: 'a1',
      agency_name: 'Test Agency',
      agency_short_name: 'Test',
      agency_names: {},
      agency_short_names: {},
      agency_url: '',
      agency_lang: '',
      agency_timezone: '',
      agency_fare_url: '',
      agency_colors: [],
    };
    const repo = makeRepo({
      getUpcomingDepartures: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            route: { ...makeRoute('R1'), agency_id: 'a1' },
            headsign: 'Test',
            headsign_names: {},
            departures: [new Date()],
          },
        ],
        truncated: false,
      }),
      getAgency: vi.fn().mockResolvedValue({
        success: true,
        data: mockAgency,
      }),
    });
    const stops = [makeStopMeta('A')];
    const now = new Date();

    const { result } = renderHook(() => useNearbyDepartures(stops, now, repo));

    await waitFor(() => {
      expect(result.current.isNearbyLoading).toBe(false);
    });

    expect(result.current.nearbyDepartures[0].agencies).toHaveLength(1);
    expect(result.current.nearbyDepartures[0].agencies[0].agency_id).toBe('a1');
  });

  it('deduplicates agencies across multiple groups', async () => {
    const mockAgency = {
      agency_id: 'a1',
      agency_name: 'Test Agency',
      agency_short_name: 'Test',
      agency_names: {},
      agency_short_names: {},
      agency_url: '',
      agency_lang: '',
      agency_timezone: '',
      agency_fare_url: '',
      agency_colors: [],
    };
    const repo = makeRepo({
      getUpcomingDepartures: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            route: { ...makeRoute('R1'), agency_id: 'a1' },
            headsign: 'Dest A',
            headsign_names: {},
            departures: [new Date()],
          },
          {
            route: { ...makeRoute('R2'), agency_id: 'a1' },
            headsign: 'Dest B',
            headsign_names: {},
            departures: [new Date()],
          },
        ],
        truncated: false,
      }),
      getAgency: vi.fn().mockResolvedValue({
        success: true,
        data: mockAgency,
      }),
    });
    const stops = [makeStopMeta('A')];
    const now = new Date();

    const { result } = renderHook(() => useNearbyDepartures(stops, now, repo));

    await waitFor(() => {
      expect(result.current.isNearbyLoading).toBe(false);
    });

    // Same agency_id from 2 groups → deduplicated to 1
    expect(result.current.nearbyDepartures[0].agencies).toHaveLength(1);
    // getAgency called only once due to Set deduplication
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repo.getAgency).toHaveBeenCalledTimes(1);
  });
});
