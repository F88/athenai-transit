import { describe, expect, it } from 'vitest';
import type { TimetableEntry } from '../../../types/app/transit-composed';
import { computeStopsCounts } from '../compute-stops-counts';

function makeEntry(
  overrides: {
    isFirstStop?: boolean;
    isLastStop?: boolean;
    pickupType?: 0 | 1 | 2 | 3;
  } = {},
): TimetableEntry {
  return {
    schedule: { departureMinutes: 480, arrivalMinutes: 480 },
    routeDirection: {
      route: {
        route_id: 'route-1',
        route_type: 3,
        agency_id: 'agency-1',
        route_short_name: '1',
        route_short_names: {},
        route_long_name: 'Route 1',
        route_long_names: {},
        route_color: '000000',
        route_text_color: 'FFFFFF',
      },
      tripHeadsign: { name: 'Terminal', names: {} },
    },
    boarding: { pickupType: overrides.pickupType ?? 0, dropOffType: 0 },
    patternPosition: {
      stopIndex: 0,
      totalStops: 3,
      isFirstStop: overrides.isFirstStop ?? false,
      isLastStop: overrides.isLastStop ?? false,
    },
    tripLocator: { patternId: 'pattern-1', serviceId: 'svc-1', tripIndex: 0 },
  };
}

describe('computeStopsCounts', () => {
  it('returns zero counts for empty input', () => {
    expect(computeStopsCounts([])).toEqual({
      total: 0,
      nonEmpty: 0,
      originCount: 0,
      boardableCount: 0,
    });
  });

  it('counts total/non-empty/origin/boardable stops across mixed stop states', () => {
    const pureTerminal = { stopTimes: [makeEntry({ isLastStop: true, pickupType: 0 })] };
    const oneStopTrip = {
      stopTimes: [makeEntry({ isFirstStop: true, isLastStop: true, pickupType: 0 })],
    };
    const middleBoardable = { stopTimes: [makeEntry({ pickupType: 0 })] };
    const nonBoardableOrigin = { stopTimes: [makeEntry({ isFirstStop: true, pickupType: 1 })] };
    const emptyStop = { stopTimes: [] };

    expect(
      computeStopsCounts([
        pureTerminal,
        oneStopTrip,
        middleBoardable,
        nonBoardableOrigin,
        emptyStop,
      ]),
    ).toEqual({
      total: 5,
      nonEmpty: 4,
      originCount: 2,
      boardableCount: 2,
    });
  });

  it('treats boardability according to pickup_type === 0 && (isFirstStop || !isLastStop)', () => {
    const pureTerminal = {
      stopTimes: [makeEntry({ isFirstStop: false, isLastStop: true, pickupType: 0 })],
    };
    const oneStopTrip = {
      stopTimes: [makeEntry({ isFirstStop: true, isLastStop: true, pickupType: 0 })],
    };
    const middle = {
      stopTimes: [makeEntry({ isFirstStop: false, isLastStop: false, pickupType: 0 })],
    };
    const phoneArrangement = {
      stopTimes: [makeEntry({ isFirstStop: true, isLastStop: false, pickupType: 2 })],
    };

    expect(computeStopsCounts([pureTerminal, oneStopTrip, middle, phoneArrangement])).toEqual({
      total: 4,
      nonEmpty: 4,
      originCount: 2,
      boardableCount: 2,
    });
  });
});
