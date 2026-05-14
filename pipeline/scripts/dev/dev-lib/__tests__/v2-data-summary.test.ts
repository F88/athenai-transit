import { describe, expect, it } from 'vitest';

import {
  V2_DATA_VOLUME_SECTION_NAMES,
  V2_DATA_VOLUME_SECTIONS,
  analyzeV2DataVolume,
  formatBytes,
} from '../v2-data-summary';
import type { DataBundle } from '../../../../../src/types/data/transit-v2-json';

/**
 * Smoke tests for the DataBundle sub lib. The combined formatter
 * lives in v2-outputs-summary, so here we exercise the analyse
 * function, the byte formatter, and each section's render in
 * isolation.
 */

function createDataBundle(overrides?: Partial<DataBundle>): DataBundle {
  return {
    bundle_version: 3,
    kind: 'data',
    stops: {
      v: 2,
      data: [
        { v: 2, i: 'src:s1', n: 'Stop One', a: 35.0, o: 139.0, l: 0 },
        { v: 2, i: 'src:s2', n: 'Stop Two', a: 35.1, o: 139.1, l: 0 },
      ],
    },
    routes: {
      v: 2,
      data: [{ v: 2, i: 'src:r1', s: 'R1', l: 'Route 1', t: 3, c: '', tc: '', ai: 'src:a1' }],
    },
    agency: {
      v: 2,
      data: [{ v: 2, i: 'src:a1', n: 'Agency 1', u: 'https://example.com', tz: 'Asia/Tokyo' }],
    },
    calendar: {
      v: 1,
      data: {
        services: [{ i: 'src:wd', d: [1, 1, 1, 1, 1, 0, 0], s: '20260101', e: '20261231' }],
        exceptions: [{ i: 'src:wd', d: '20260101', t: 1 }],
      },
    },
    feedInfo: {
      v: 1,
      data: {
        pn: 'Test Publisher',
        pu: 'https://example.com',
        l: 'ja',
        s: '20260101',
        e: '20261231',
        v: '1.0',
      },
    },
    timetable: {
      v: 2,
      data: {
        'src:p1': [
          { v: 2, tp: 'src:p1', si: 0, d: { 'src:wd': [600] }, a: { 'src:wd': [600] } },
          { v: 2, tp: 'src:p1', si: 1, d: { 'src:wd': [605] }, a: { 'src:wd': [605] } },
        ],
        'src:p2': [{ v: 2, tp: 'src:p2', si: 0, d: { 'src:wd': [700] }, a: { 'src:wd': [700] } }],
      },
    },
    tripPatterns: {
      v: 2,
      data: {
        'src:p1': { v: 2, r: 'src:r1', h: 'A', stops: [] },
        'src:p2': { v: 2, r: 'src:r1', h: 'B', stops: [] },
      },
    },
    translations: {
      v: 1,
      data: {
        agency_names: { 'src:a1': { en: 'Agency 1' } },
        route_long_names: {},
        route_short_names: {},
        stop_names: { 'src:s1': { en: 'Stop One' }, 'src:s2': { en: 'Stop Two' } },
        trip_headsigns: {},
        stop_headsigns: {},
      },
    },
    lookup: {
      v: 2,
      data: {
        stopUrls: { 'src:s1': 'https://example.com/s1' },
        routeUrls: { 'src:r1': 'https://example.com/r1' },
      },
    },
    ...overrides,
  };
}

