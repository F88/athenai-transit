import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { makeRepo, makeRoute, makeStop } from '../../__tests__/helpers';
import type { TimetableEntry } from '../../types/app/transit-composed';
import { useTimetable } from '../use-timetable';

// All tests use this single fixed UTC instant. Tests never assert on the
// derived `serviceDate`, so the local-timezone interpretation done by
// `getServiceDay` inside the hook does not influence any assertion.
const FIXED_DATETIME = new Date('2026-05-02T12:00:00.000Z');

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function makeStopMeta(stopId: string, routeIds: string[] = ['route-1']) {
  return {
    stop: makeStop(stopId),
    agencies: [],
    routes: routeIds.map((routeId) => makeRoute(routeId)),
  };
}

function makeTimetableEntry(routeId = 'route-1', headsign = 'Headsign'): TimetableEntry {
  return {
    tripLocator: { patternId: `${routeId}__pattern`, serviceId: 'weekday', tripIndex: 0 },
    schedule: { departureMinutes: 480, arrivalMinutes: 480 },
    routeDirection: {
      route: makeRoute(routeId),
      tripHeadsign: { name: headsign, names: {} },
      direction: 0,
    },
    boarding: { pickupType: 0, dropOffType: 0 },
    patternPosition: { stopIndex: 0, totalStops: 1, isOrigin: true, isTerminal: true },
  };
}

