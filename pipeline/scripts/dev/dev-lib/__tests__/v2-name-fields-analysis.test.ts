import { describe, expect, it } from 'vitest';

import {
  analyzeDataBundleSource,
  analyzeFieldCounts,
  buildAnalysisReport,
  buildFieldCountRows,
  formatFieldCountsTsv,
  formatSourceAnalysis,
} from '../v2-name-fields-analysis';
import type { DataBundle } from '../../../../../src/types/data/transit-v2-json';

function createTestBundle(overrides?: Partial<DataBundle>): DataBundle {
  return {
    bundle_version: 2,
    kind: 'data',
    stops: {
      v: 2,
      data: [
        { v: 2, i: 'stop:a', n: 'Stop A', a: 0, o: 0, l: 0 },
        { v: 2, i: 'stop:b', n: '', a: 0, o: 0, l: 0 },
      ],
    },
    routes: {
      v: 2,
      data: [
        {
          v: 2,
          i: 'route:1',
          s: 'R1',
          l: 'Route 1',
          t: 3,
          c: '000000',
          tc: 'FFFFFF',
          ai: 'agency:1',
        },
        {
          v: 2,
          i: 'route:2',
          s: '',
          l: 'Route 2',
          t: 3,
          c: '000000',
          tc: 'FFFFFF',
          ai: 'agency:1',
        },
      ],
    },
    agency: {
      v: 2,
      data: [
        {
          v: 2,
          i: 'agency:1',
          n: 'Agency One',
          u: 'https://example.com',
          tz: 'Asia/Tokyo',
          l: 'ja',
        },
      ],
    },
    calendar: { v: 1, data: { services: [], exceptions: [] } },
    feedInfo: {
      v: 1,
      data: {
        pn: 'Test',
        pu: 'https://example.com',
        l: 'ja',
        s: '20260301',
        e: '20260331',
        v: '1',
      },
    },
    timetable: { v: 2, data: {} },
    tripPatterns: {
      v: 2,
      data: {
        'pattern:1': { v: 2, r: 'route:1', h: 'To A', stops: [{ id: 'stop:a' }] },
        'pattern:2': { v: 2, r: 'route:2', h: '', stops: [{ id: 'stop:b' }] },
      },
    },
    translations: {
      v: 1,
      data: {
        agency_names: { 'agency:1': { en: 'Agency One' } },
        route_long_names: { 'route:1': { en: 'Route 1' } },
        route_short_names: {},
        stop_names: { 'stop:a': { en: 'Stop A' }, 'stop:b': { en: '' } },
        trip_headsigns: { 'To A': { en: 'To A' }, Empty: { en: '' } },
        stop_headsigns: { 'Stop A': { en: 'Stop A' } },
      },
    },
    lookup: { v: 2, data: { routeUrls: {}, stopDescs: {}, routeDescs: {} } },
    ...overrides,
  } as DataBundle;
}

describe('analyzeFieldCounts', () => {
  it('counts the fixed target inventory against V2 JSON', () => {
    const counts = analyzeFieldCounts(createTestBundle());

    expect(counts).toContainEqual({ field: 'routes.s', nonEmpty: 1, empty: 1 });
    expect(counts).toContainEqual({ field: 'routes.l', nonEmpty: 2, empty: 0 });
    expect(counts).toContainEqual({ field: 'tripPatterns.h', nonEmpty: 1, empty: 1 });
    expect(counts).toContainEqual({
      field: 'translations.trip_headsigns',
      nonEmpty: 1,
      empty: 1,
    });
    expect(counts).toContainEqual({
      field: 'translations.route_long_names',
      nonEmpty: 1,
      empty: 0,
    });
    expect(counts).toContainEqual({
      field: 'translations.route_short_names',
      nonEmpty: 0,
      empty: 0,
    });
    expect(counts).toContainEqual({ field: 'trips.trip_short_name', nonEmpty: 0, empty: 0 });
    expect(counts).toContainEqual({ field: 'stops.tts_stop_name', nonEmpty: 0, empty: 0 });
  });
});

describe('analyzeDataBundleSource', () => {
  it('wraps field counts with source metadata', () => {
    const result = analyzeDataBundleSource('test', '/tmp/test/data.json', createTestBundle());

    expect(result.source).toBe('test');
    expect(result.bundlePath).toBe('/tmp/test/data.json');
    expect(result.fieldCounts).toContainEqual({
      field: 'agency.n',
      nonEmpty: 1,
      empty: 0,
    });
  });
});

describe('report builders', () => {
  it('builds source-level JSON and TSV outputs', () => {
    const first = analyzeDataBundleSource('alpha', '/tmp/alpha/data.json', createTestBundle());
    const second = analyzeDataBundleSource(
      'beta',
      '/tmp/beta/data.json',
      createTestBundle({
        routes: {
          v: 2,
          data: [
            {
              v: 2,
              i: 'route:x',
              s: '',
              l: 'Only Long',
              t: 3,
              c: '000000',
              tc: 'FFFFFF',
              ai: 'agency:1',
            },
          ],
        },
      }),
    );

    const report = buildAnalysisReport([first, second], '/public/data-v2', '/build/data-v2');
    const rows = buildFieldCountRows([first, second]);
    const fieldTsv = formatFieldCountsTsv([first, second]);

    expect(report.meta.sourceCount).toBe(2);
    expect(report.sources[0]?.fieldCounts).toContainEqual({
      field: 'routes.s',
      nonEmpty: 1,
      empty: 1,
    });
    expect(rows).toContainEqual({
      source: 'alpha',
      field: 'routes.l',
      nonEmpty: 2,
      empty: 0,
    });
    expect(rows).toContainEqual({
      source: 'beta',
      field: 'trips.jp_trip_desc',
      nonEmpty: 0,
      empty: 0,
    });
    expect(fieldTsv).toContain('source\tfield\tnonEmpty\tempty');
    expect(fieldTsv).toContain('alpha\troutes.s\t1\t1');
    expect(fieldTsv).toContain('alpha\ttrips.trip_short_name\t0\t0');
  });
});

describe('formatSourceAnalysis', () => {
  it('formats simple per-field count lines', () => {
    const result = analyzeDataBundleSource('test', '/tmp/test/data.json', createTestBundle());
    const output = formatSourceAnalysis(result);

    expect(output).toContain('=== test ===');
    expect(output).toContain('routes.s: nonEmpty=1, empty=1');
    expect(output).toContain('translations.route_long_names: nonEmpty=1, empty=0');
    expect(output).toContain('translations.route_short_names: nonEmpty=0, empty=0');
    expect(output).toContain('trips.jp_trip_desc_symbol: nonEmpty=0, empty=0');
  });
});
