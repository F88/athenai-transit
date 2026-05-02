import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { makeRepo, makeRoute, makeStop } from '../../__tests__/helpers';
import type { TimetableEntry } from '../../types/app/transit-composed';
import { useTimetable } from '../use-timetable';

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
        dateTime: new Date('2026-05-02T12:00:00+09:00'),
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
        dateTime: new Date('2026-05-02T12:00:00+09:00'),
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
});
