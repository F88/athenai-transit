import { describe, it, expect } from 'vitest';
import { mergeSourcesV2 } from '..';
import { createFixtureV2 } from './fixtures/test-data-source-v2';

describe('mergeSourcesV2', () => {
  it('converts stops with empty agency_id', () => {
    const fixture = createFixtureV2();
    const merged = mergeSourcesV2([fixture]);
    const tdn01 = merged.stops.find((s) => s.stop_id === 'tdn_01');
    expect(tdn01).toBeDefined();
    expect(tdn01!.agency_id).toBe('');
  });

  it('resolves stop_names from translations', () => {
    const fixture = createFixtureV2();
    const merged = mergeSourcesV2([fixture]);
    const tdn01 = merged.stops.find((s) => s.stop_id === 'tdn_01');
    expect(tdn01!.stop_names).toEqual({ ja: '新庚申塚', en: 'Shin-koshinzuka' });
  });

  it('excludes location_type=1 stops (parent stations filtered until UI supports grouping)', () => {
    const fixture = createFixtureV2();
    const merged = mergeSourcesV2([fixture]);
    const station = merged.stops.find((s) => s.stop_id === 'sta_parent');
    expect(station).toBeUndefined();
    for (const s of merged.stops) {
      expect(s.location_type).toBe(0);
    }
  });

  it('builds routeMap from v2 routes', () => {
    const fixture = createFixtureV2();
    const merged = mergeSourcesV2([fixture]);
    expect(merged.routeMap.size).toBe(5);
    const subway = merged.routeMap.get('route_subway');
    expect(subway).toBeDefined();
    expect(subway!.route_type).toBe(1);
    expect(subway!.agency_id).toBe('test:agency');
  });

  it('builds agencyMap with translations', () => {
    const fixture = createFixtureV2();
    const merged = mergeSourcesV2([fixture]);
    expect(merged.agencyMap.size).toBe(2);
    const agency = merged.agencyMap.get('test:agency');
    expect(agency!.agency_names).toEqual({ ja: 'テスト事業者', en: 'Test Agency' });
  });

  it('normalizes curated agency colors when building agencyMap', () => {
    const fixture = createFixtureV2();
    fixture.data.agency.data[0].i = 'minkuru:8000020130001';
    const merged = mergeSourcesV2([fixture]);
    const agency = merged.agencyMap.get('minkuru:8000020130001');
    expect(agency).toBeDefined();
    expect(agency!.agency_colors[0]).toEqual({ bg: '009F40', text: 'FFFFFF' });
  });

  it('builds resolvedPatterns from tripPatterns', () => {
    const fixture = createFixtureV2();
    const merged = mergeSourcesV2([fixture]);
    expect(merged.resolvedPatterns.size).toBe(13);
    const subN = merged.resolvedPatterns.get('tp_sub_n');
    expect(subN).toBeDefined();
    expect(subN!.route.route_id).toBe('route_subway');
    expect(subN!.headsign).toBe('Nishi-takashimadaira');
  });

  it('builds stopRouteTypeMap via tripPattern FK', () => {
    const fixture = createFixtureV2();
    const merged = mergeSourcesV2([fixture]);
    expect(merged.stopRouteTypeMap.get('sub_02')).toEqual([1, 3]);
    expect(merged.stopRouteTypeMap.get('tdn_04')).toEqual([0, 2]);
  });

  it('builds stopsMetaMap with agencies via tripPattern -> route -> agency', () => {
    const fixture = createFixtureV2();
    const merged = mergeSourcesV2([fixture]);
    const meta = merged.stopsMetaMap.get('bus_01');
    expect(meta).toBeDefined();
    const ids = meta!.agencies.map((a) => a.agency_id).sort();
    expect(ids).toEqual(['test:agency', 'test:partner']);
  });

  it('builds sourceMeta from feedInfo', () => {
    const fixture = createFixtureV2();
    const merged = mergeSourcesV2([fixture]);
    expect(merged.sourceMetas).toHaveLength(1);
    expect(merged.sourceMetas[0].id).toBe('test');
    expect(merged.sourceMetas[0].validity.startDate).toBe('20260101');
  });

  it('merges lookup data', () => {
    const fixture = createFixtureV2();
    const merged = mergeSourcesV2([fixture]);
    expect(merged.lookup).toBeDefined();
  });

  it('converts v2 optional stop fields (wb, ps, pc)', () => {
    const fixture = createFixtureV2();
    const merged = mergeSourcesV2([fixture]);

    const bus01 = merged.stops.find((s) => s.stop_id === 'bus_01');
    expect(bus01).toBeDefined();
    expect(bus01!.wheelchair_boarding).toBe(1);
    expect(bus01!.parent_station).toBe('sta_parent');
    expect(bus01!.platform_code).toBe('1');

    const bus03 = merged.stops.find((s) => s.stop_id === 'bus_03');
    expect(bus03).toBeDefined();
    expect(bus03!.wheelchair_boarding).toBe(2);
    expect(bus03!.parent_station).toBeUndefined();
    expect(bus03!.platform_code).toBeUndefined();

    const tdn01 = merged.stops.find((s) => s.stop_id === 'tdn_01');
    expect(tdn01).toBeDefined();
    expect(tdn01!.wheelchair_boarding).toBeUndefined();
    expect(tdn01!.parent_station).toBeUndefined();
    expect(tdn01!.platform_code).toBeUndefined();
  });

  it('converts TripPatternJson to app-internal TripPattern with object array stops', () => {
    const fixture = createFixtureV2();
    const merged = mergeSourcesV2([fixture]);

    const pattern = merged.tripPatterns.get('tp_sub_n');
    expect(pattern).toBeDefined();
    expect(pattern!.route_id).toBe('route_subway');
    expect(pattern!.headsign).toBe('Nishi-takashimadaira');
    expect(pattern!.stops).toEqual([{ id: 'sub_01' }, { id: 'sub_02' }, { id: 'sub_03' }]);
    expect(pattern!.direction).toBe(0);

    const patternM = merged.tripPatterns.get('tp_sub_m');
    expect(patternM).toBeDefined();
    expect(patternM!.direction).toBe(1);

    const busPattern = merged.tripPatterns.get('tp_bus_o');
    expect(busPattern).toBeDefined();
    expect(busPattern!.direction).toBeUndefined();

    const emptyH = merged.tripPatterns.get('tp_ptr_e');
    expect(emptyH).toBeDefined();
    expect(emptyH!.headsign).toBe('');
    expect(emptyH!.stops).toEqual([{ id: 'bus_01' }]);
  });

  it('preserves stop_headsign (sh) in TripPattern.stops', () => {
    const merged = mergeSourcesV2([createFixtureV2()]);
    const pattern = merged.tripPatterns.get('tp_ptr_sh');
    expect(pattern).toBeDefined();
    expect(pattern!.headsign).toBe('');
    expect(pattern!.stops).toEqual([
      { id: 'bus_01', headsign: 'Oji-eki via Park' },
      { id: 'bus_02', headsign: 'Oji-eki' },
    ]);
  });

  it('preserves stop_headsign alongside non-empty trip_headsign', () => {
    const merged = mergeSourcesV2([createFixtureV2()]);
    const pattern = merged.tripPatterns.get('tp_bus_sh');
    expect(pattern).toBeDefined();
    expect(pattern!.headsign).toBe('Oji-eki via All Stops');
    expect(pattern!.stops[0]).toEqual({ id: 'bus_01', headsign: 'Oji-eki via All Stops' });
    expect(pattern!.stops[1]).toEqual({ id: 'bus_02', headsign: 'Oji-eki' });
    expect(pattern!.stops[2]).toEqual({ id: 'bus_03' });
  });
});