describe('analyzeV2DataVolume', () => {
  it('counts one number per DataBundle top-level section', () => {
    const stats = analyzeV2DataVolume({
      prefix: 'src',
      nameEn: 'Src Transit',
      dataBundle: createDataBundle(),
      fileSizes: { data: 1000, insights: 200, shapes: 300, total: 1500 },
      gzipSizes: { data: 400, insights: 80, shapes: 120, total: 600 },
    });
    expect(stats.prefix).toBe('src');
    expect(stats.fileSizes.total).toBe(1500);
    expect(stats.gzipSizes.total).toBe(600);
    // Array .data → array length:
    expect(stats.counts.stops).toBe(2);
    expect(stats.counts.routes).toBe(1);
    expect(stats.counts.agency).toBe(1);
    // Record .data → keys count:
    expect(stats.counts.timetable).toBe(2);
    expect(stats.counts.tripPatterns).toBe(2);
    // Plain-object .data → top-level keys count (mechanical):
    expect(stats.counts.calendar).toBe(2); // services + exceptions
    expect(stats.counts.feedInfo).toBe(6); // pn / pu / l / s / e / v
    expect(stats.counts.translations).toBe(6); // 6 translation maps
    expect(stats.counts.lookup).toBe(2); // stopUrls + routeUrls (stopDescs omitted)
  });

  it('excludes bundle_version and kind from the counts result', () => {
    const stats = analyzeV2DataVolume({
      prefix: 'src',
      nameEn: 'Src Transit',
      dataBundle: createDataBundle(),
      fileSizes: { data: 100, insights: 0, shapes: null, total: 100 },
      gzipSizes: { data: 50, insights: 0, shapes: null, total: 50 },
    });
    expect(stats.counts).not.toHaveProperty('bundle_version');
    expect(stats.counts).not.toHaveProperty('kind');
  });

  it('reports nested-object counts by their TOP-LEVEL keys, not inner contents', () => {
    // Empty inner maps do NOT drop the top-level count — translations
    // still reports 6 (the number of named maps), lookup reports 0
    // because the lookup container itself is the empty object {}.
    const bundle = createDataBundle({
      translations: {
        v: 1,
        data: {
          agency_names: {},
          route_long_names: {},
          route_short_names: {},
          stop_names: {},
          trip_headsigns: {},
          stop_headsigns: {},
        },
      },
      lookup: { v: 2, data: {} },
    });
    const stats = analyzeV2DataVolume({
      prefix: 'src',
      nameEn: 'Src Transit',
      dataBundle: bundle,
      fileSizes: { data: 100, insights: 0, shapes: null, total: 100 },
      gzipSizes: { data: 50, insights: 0, shapes: null, total: 50 },
    });
    expect(stats.counts.translations).toBe(6);
    expect(stats.counts.lookup).toBe(0);
    expect(stats.fileSizes.shapes).toBeNull();
  });
});

describe('formatBytes', () => {
  it('renders byte boundaries with adaptive units', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.50 MB');
  });

  it('returns a dash for null (missing file)', () => {
    expect(formatBytes(null)).toBe('-');
  });
});

describe('feed-info summary', () => {
  it('extracts publisher / lang / feed validity from feedInfo only', () => {
    const stats = analyzeV2DataVolume({
      prefix: 'src',
      nameEn: 'Src Transit',
      dataBundle: createDataBundle(),
      fileSizes: { data: 100, insights: 0, shapes: null, total: 100 },
      gzipSizes: { data: 50, insights: 0, shapes: null, total: 50 },
    });
    expect(stats.feedInfo.publisher).toBe('Test Publisher');
    expect(stats.feedInfo.lang).toBe('ja');
    expect(stats.feedInfo.feedStart).toBe('20260101');
    expect(stats.feedInfo.feedEnd).toBe('20261231');
  });
});