describe('useTimetable', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens stop timetable by falling back to full-dataset stop lookup', async () => {
    const stopMeta = makeStopMeta('stop-remote');
    const getStopMetaById = vi.fn().mockResolvedValue({ success: true, data: stopMeta });
    const repo = makeRepo({
      getStopMetaById,
      getFullDayTimetableEntries: vi.fn().mockResolvedValue({
        success: true,
        data: [makeTimetableEntry()],
        truncated: false,
        meta: { isBoardableOnServiceDay: true, totalEntries: 1 },
      }),
    });

    const { result } = renderHook(() => useTimetable(repo));

    let status: Awaited<ReturnType<typeof result.current.openStopTimetable>>;
    await act(async () => {
      status = await result.current.openStopTimetable({
        stopId: 'stop-remote',
        dateTime: FIXED_DATETIME,
      });
    });

    expect(status!).toEqual({ status: 'opened' });
    expect(getStopMetaById).toHaveBeenCalledWith('stop-remote');
    expect(result.current.timetableData).toEqual(
      expect.objectContaining({
        type: 'stop',
        stop: stopMeta.stop,
        routes: stopMeta.routes,
        agencies: stopMeta.agencies,
      }),
    );
  });

  it('uses repository stop metadata for route-headsign timetable', async () => {
    const stopMeta = makeStopMeta('stop-visible', ['route-visible']);
    const getStopMetaById = vi.fn().mockResolvedValue({ success: true, data: stopMeta });
    const repo = makeRepo({
      getStopMetaById,
      getFullDayTimetableEntries: vi.fn().mockResolvedValue({
        success: true,
        data: [makeTimetableEntry('route-visible')],
        truncated: false,
        meta: { isBoardableOnServiceDay: true, totalEntries: 1 },
      }),
    });

    const { result } = renderHook(() => useTimetable(repo));

    await act(async () => {
      await result.current.openRouteHeadsignTimetable({
        stopId: 'stop-visible',
        routeId: 'route-visible',
        headsign: 'Headsign',
        dateTime: FIXED_DATETIME,
      });
    });

    expect(getStopMetaById).toHaveBeenCalledWith('stop-visible');
    expect(result.current.timetableData).toEqual(
      expect.objectContaining({
        type: 'route-headsign',
        stop: stopMeta.stop,
        routes: stopMeta.routes,
        headsign: 'Headsign',
      }),
    );
  });

  it('returns error and keeps timetable closed when timetable lookup fails', async () => {
    const stopMeta = makeStopMeta('stop-error');
    const repo = makeRepo({
      getStopMetaById: vi.fn().mockResolvedValue({ success: true, data: stopMeta }),
      getFullDayTimetableEntries: vi.fn().mockResolvedValue({
        success: false,
        error: 'broken timetable source',
      }),
    });

    const { result } = renderHook(() => useTimetable(repo));

    let status: Awaited<ReturnType<typeof result.current.openStopTimetable>>;
    await act(async () => {
      status = await result.current.openStopTimetable({
        stopId: 'stop-error',
        dateTime: FIXED_DATETIME,
      });
    });

    expect(status!).toEqual({ status: 'error' });
    expect(result.current.timetableData).toBeNull();
  });

  it('returns not-found and keeps timetable closed when stop metadata lookup fails', async () => {
    const repo = makeRepo({
      getStopMetaById: vi.fn().mockResolvedValue({ success: false, error: 'Unknown stop' }),
    });

    const { result } = renderHook(() => useTimetable(repo));

    let status: Awaited<ReturnType<typeof result.current.openStopTimetable>>;
    await act(async () => {
      status = await result.current.openStopTimetable({
        stopId: 'missing-stop',
        dateTime: FIXED_DATETIME,
      });
    });

    expect(status!).toEqual({ status: 'not-found' });
    expect(result.current.timetableData).toBeNull();
  });

  it('returns route-not-found when the route does not belong to the stop', async () => {
    const stopMeta = makeStopMeta('stop-visible', ['route-visible']);
    const repo = makeRepo({
      getStopMetaById: vi.fn().mockResolvedValue({ success: true, data: stopMeta }),
    });

    const { result } = renderHook(() => useTimetable(repo));

    let status: Awaited<ReturnType<typeof result.current.openRouteHeadsignTimetable>>;
    await act(async () => {
      status = await result.current.openRouteHeadsignTimetable({
        stopId: 'stop-visible',
        routeId: 'route-missing',
        headsign: 'Headsign',
        dateTime: FIXED_DATETIME,
      });
    });

    expect(status!).toEqual({ status: 'route-not-found' });
    expect(result.current.timetableData).toBeNull();
  });

  it('uses repository meta.totalEntries when deriving stopServiceState', async () => {
    const stopMeta = makeStopMeta('stop-dropoff');
    const repo = makeRepo({
      getStopMetaById: vi.fn().mockResolvedValue({ success: true, data: stopMeta }),
      getFullDayTimetableEntries: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        truncated: false,
        meta: { isBoardableOnServiceDay: false, totalEntries: 1 },
      }),
    });

    const { result } = renderHook(() => useTimetable(repo));

    await act(async () => {
      await result.current.openStopTimetable({
        stopId: 'stop-dropoff',
        dateTime: FIXED_DATETIME,
      });
    });

    expect(result.current.timetableData?.stopServiceState).toBe('drop-off-only');
  });

  it('cancels the older request when a newer open request finishes first', async () => {
    // Hold the first stop-meta lookup pending so the older request stalls
    // before reaching getFullDayTimetableEntries. The newer request resolves
    // synchronously and updates `requestIdRef`, which causes the older one
    // to short-circuit on the post-await cancellation check.
    const slowFirstStopMeta = createDeferred<{
      success: true;
      data: ReturnType<typeof makeStopMeta>;
    }>();
    const repo = makeRepo({
      getStopMetaById: vi
        .fn()
        .mockReturnValueOnce(slowFirstStopMeta.promise)
        .mockImplementation((stopId: string) =>
          Promise.resolve({ success: true, data: makeStopMeta(stopId) }),
        ),
      getFullDayTimetableEntries: vi.fn().mockResolvedValue({
        success: true,
        data: [makeTimetableEntry('route-2')],
        truncated: false,
        meta: { isBoardableOnServiceDay: true, totalEntries: 1 },
      }),
    });

    const { result } = renderHook(() => useTimetable(repo));

    let firstOpenPromise!: ReturnType<typeof result.current.openStopTimetable>;
    act(() => {
      firstOpenPromise = result.current.openStopTimetable({
        stopId: 'stop-1',
        dateTime: FIXED_DATETIME,
      });
    });

    let secondStatus: Awaited<ReturnType<typeof result.current.openStopTimetable>>;
    await act(async () => {
      secondStatus = await result.current.openStopTimetable({
        stopId: 'stop-2',
        dateTime: FIXED_DATETIME,
      });
    });

    await act(async () => {
      slowFirstStopMeta.resolve({ success: true, data: makeStopMeta('stop-1') });
      await slowFirstStopMeta.promise;
    });

    const firstStatus = await firstOpenPromise;

    expect(secondStatus!).toEqual({ status: 'opened' });
    expect(firstStatus).toEqual({ status: 'cancelled' });
    expect(result.current.timetableData?.stop.stop_id).toBe('stop-2');
  });

  it('cancels an in-flight request when closeTimetable is called', async () => {
    const deferredTimetable = createDeferred<{
      success: true;
      data: TimetableEntry[];
      truncated: false;
      meta: { isBoardableOnServiceDay: true; totalEntries: number };
    }>();
    const repo = makeRepo({
      getStopMetaById: vi.fn().mockResolvedValue({ success: true, data: makeStopMeta('stop-1') }),
      getFullDayTimetableEntries: vi.fn().mockImplementation(() => deferredTimetable.promise),
    });

    const { result } = renderHook(() => useTimetable(repo));

    let openPromise!: ReturnType<typeof result.current.openStopTimetable>;
    act(() => {
      openPromise = result.current.openStopTimetable({
        stopId: 'stop-1',
        dateTime: FIXED_DATETIME,
      });
    });

    act(() => {
      result.current.closeTimetable();
    });

    await act(async () => {
      deferredTimetable.resolve({
        success: true,
        data: [makeTimetableEntry()],
        truncated: false,
        meta: { isBoardableOnServiceDay: true, totalEntries: 1 },
      });
      await deferredTimetable.promise;
    });

    const status = await openPromise;

    expect(status).toEqual({ status: 'cancelled' });
    expect(result.current.timetableData).toBeNull();
  });

  it('returns error when timetable lookup rejects', async () => {
    const stopMeta = makeStopMeta('stop-reject');
    const repo = makeRepo({
      getStopMetaById: vi.fn().mockResolvedValue({ success: true, data: stopMeta }),
      getFullDayTimetableEntries: vi.fn().mockRejectedValue(new Error('network down')),
    });

    const { result } = renderHook(() => useTimetable(repo));

    let status: Awaited<ReturnType<typeof result.current.openStopTimetable>>;
    await act(async () => {
      status = await result.current.openStopTimetable({
        stopId: 'stop-reject',
        dateTime: FIXED_DATETIME,
      });
    });

    expect(status!).toEqual({ status: 'error' });
    expect(result.current.timetableData).toBeNull();
  });
});
