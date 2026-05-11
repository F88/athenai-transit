import { renderHook, act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeRepo } from '../../__tests__/helpers';
import { getServiceDay } from '../../domain/transit/service-day';
import type { Route } from '../../types/app/transit';
import type {
  TimetableEntry,
  TripInspectionTarget,
  TripLocator,
  TripSnapshot,
  TripStopTime,
} from '../../types/app/transit-composed';
import { useTripInspection } from '../use-trip-inspection';

const mockWarn = vi.fn();

vi.mock('../../lib/logger', () => ({
  createLogger: () => ({
    isEnabled: vi.fn().mockReturnValue(false),
    verbose: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: (...args: unknown[]) => {
      mockWarn(...args);
    },
    error: vi.fn(),
  }),
}));

function makeRoute(routeId = 'test:R1'): Route {
  return {
    route_id: routeId,
    route_short_name: routeId,
    route_short_names: {},
    route_long_name: routeId,
    route_long_names: {},
    route_type: 3,
    route_color: '000000',
    route_text_color: 'FFFFFF',
    agency_id: 'test:agency',
  };
}

function makeLocator(overrides: Partial<TripLocator> = {}): TripLocator {
  return { patternId: 'pattern-a', serviceId: 'weekday', tripIndex: 0, ...overrides };
}

function makeTarget(overrides: Partial<TripInspectionTarget> = {}): TripInspectionTarget {
  return {
    tripLocator: makeLocator(),
    serviceDate: new Date(2026, 4, 11),
    stopIndex: 3,
    departureMinutes: 600,
    ...overrides,
  };
}

function makeEntry(overrides: {
  patternId?: string;
  serviceId?: string;
  tripIndex?: number;
  stopIndex?: number;
  departureMinutes: number;
  arrivalMinutes?: number;
  isTerminal?: boolean;
}): TimetableEntry {
  return {
    schedule: {
      departureMinutes: overrides.departureMinutes,
      arrivalMinutes: overrides.arrivalMinutes ?? overrides.departureMinutes,
    },
    routeDirection: {
      route: makeRoute(),
      tripHeadsign: { name: 'Terminal', names: {} },
    },
    boarding: { pickupType: 0, dropOffType: 0 },
    patternPosition: {
      stopIndex: overrides.stopIndex ?? 3,
      totalStops: 10,
      isTerminal: overrides.isTerminal ?? false,
      isOrigin: false,
    },
    tripLocator: {
      patternId: overrides.patternId ?? 'pattern-a',
      serviceId: overrides.serviceId ?? 'weekday',
      tripIndex: overrides.tripIndex ?? 0,
    },
  };
}

function makeStopTime(stopIndex: number, departureMinutes: number): TripStopTime {
  return {
    routeTypes: [],
    timetableEntry: {
      tripLocator: makeLocator(),
      schedule: { departureMinutes, arrivalMinutes: departureMinutes },
      routeDirection: {
        route: makeRoute(),
        tripHeadsign: { name: 'Terminal', names: {} },
      },
      boarding: { pickupType: 0, dropOffType: 0 },
      patternPosition: {
        stopIndex,
        totalStops: 10,
        isTerminal: false,
        isOrigin: false,
      },
    },
    stopMeta: {
      stop: {
        stop_id: `stop-${String(stopIndex)}`,
        stop_name: `Stop ${String(stopIndex)}`,
        stop_names: {},
        stop_lat: 0,
        stop_lon: 0,
        location_type: 0,
        agency_id: 'test:agency',
      },
      agencies: [],
      routes: [],
    },
  };
}

function makeTripSnapshot(stopTimes: TripStopTime[]): TripSnapshot {
  return {
    locator: makeLocator(),
    route: makeRoute(),
    tripHeadsign: { name: 'Terminal', names: {} },
    serviceDate: new Date(2026, 4, 11),
    stopTimes,
  };
}