describe('periods summary', () => {
  it('echoes feedValidity and computes servicePeriod / exceptionRange from calendar', () => {
    const stats = analyzeV2DataVolume({
      prefix: 'src',
      nameEn: 'Src Transit',
      dataBundle: createDataBundle(),
      fileSizes: { data: 100, insights: 0, shapes: null, total: 100 },
      gzipSizes: { data: 50, insights: 0, shapes: null, total: 50 },
    });
    expect(stats.periods.feedStart).toBe('20260101');
    expect(stats.periods.feedEnd).toBe('20261231');
    expect(stats.periods.serviceStart).toBe('20260101');
    expect(stats.periods.serviceEnd).toBe('20261231');
    // fixture has 1 exception at d='20260101':
    expect(stats.periods.exceptionStart).toBe('20260101');
    expect(stats.periods.exceptionEnd).toBe('20260101');
  });

  it('returns null axes when corresponding sections are empty', () => {
    const bundle = createDataBundle({
      calendar: { v: 1, data: { services: [], exceptions: [] } },
    });
    const stats = analyzeV2DataVolume({
      prefix: 'src',
      nameEn: 'Src Transit',
      dataBundle: bundle,
      fileSizes: { data: 100, insights: 0, shapes: null, total: 100 },
      gzipSizes: { data: 50, insights: 0, shapes: null, total: 50 },
    });
    expect(stats.periods.serviceStart).toBeNull();
    expect(stats.periods.serviceEnd).toBeNull();
    expect(stats.periods.exceptionStart).toBeNull();
    expect(stats.periods.exceptionEnd).toBeNull();
    // feedValidity is still populated from feedInfo:
    expect(stats.periods.feedStart).toBe('20260101');
  });

  it('takes min start and max end across multiple service entries', () => {
    const bundle = createDataBundle({
      calendar: {
        v: 1,
        data: {
          services: [
            { i: 'src:wd', d: [1, 1, 1, 1, 1, 0, 0], s: '20260301', e: '20261231' },
            { i: 'src:sa', d: [0, 0, 0, 0, 0, 1, 0], s: '20260101', e: '20260930' },
            { i: 'src:su', d: [0, 0, 0, 0, 0, 0, 1], s: '20260415', e: '20270101' },
          ],
          exceptions: [
            { i: 'src:wd', d: '20260501', t: 2 },
            { i: 'src:wd', d: '20271231', t: 1 },
          ],
        },
      },
    });
    const stats = analyzeV2DataVolume({
      prefix: 'src',
      nameEn: 'Src Transit',
      dataBundle: bundle,
      fileSizes: { data: 100, insights: 0, shapes: null, total: 100 },
      gzipSizes: { data: 50, insights: 0, shapes: null, total: 50 },
    });
    expect(stats.periods.serviceStart).toBe('20260101');
    expect(stats.periods.serviceEnd).toBe('20270101');
    expect(stats.periods.exceptionStart).toBe('20260501');
    expect(stats.periods.exceptionEnd).toBe('20271231');
  });
});

describe('stops summary', () => {
  it('captures count, location_type, bbox, wheelchair_boarding, and parent_station coverage', () => {
    const bundle = createDataBundle({
      stops: {
        v: 2,
        data: [
          // Child stop with parent_station, wheelchair_boarding=1, platform_code.
          {
            v: 2,
            i: 'src:s1',
            n: 'Platform A',
            a: 35.5,
            o: 139.5,
            l: 0,
            wb: 1,
            ps: 'src:st',
            pc: '1',
          },
          // Child stop with parent_station, wheelchair_boarding=2 (not accessible).
          { v: 2, i: 'src:s2', n: 'Platform B', a: 35.6, o: 139.6, l: 0, wb: 2, ps: 'src:st' },
          // Standalone stop without parent_station.
          { v: 2, i: 'src:s3', n: 'Stop C', a: 35.55, o: 139.55, l: 0 },
          // Station (parent itself).
          { v: 2, i: 'src:st', n: 'Station', a: 35.55, o: 139.55, l: 1 },
        ],
      },
      lookup: {
        v: 2,
        data: {
          stopUrls: { 'src:s1': 'https://example.com/s1', 'src:s2': 'https://example.com/s2' },
          stopDescs: { 'src:s1': 'Near the railway transfer' },
        },
      },
    });
    const stats = analyzeV2DataVolume({
      prefix: 'src',
      nameEn: 'Src Transit',
      dataBundle: bundle,
      fileSizes: { data: 100, insights: 0, shapes: null, total: 100 },
      gzipSizes: { data: 50, insights: 0, shapes: null, total: 50 },
    });
    expect(stats.stops.count).toBe(4);
    expect(stats.stops.locationTypeCounts).toEqual({ '0': 3, '1': 1 });
    expect(stats.stops.bbox).toEqual({
      latMin: 35.5,
      latMax: 35.6,
      lonMin: 139.5,
      lonMax: 139.6,
    });
    // Only s1 has wheelchair_boarding=1; s2 (wb=2) and the rest are excluded.
    expect(stats.stops.wheelchairAccessibleCount).toBe(1);
    // s1 and s2 reference a parent_station; s3 and the station itself do not.
    expect(stats.stops.withParentCount).toBe(2);
    // Only s1 carries platform_code.
    expect(stats.stops.withPlatformCodeCount).toBe(1);
    // stop_desc / stop_url counts come from the lookup section entries.
    expect(stats.stops.withStopDescCount).toBe(1);
    expect(stats.stops.withStopUrlCount).toBe(2);
  });

  it('returns null bbox and zero counts for an empty stops array', () => {
    const bundle = createDataBundle({
      stops: { v: 2, data: [] },
      // Empty lookup so the supplementary-field counts are also zero.
      lookup: { v: 2, data: {} },
    });
    const stats = analyzeV2DataVolume({
      prefix: 'src',
      nameEn: 'Src Transit',
      dataBundle: bundle,
      fileSizes: { data: 100, insights: 0, shapes: null, total: 100 },
      gzipSizes: { data: 50, insights: 0, shapes: null, total: 50 },
    });
    expect(stats.stops.count).toBe(0);
    expect(stats.stops.locationTypeCounts).toEqual({});
    expect(stats.stops.bbox).toBeNull();
    expect(stats.stops.wheelchairAccessibleCount).toBe(0);
    expect(stats.stops.withParentCount).toBe(0);
    expect(stats.stops.withPlatformCodeCount).toBe(0);
    expect(stats.stops.withStopDescCount).toBe(0);
    expect(stats.stops.withStopUrlCount).toBe(0);
  });

  it('renders sub-sections (Location types / Hierarchy / Accessibility / Geography) plus Summary', () => {
    const stats = analyzeV2DataVolume({
      prefix: 'src',
      nameEn: 'Src Transit',
      dataBundle: createDataBundle(),
      fileSizes: { data: 100, insights: 0, shapes: null, total: 100 },
      gzipSizes: { data: 50, insights: 0, shapes: null, total: 50 },
    });
    const body = V2_DATA_VOLUME_SECTIONS.stops.render([stats]);
    expect(body).toContain('### Summary');
    expect(body).toContain('### Location types');
    expect(body).toContain('### Hierarchy');
    expect(body).toContain('### Accessibility');
    expect(body).toContain('### Supplementary fields');
    expect(body).toContain('### Geography');
    expect(body).toContain('locationTypes');
    expect(body).toContain('latRange');
    expect(body).toContain('wheelchairAccessible');
    expect(body).toContain('withParent');
    expect(body).toContain('withPlatformCode');
    expect(body).toContain('withStopDesc');
    expect(body).toContain('withStopUrl');
  });
});

