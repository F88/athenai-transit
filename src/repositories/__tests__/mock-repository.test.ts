import { describe, expect, it } from 'vitest';
import { getHeadsignDisplayNames } from '../../domain/transit/get-headsign-display-names';
import { MockRepository } from '../mock-repository';

function assertSuccess<T>(result: {
  success: boolean;
}): asserts result is { success: true; data: T } {
  if (!result.success) {
    throw new Error(`Expected success but got failure: ${JSON.stringify(result)}`);
  }
}

describe('MockRepository i18n data', () => {
  it('provides multilingual stop, agency, and route names', async () => {
    const repository = new MockRepository();
    const result = await repository.getStopMetaById('sta_central');

    assertSuccess(result);

    expect(result.data.stop.stop_names.ko).toBe('아오바중앙역');
    expect(result.data.stop.stop_names['zh-Hant']).toBe('青葉中央站');

    const aobaAgency = result.data.agencies.find((agency) => agency.agency_id === 'mock:aoba');
    expect(aobaAgency?.agency_short_names['zh-Hant']).toBe('青葉巴士');

    const airportRoute = result.data.routes.find((route) => route.route_id === 'subway_airport');
    expect(airportRoute?.route_names.en).toBe('Airport Liner');
    expect(airportRoute?.route_names['zh-Hans']).toBe('机场线');
  });

  it('provides translated trip and stop headsigns', async () => {
    const repository = new MockRepository();
    const result = await repository.getFullDayTimetableEntries(
      'bus_library',
      new Date('2026-04-07T12:00:00+09:00'),
    );

    assertSuccess(result);

    const stopHeadsignEntry = result.data.find(
      (entry) =>
        entry.routeDirection.route.route_id === 'bus_nohd01' &&
        entry.routeDirection.stopHeadsign?.name === 'もり公園前・にじ橋',
    );
    expect(stopHeadsignEntry).toBeDefined();

    const stopDisplay = getHeadsignDisplayNames(
      stopHeadsignEntry!.routeDirection,
      'stop',
      'zh-Hant',
      ['ja'],
    );
    expect(stopDisplay.resolved.name).toBe('森公園前 / 彩虹橋');

    const tripHeadsignEntry = result.data.find(
      (entry) =>
        entry.routeDirection.route.route_id === 'bus_aoba01' &&
        entry.routeDirection.tripHeadsign.name === 'にじ橋',
    );
    expect(tripHeadsignEntry).toBeDefined();

    const tripDisplay = getHeadsignDisplayNames(tripHeadsignEntry!.routeDirection, 'trip', 'ko', [
      'ja',
    ]);
    expect(tripDisplay.resolved.name).toBe('니지다리');
  });
});