describe('useTripInspection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockWarn.mockReset();
  });

  it('logs no-service-on-this-day when stopId lookup returns an empty result for the service day', async () => {
    const now = new Date('2026-05-02T14:59:36+09:00');
    const serviceDate = getServiceDay(now);
    const repo = makeRepo({
      getTripInspectionTargets: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        meta: { emptyReason: 'no-service-on-this-day' },
      }),
    });

    const { result } = renderHook(() => useTripInspection(repo));

    let status: Awaited<ReturnType<typeof result.current.openTripInspectionFromStopId>>;
    await act(async () => {
      status = await result.current.openTripInspectionFromStopId({
        stopId: 'sbbus:20023-15',
        now,
        serviceDate,
      });
    });

    expect(status!).toEqual({
      status: 'no-data',
      reason: 'no-service-on-this-day',
    });
    expect(mockWarn).toHaveBeenCalledWith(
      'openTripInspectionFromStopId: empty trip inspection target result',
      expect.objectContaining({
        stopId: 'sbbus:20023-15',
        emptyReason: 'no-service-on-this-day',
        note: 'The stop has trip-inspection data, but no services on the selected service day.',
      }),
    );
  });

  it('logs no-stop-data when stopId lookup returns no trip-inspection stop data', async () => {
    const now = new Date('2026-05-02T14:59:36+09:00');
    const serviceDate = getServiceDay(now);
    const repo = makeRepo({
      getTripInspectionTargets: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        meta: { emptyReason: 'no-stop-data' },
      }),
    });

    const { result } = renderHook(() => useTripInspection(repo));

    let status: Awaited<ReturnType<typeof result.current.openTripInspectionFromStopId>>;
    await act(async () => {
      status = await result.current.openTripInspectionFromStopId({
        stopId: 'missing_stop',
        now,
        serviceDate,
      });
    });

    expect(status!).toEqual({
      status: 'no-data',
      reason: 'no-stop-data',
    });
    expect(mockWarn).toHaveBeenCalledWith(
      'openTripInspectionFromStopId: empty trip inspection target result',
      expect.objectContaining({
        stopId: 'missing_stop',
        emptyReason: 'no-stop-data',
        note: 'The stop has no trip-inspection stop data.',
      }),
    );
  });

  it('opens from a target using full-day timetable entries ordered by display time', async () => {
    const serviceDate = new Date(2026, 4, 11);
    const requestedTarget = makeTarget({
      tripLocator: makeLocator({ tripIndex: 2 }),
      serviceDate,
      stopIndex: 3,
      departureMinutes: 9 * 60 + 6,
    });
    const terminalEntry = makeEntry({
      tripIndex: 1,
      stopIndex: 3,
      arrivalMinutes: 9 * 60 + 5,
      departureMinutes: 9 * 60 + 8,
      isTerminal: true,
    });
    const requestedEntry = makeEntry({
      tripIndex: 2,
      stopIndex: 3,
      departureMinutes: 9 * 60 + 6,
    });
    const getTripSnapshot = vi.fn().mockReturnValue({
      success: true,
      data: makeTripSnapshot([makeStopTime(3, 9 * 60 + 6)]),
    });
    const getFullDayTimetableEntries = vi.fn().mockResolvedValue({
      success: true,
      data: [requestedEntry, terminalEntry],
      truncated: false,
      meta: { isBoardableOnServiceDay: true, totalEntries: 2 },
    });
    const repo = makeRepo({
      getTripSnapshot,
      getFullDayTimetableEntries,
    });

    const { result } = renderHook(() => useTripInspection(repo));

    let status: Awaited<ReturnType<typeof result.current.openTripInspectionFromTarget>>;
    await act(async () => {
      status = await result.current.openTripInspectionFromTarget(requestedTarget);
    });

    expect(status!).toEqual({ status: 'opened' });
    expect(getTripSnapshot).toHaveBeenCalledWith(requestedTarget.tripLocator, serviceDate);
    expect(getFullDayTimetableEntries).toHaveBeenCalledWith('stop-3', expect.any(Date));

    const referenceDateTime = getFullDayTimetableEntries.mock.calls[0]?.[1] as Date;
    expect(referenceDateTime.getFullYear()).toBe(2026);
    expect(referenceDateTime.getMonth()).toBe(4);
    expect(referenceDateTime.getDate()).toBe(11);
    expect(referenceDateTime.getHours()).toBe(12);
    expect(referenceDateTime.getMinutes()).toBe(0);

    expect(
      result.current.tripInspectionTargets.map((target) => target.tripLocator.tripIndex),
    ).toEqual([1, 2]);
    expect(result.current.currentTripInspectionTargetIndex).toBe(1);
    expect(result.current.tripInspectionSnapshot?.selectedStop.stopMeta?.stop.stop_id).toBe(
      'stop-3',
    );
  });

  it('returns error when full-day timetable lookup fails', async () => {
    const target = makeTarget();
    const getFullDayTimetableEntries = vi.fn().mockResolvedValue({
      success: false,
      error: 'lookup failed',
    });
    const repo = makeRepo({
      getTripSnapshot: vi.fn().mockReturnValue({
        success: true,
        data: makeTripSnapshot([makeStopTime(3, 600)]),
      }),
      getFullDayTimetableEntries,
    });

    const { result } = renderHook(() => useTripInspection(repo));

    let status: Awaited<ReturnType<typeof result.current.openTripInspectionFromTarget>>;
    await act(async () => {
      status = await result.current.openTripInspectionFromTarget(target);
    });

    expect(status!).toEqual({ status: 'error' });
    expect(result.current.tripInspectionSnapshot).toBeNull();
    expect(result.current.tripInspectionTargets).toEqual([]);
    expect(result.current.currentTripInspectionTargetIndex).toBe(-1);
    expect(mockWarn).toHaveBeenCalledWith(
      'openTripInspection: trip-inspection entry lookup failed',
      'lookup failed',
      target,
    );
  });

  it('returns target-missing when full-day entries do not contain the requested trip', async () => {
    const target = makeTarget({
      tripLocator: makeLocator({ patternId: 'pattern-a', tripIndex: 4 }),
      stopIndex: 3,
      departureMinutes: 600,
    });
    const repo = makeRepo({
      getTripSnapshot: vi.fn().mockReturnValue({
        success: true,
        data: makeTripSnapshot([makeStopTime(3, 600)]),
      }),
      getFullDayTimetableEntries: vi.fn().mockResolvedValue({
        success: true,
        data: [
          makeEntry({ patternId: 'pattern-b', tripIndex: 1, stopIndex: 3, departureMinutes: 600 }),
        ],
        truncated: false,
        meta: { isBoardableOnServiceDay: true, totalEntries: 1 },
      }),
    });

    const { result } = renderHook(() => useTripInspection(repo));

    let status: Awaited<ReturnType<typeof result.current.openTripInspectionFromTarget>>;
    await act(async () => {
      status = await result.current.openTripInspectionFromTarget(target);
    });

    expect(status!).toEqual({ status: 'no-data', reason: 'target-missing' });
    expect(result.current.tripInspectionSnapshot).toBeNull();
    expect(result.current.tripInspectionTargets).toEqual([]);
    expect(result.current.currentTripInspectionTargetIndex).toBe(-1);
    expect(mockWarn).toHaveBeenCalledWith(
      'openTripInspection: current target missing from trip-inspection targets',
      { target },
    );
  });

  it('uses cached targets for previous navigation without refetching full-day entries', async () => {
    const serviceDate = new Date(2026, 4, 11);
    const firstTarget = makeTarget({
      tripLocator: makeLocator({ tripIndex: 1 }),
      serviceDate,
      stopIndex: 3,
      departureMinutes: 9 * 60 + 5,
    });
    const secondTarget = makeTarget({
      tripLocator: makeLocator({ tripIndex: 2 }),
      serviceDate,
      stopIndex: 3,
      departureMinutes: 9 * 60 + 6,
    });
    const getTripSnapshot = vi.fn().mockImplementation((tripLocator: TripLocator) => ({
      success: true,
      data: makeTripSnapshot([
        makeStopTime(
          3,
          tripLocator.tripIndex === 1
            ? firstTarget.departureMinutes
            : secondTarget.departureMinutes,
        ),
      ]),
    }));
    const getFullDayTimetableEntries = vi.fn().mockResolvedValue({
      success: true,
      data: [
        makeEntry({ tripIndex: 1, stopIndex: 3, departureMinutes: firstTarget.departureMinutes }),
        makeEntry({ tripIndex: 2, stopIndex: 3, departureMinutes: secondTarget.departureMinutes }),
      ],
      truncated: false,
      meta: { isBoardableOnServiceDay: true, totalEntries: 2 },
    });
    const repo = makeRepo({
      getTripSnapshot,
      getFullDayTimetableEntries,
    });

    const { result } = renderHook(() => useTripInspection(repo));

    await act(async () => {
      await result.current.openTripInspectionFromTarget(secondTarget);
    });

    expect(result.current.currentTripInspectionTargetIndex).toBe(1);
    expect(getFullDayTimetableEntries).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.openPreviousTripInspection();
    });

    await waitFor(() => {
      expect(result.current.currentTripInspectionTargetIndex).toBe(0);
    });
    expect(getFullDayTimetableEntries).toHaveBeenCalledTimes(1);
    expect(getTripSnapshot).toHaveBeenCalledTimes(2);
    expect(getTripSnapshot.mock.calls[1]?.[0]).toEqual(firstTarget.tripLocator);
  });

  it('refetches full-day entries when stale pager targets miss the cache', async () => {
    const serviceDate = new Date(2026, 4, 11);
    const firstList = {
      first: makeTarget({
        tripLocator: makeLocator({ tripIndex: 1 }),
        serviceDate,
        stopIndex: 3,
        departureMinutes: 9 * 60 + 5,
      }),
      second: makeTarget({
        tripLocator: makeLocator({ tripIndex: 2 }),
        serviceDate,
        stopIndex: 3,
        departureMinutes: 9 * 60 + 6,
      }),
    };
    const secondList = {
      first: makeTarget({
        tripLocator: makeLocator({ patternId: 'pattern-b', tripIndex: 5 }),
        serviceDate,
        stopIndex: 8,
        departureMinutes: 10 * 60 + 1,
      }),
      second: makeTarget({
        tripLocator: makeLocator({ patternId: 'pattern-b', tripIndex: 6 }),
        serviceDate,
        stopIndex: 8,
        departureMinutes: 10 * 60 + 2,
      }),
    };

    const getTripSnapshot = vi.fn().mockImplementation((tripLocator: TripLocator) => ({
      success: true,
      data: makeTripSnapshot([
        makeStopTime(
          tripLocator.patternId === 'pattern-b' ? 8 : 3,
          tripLocator.tripIndex === 1
            ? firstList.first.departureMinutes
            : tripLocator.tripIndex === 2
              ? firstList.second.departureMinutes
              : tripLocator.tripIndex === 5
                ? secondList.first.departureMinutes
                : secondList.second.departureMinutes,
        ),
      ]),
    }));
    const getFullDayTimetableEntries = vi.fn().mockImplementation((stopId: string) => {
      if (stopId === 'stop-3') {
        return Promise.resolve({
          success: true,
          data: [
            makeEntry({
              tripIndex: 1,
              stopIndex: 3,
              departureMinutes: firstList.first.departureMinutes,
            }),
            makeEntry({
              tripIndex: 2,
              stopIndex: 3,
              departureMinutes: firstList.second.departureMinutes,
            }),
          ],
          truncated: false,
          meta: { isBoardableOnServiceDay: true, totalEntries: 2 },
        });
      }

      return Promise.resolve({
        success: true,
        data: [
          makeEntry({
            patternId: 'pattern-b',
            tripIndex: 5,
            stopIndex: 8,
            departureMinutes: secondList.first.departureMinutes,
          }),
          makeEntry({
            patternId: 'pattern-b',
            tripIndex: 6,
            stopIndex: 8,
            departureMinutes: secondList.second.departureMinutes,
          }),
        ],
        truncated: false,
        meta: { isBoardableOnServiceDay: true, totalEntries: 2 },
      });
    });
    const repo = makeRepo({
      getTripSnapshot,
      getFullDayTimetableEntries,
    });

    const { result } = renderHook(() => useTripInspection(repo));

    await act(async () => {
      await result.current.openTripInspectionFromTarget(firstList.second);
    });

    const staleOpenPreviousTripInspection = result.current.openPreviousTripInspection;

    await act(async () => {
      await result.current.openTripInspectionFromTarget(secondList.second);
    });

    expect(
      result.current.tripInspectionTargets.map((target) => target.tripLocator.tripIndex),
    ).toEqual([5, 6]);
    expect(getFullDayTimetableEntries).toHaveBeenCalledTimes(2);

    act(() => {
      staleOpenPreviousTripInspection();
    });

    await waitFor(() => {
      expect(
        result.current.tripInspectionTargets.map((target) => target.tripLocator.tripIndex),
      ).toEqual([1, 2]);
    });
    expect(result.current.currentTripInspectionTargetIndex).toBe(0);
    expect(result.current.tripInspectionSnapshot?.selectedStop.stopMeta?.stop.stop_id).toBe(
      'stop-3',
    );
    expect(getFullDayTimetableEntries).toHaveBeenCalledTimes(3);
    expect(mockWarn).toHaveBeenCalledWith(
      'openTripInspection: target missing from cached trip-inspection targets',
      expect.objectContaining({
        target: firstList.first,
      }),
    );
  });
});