describe('routes summary', () => {
  it('captures count, route_type distribution, and per-facet coverage', () => {
    const stats = analyzeV2DataVolume({
      prefix: 'src',
      nameEn: 'Src Transit',
      dataBundle: createDataBundle(),
      fileSizes: { data: 100, insights: 0, shapes: null, total: 100 },
      gzipSizes: { data: 50, insights: 0, shapes: null, total: 50 },
    });
    // Fixture has 1 route: t=3 (bus), s='R1', l='Route 1', c='', tc='', no desc.
    expect(stats.routes.count).toBe(1);
    expect(stats.routes.typeCounts).toEqual({ '3': 1 });
    expect(stats.routes.withShortName).toBe(1);
    expect(stats.routes.withLongName).toBe(1);
    expect(stats.routes.withColor).toBe(0);
    expect(stats.routes.withTextColor).toBe(0);
    expect(stats.routes.withDesc).toBe(0);
  });

  it('counts mixed route_type values and each facet independently', () => {
    const bundle = createDataBundle({
      routes: {
        v: 2,
        data: [
          // short + long + color + textColor + desc
          {
            v: 2,
            i: 'src:r1',
            s: 'R1',
            l: 'Route 1',
            t: 3,
            c: 'FF0000',
            tc: '000000',
            ai: 'src:a1',
            desc: 'first route',
          },
          // short only, no color
          { v: 2, i: 'src:r2', s: 'R2', l: '', t: 3, c: '', tc: '', ai: 'src:a1' },
          // long only, color only (no text color)
          {
            v: 2,
            i: 'src:r3',
            s: '',
            l: 'Route 3',
            t: 2,
            c: '00FF00',
            tc: '',
            ai: 'src:a1',
          },
          // short + long, color + textColor
          {
            v: 2,
            i: 'src:r4',
            s: 'R4',
            l: 'Route 4',
            t: 1,
            c: '0000FF',
            tc: 'FFFFFF',
            ai: 'src:a1',
          },
        ],
      },
    });
    const stats = analyzeV2DataVolume({
      prefix: 'src',
      nameEn: 'Src Transit',
      dataBundle: bundle,
      fileSizes: { data: 100, insights: 0, shapes: null, total: 100 },
      gzipSizes: { data: 50, insights: 0, shapes: null, total: 50 },
    });
    expect(stats.routes.count).toBe(4);
    expect(stats.routes.typeCounts).toEqual({ '1': 1, '2': 1, '3': 2 });
    // r1, r2, r4 have non-empty s → 3
    expect(stats.routes.withShortName).toBe(3);
    // r1, r3, r4 have non-empty l → 3
    expect(stats.routes.withLongName).toBe(3);
    // r1, r3, r4 have non-empty c → 3
    expect(stats.routes.withColor).toBe(3);
    // r1, r4 have non-empty tc → 2
    expect(stats.routes.withTextColor).toBe(2);
    // only r1 has desc → 1
    expect(stats.routes.withDesc).toBe(1);
  });

  it('returns zeros when the routes array is empty', () => {
    const bundle = createDataBundle({ routes: { v: 2, data: [] } });
    const stats = analyzeV2DataVolume({
      prefix: 'src',
      nameEn: 'Src Transit',
      dataBundle: bundle,
      fileSizes: { data: 100, insights: 0, shapes: null, total: 100 },
      gzipSizes: { data: 50, insights: 0, shapes: null, total: 50 },
    });
    expect(stats.routes.count).toBe(0);
    expect(stats.routes.typeCounts).toEqual({});
    expect(stats.routes.withShortName).toBe(0);
    expect(stats.routes.withLongName).toBe(0);
    expect(stats.routes.withColor).toBe(0);
    expect(stats.routes.withTextColor).toBe(0);
    expect(stats.routes.withDesc).toBe(0);
  });

  it('renders sub-sections (Route types / Naming / Colors / Description) plus Summary', () => {
    const stats = analyzeV2DataVolume({
      prefix: 'src',
      nameEn: 'Src Transit',
      dataBundle: createDataBundle(),
      fileSizes: { data: 100, insights: 0, shapes: null, total: 100 },
      gzipSizes: { data: 50, insights: 0, shapes: null, total: 50 },
    });
    const body = V2_DATA_VOLUME_SECTIONS.routes.render([stats]);
    expect(body).toContain('### Route types');
    expect(body).toContain('### Naming');
    expect(body).toContain('### Colors');
    expect(body).toContain('### Description');
    expect(body).toContain('### Summary');
    expect(body).toContain('withShortName');
    expect(body).toContain('withTextColor');
    expect(body).toContain('withDesc');
  });
});

