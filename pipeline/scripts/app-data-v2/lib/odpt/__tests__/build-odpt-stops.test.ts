/**
 * Tests for v2-build-odpt-stops.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type { OdptStation, OdptStationOrder } from '../../../../../types/odpt-train';
import { buildStopsV2, extractStationShortId } from '../build-stops';

function makeStation(
  sameAs: string,
  nameJa: string,
  nameEn: string,
  lat: number,
  lon: number,
): OdptStation {
  return {
    'owl:sameAs': sameAs,
    'dc:date': '2025-01-01',
    'geo:lat': lat,
    'geo:long': lon,
    'odpt:stationCode': '',
    'odpt:stationTitle': { ja: nameJa, en: nameEn },
  };
}

function makeOrder(
  index: number,
  station: string,
  nameJa: string,
  nameEn: string,
): OdptStationOrder {
  return {
    'odpt:index': index,
    'odpt:station': station,
    'odpt:stationTitle': { ja: nameJa, en: nameEn },
  };
}

describe('extractStationShortId', () => {
  it('extracts last segment', () => {
    expect(extractStationShortId('odpt.Station:Yurikamome.Shimbashi')).toBe('Shimbashi');
  });
});

describe('buildStopsV2', () => {
  it('builds stops with v:2 and sorts by station order', () => {
    const stations: OdptStation[] = [
      makeStation('odpt.Station:Test.B', 'B駅', 'Station B', 35.67, 139.77),
      makeStation('odpt.Station:Test.A', 'A駅', 'Station A', 35.66, 139.76),
    ];
    const orders: OdptStationOrder[] = [
      makeOrder(1, 'odpt.Station:Test.A', 'A駅', 'Station A'),
      makeOrder(2, 'odpt.Station:Test.B', 'B駅', 'Station B'),
    ];

    const result = buildStopsV2('test', stations, orders);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      v: 2,
      i: 'test:A',
      n: 'A駅',
      a: 35.66,
      o: 139.76,
      l: 0,
    });
    expect(result[1].i).toBe('test:B');
  });

  it('has no wb, ps, pc fields (ODPT does not provide them)', () => {
    const stations: OdptStation[] = [
      makeStation('odpt.Station:Test.A', 'A駅', 'Station A', 35.66, 139.76),
    ];
    const orders: OdptStationOrder[] = [makeOrder(1, 'odpt.Station:Test.A', 'A駅', 'Station A')];

    const result = buildStopsV2('test', stations, orders);
    expect(result[0].wb).toBeUndefined();
    expect(result[0].ps).toBeUndefined();
    expect(result[0].pc).toBeUndefined();
  });

  it('sorts stations not in stationOrder to the end', () => {
    const stations: OdptStation[] = [
      makeStation('odpt.Station:Test.C', 'C駅', 'Station C', 35.68, 139.78),
      makeStation('odpt.Station:Test.A', 'A駅', 'Station A', 35.66, 139.76),
      makeStation('odpt.Station:Test.B', 'B駅', 'Station B', 35.67, 139.77),
    ];
    // Only A and B have order entries; C is missing
    const orders: OdptStationOrder[] = [
      makeOrder(1, 'odpt.Station:Test.A', 'A駅', 'Station A'),
      makeOrder(2, 'odpt.Station:Test.B', 'B駅', 'Station B'),
    ];

    const result = buildStopsV2('test', stations, orders);
    expect(result).toHaveLength(3);
    expect(result[0].i).toBe('test:A');
    expect(result[1].i).toBe('test:B');
    // C has no order entry, so it gets MAX_SAFE_INTEGER and sorts to the end
    expect(result[2].i).toBe('test:C');
  });

  it('returns empty array when input is empty', () => {
    const result = buildStopsV2('test', [], []);
    expect(result).toEqual([]);
  });

  it('all stops have location_type=0', () => {
    const stations: OdptStation[] = [
      makeStation('odpt.Station:Test.A', 'A駅', 'Station A', 35.66, 139.76),
      makeStation('odpt.Station:Test.B', 'B駅', 'Station B', 35.67, 139.77),
    ];
    const orders: OdptStationOrder[] = [
      makeOrder(1, 'odpt.Station:Test.A', 'A駅', 'Station A'),
      makeOrder(2, 'odpt.Station:Test.B', 'B駅', 'Station B'),
    ];

    const result = buildStopsV2('test', stations, orders);
    for (const stop of result) {
      expect(stop.l).toBe(0);
    }
  });

  it('extracts short ID from deeply nested ODPT URI', () => {
    expect(extractStationShortId('odpt.Station:TokyoMetro.Marunouchi.Tokyo')).toBe('Tokyo');
  });

  it('handles single-segment URI', () => {
    expect(extractStationShortId('Shimbashi')).toBe('Shimbashi');
  });
});