describe('trip patterns summary', () => {
  it('captures count, direction_id split, and trip/stop headsign coverage', () => {
    const bundle = createDataBundle({
      tripPatterns: {
        v: 2,
        data: {
          // direction_id=0, trip headsign + stop headsign on a stop.
          'src:p1': {
            v: 2,
            r: 'src:r1',
            h: 'Downtown',
            dir: 0,
            stops: [{ id: 'src:s1', sh: 'Downtown via Center' }],
          },
          // direction_id=1, trip headsign only (no stop_headsign).
          'src:p2': { v: 2, r: 'src:r1', h: 'Uptown', dir: 1, stops: [{ id: 'src:s2' }] },
          // direction_id omitted, trip headsign + a mix of sh / no-sh stops.
          'src:p3': {
            v: 2,
            r: 'src:r1',
            h: 'Loop',
            stops: [{ id: 'src:s1' }, { id: 'src:s2', sh: 'Loop branch' }],
          },
          // direction_id omitted, empty trip headsign, stop_headsign only
          // (the keio-bus convention).
          'src:p4': {
            v: 2,
            r: 'src:r1',
            h: '',
            stops: [{ id: 'src:s1', sh: 'Terminal' }],
          },
        },
      },
    });
    const stats = analyzeV2DataVolume({
      prefix: 'src',
      nameEn: 'Src Transit',
      dataBundle: bundle,
      fileSizes: { data: 100, insights: 0, shapes: null, total: 100 },
      gzipSizes: { data: 50, insights: 0, shapes: null, total: 50 },
    });
    expect(stats.tripPatterns.count).toBe(4);
    expect(stats.tripPatterns.direction0Count).toBe(1);
    expect(stats.tripPatterns.direction1Count).toBe(1);
    // p3 and p4 omit direction_id.
    expect(stats.tripPatterns.directionNoneCount).toBe(2);
    // p1-p3 have a non-empty trip headsign; p4 is empty.
    expect(stats.tripPatterns.withTripHeadsignCount).toBe(3);
    // p1, p3, p4 have at least one stop carrying sh; p2 has none.
    expect(stats.tripPatterns.withStopHeadsignCount).toBe(3);
  });

  it('returns zero counts for an empty tripPatterns record', () => {
    const bundle = createDataBundle({ tripPatterns: { v: 2, data: {} } });
    const stats = analyzeV2DataVolume({
      prefix: 'src',
      nameEn: 'Src Transit',
      dataBundle: bundle,
      fileSizes: { data: 100, insights: 0, shapes: null, total: 100 },
      gzipSizes: { data: 50, insights: 0, shapes: null, total: 50 },
    });
    expect(stats.tripPatterns.count).toBe(0);
    expect(stats.tripPatterns.direction0Count).toBe(0);
    expect(stats.tripPatterns.direction1Count).toBe(0);
    expect(stats.tripPatterns.directionNoneCount).toBe(0);
    expect(stats.tripPatterns.withTripHeadsignCount).toBe(0);
    expect(stats.tripPatterns.withStopHeadsignCount).toBe(0);
  });

  it('renders a single Summary table with every facet column', () => {
    const stats = analyzeV2DataVolume({
      prefix: 'src',
      nameEn: 'Src Transit',
      dataBundle: createDataBundle(),
      fileSizes: { data: 100, insights: 0, shapes: null, total: 100 },
      gzipSizes: { data: 50, insights: 0, shapes: null, total: 50 },
    });
    const body = V2_DATA_VOLUME_SECTIONS['trip-patterns'].render([stats]);
    expect(body).toContain('### Summary');
    expect(body).toContain('directionCounts');
    expect(body).toContain('withTripHeadsign');
    expect(body).toContain('withStopHeadsign');
    // directionCounts breakdown string keeps all three keys.
    expect(body).toContain('none:');
    // Flat section — no detail sub-sections.
    expect(body).not.toContain('### Direction');
    expect(body).not.toContain('### Headsign');
  });
});

describe('i18n-coverage summary', () => {
  it('counts entries per TranslationsJson map and collects language union', () => {
    const stats = analyzeV2DataVolume({
      prefix: 'src',
      nameEn: 'Src Transit',
      dataBundle: createDataBundle(),
      fileSizes: { data: 100, insights: 0, shapes: null, total: 100 },
      gzipSizes: { data: 50, insights: 0, shapes: null, total: 50 },
    });
    // Fixture provides agency_names (1 entry) and stop_names (2 entries), all 'en':
    expect(stats.i18nCoverage.languages).toEqual(['en']);
    expect(stats.i18nCoverage.agencyNames).toBe(1);
    expect(stats.i18nCoverage.routeLongNames).toBe(0);
    expect(stats.i18nCoverage.routeShortNames).toBe(0);
    expect(stats.i18nCoverage.stopNames).toBe(2);
    expect(stats.i18nCoverage.tripHeadsigns).toBe(0);
    expect(stats.i18nCoverage.stopHeadsigns).toBe(0);
  });

  it('unions multiple languages across maps and sorts the result', () => {
    const bundle = createDataBundle({
      translations: {
        v: 1,
        data: {
          agency_names: { 'src:a1': { ja: 'A1', en: 'A1' } },
          route_long_names: {},
          route_short_names: {},
          stop_names: { 'src:s1': { 'zh-Hans': 'S1', en: 'S1' } },
          trip_headsigns: {},
          stop_headsigns: {},
        },
      },
    });
    const stats = analyzeV2DataVolume({
      prefix: 'src',
      nameEn: 'Src Transit',
      dataBundle: bundle,
      fileSizes: { data: 100, insights: 0, shapes: null, total: 100 },
      gzipSizes: { data: 50, insights: 0, shapes: null, total: 50 },
    });
    expect(stats.i18nCoverage.languages).toEqual(['en', 'ja', 'zh-Hans']);
  });

  it('produces an empty array when no translations are present', () => {
    const bundle = createDataBundle({
      translations: {
        v: 1,
        data: {
          agency_names: {},
          route_long_names: {},
          route_short_names: {},
          stop_names: {},
          trip_headsigns: {},
          stop_headsigns: {},
        },
      },
    });
    const stats = analyzeV2DataVolume({
      prefix: 'src',
      nameEn: 'Src Transit',
      dataBundle: bundle,
      fileSizes: { data: 100, insights: 0, shapes: null, total: 100 },
      gzipSizes: { data: 50, insights: 0, shapes: null, total: 50 },
    });
    expect(stats.i18nCoverage.languages).toEqual([]);
    expect(stats.i18nCoverage.agencyNames).toBe(0);
  });
});

describe('agencies summary', () => {
  it('extracts count / names / timezones from agency.data', () => {
    const stats = analyzeV2DataVolume({
      prefix: 'src',
      nameEn: 'Src Transit',
      dataBundle: createDataBundle(),
      fileSizes: { data: 100, insights: 0, shapes: null, total: 100 },
      gzipSizes: { data: 50, insights: 0, shapes: null, total: 50 },
    });
    expect(stats.agencies.count).toBe(1);
    expect(stats.agencies.names).toBe('Agency 1');
    expect(stats.agencies.timezones).toBe('Asia/Tokyo');
  });

  it('joins multiple agency names and dedupes timezones', () => {
    const bundle = createDataBundle({
      agency: {
        v: 2,
        data: [
          { v: 2, i: 'src:a1', n: 'Agency A', u: 'https://a.example.com', tz: 'Asia/Tokyo' },
          { v: 2, i: 'src:a2', n: 'Agency B', u: 'https://b.example.com', tz: 'Asia/Tokyo' },
          { v: 2, i: 'src:a3', n: 'Agency C', u: 'https://c.example.com', tz: 'Europe/Berlin' },
        ],
      },
    });
    const stats = analyzeV2DataVolume({
      prefix: 'src',
      nameEn: 'Src Transit',
      dataBundle: bundle,
      fileSizes: { data: 100, insights: 0, shapes: null, total: 100 },
      gzipSizes: { data: 50, insights: 0, shapes: null, total: 50 },
    });
    expect(stats.agencies.count).toBe(3);
    expect(stats.agencies.names).toBe('Agency A, Agency B, Agency C');
    // Asia/Tokyo dedupes to one entry; Europe/Berlin appears once:
    expect(stats.agencies.timezones).toBe('Asia/Tokyo, Europe/Berlin');
  });
});

describe('V2_DATA_VOLUME_SECTIONS', () => {
  it('orders sections by meta → single → composite', () => {
    expect(V2_DATA_VOLUME_SECTION_NAMES).toEqual([
      'file-sizes',
      'gzip-sizes',
      'counts',
      'feed-info',
      'agencies',
      'routes',
      'stops',
      'trip-patterns',
      'i18n-coverage',
      'periods',
    ]);
  });

  it("each section's render returns a string with a totals row", () => {
    const stats = analyzeV2DataVolume({
      prefix: 'src',
      nameEn: 'Src Transit',
      dataBundle: createDataBundle(),
      fileSizes: { data: 1500, insights: 300, shapes: 200, total: 2000 },
      gzipSizes: { data: 700, insights: 120, shapes: 80, total: 900 },
    });
    for (const name of V2_DATA_VOLUME_SECTION_NAMES) {
      const body = V2_DATA_VOLUME_SECTIONS[name].render([stats]);
      expect(body).toContain('totals');
    }
  });

  it('file-sizes treats a missing insights.json as null without breaking the totals row', () => {
    const missing = analyzeV2DataVolume({
      prefix: 'miss',
      nameEn: 'Missing Insights',
      dataBundle: createDataBundle(),
      fileSizes: { data: 1000, insights: null, shapes: null, total: 1000 },
      gzipSizes: { data: 400, insights: null, shapes: null, total: 400 },
    });
    const present = analyzeV2DataVolume({
      prefix: 'pres',
      nameEn: 'Present Insights',
      dataBundle: createDataBundle(),
      fileSizes: { data: 1000, insights: 500, shapes: null, total: 1500 },
      gzipSizes: { data: 400, insights: 200, shapes: null, total: 600 },
    });
    const body = V2_DATA_VOLUME_SECTIONS['file-sizes'].render([missing, present]);
    expect(body).toContain('Missing Insights');
    // Nullable insights sizes sum cleanly in the totals row: only the
    // present source's 500 B counts (the missing one contributes 0).
    expect(body).toContain('500 B');
  });
});
