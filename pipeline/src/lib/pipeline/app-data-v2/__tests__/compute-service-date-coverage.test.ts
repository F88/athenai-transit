/**
 * Tests for compute-service-date-coverage.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type { DataBundle } from '@contracts/data/transit-v2-json';

import { computeServiceDateCoverage } from '../compute-service-date-coverage';

function makeBundle(): DataBundle {
  return {
    bundle_version: 3,
    kind: 'data',
    stops: {
      v: 2,
      data: [{ v: 2, i: 'test:S1', n: 'Stop 1', a: 35.1, o: 139.1, l: 0 }],
    },
    routes: {
      v: 2,
      data: [
        {
          v: 2,
          i: 'test:R1',
          s: '1',
          l: 'Route 1',
          t: 3,
          c: 'FFFFFF',
          tc: '000000',
          ai: 'test:A1',
        },
      ],
    },
    agency: {
      v: 2,
      data: [{ v: 2, i: 'test:A1', n: 'Agency', u: 'https://example.com', tz: 'Asia/Tokyo' }],
    },
    calendar: {
      v: 1,
      data: {
        services: [{ i: 'svc:wd', s: '20260501', e: '20260507', d: [1, 1, 1, 1, 1, 0, 0] }],
        exceptions: [],
      },
    },
    feedInfo: {
      v: 1,
      data: { pn: '', pu: '', l: 'ja', s: '', e: '', v: '' },
    },
    timetable: {
      v: 2,
      data: {
        'test:S1': [
          {
            v: 2,
            tp: 'test:TP1',
            si: 0,
            d: { 'svc:wd': [480, 1500] },
            a: { 'svc:wd': [480, 1500] },
          },
        ],
      },
    },
    tripPatterns: {
      v: 2,
      data: {
        'test:TP1': { v: 2, r: 'test:R1', h: 'Headsign', dir: 0, stops: [{ id: 'test:S1' }] },
      },
    },
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
    lookup: {
      v: 2,
      data: {},
    },
  };
}

describe('computeServiceDateCoverage', () => {
  it('returns serviceDateCounts and operatingDates from active services', () => {
    const bundle = makeBundle();

    expect(computeServiceDateCoverage(bundle)).toEqual({
      serviceDateCounts: [
        { serviceDate: '20260501', tripCount: 2 },
        { serviceDate: '20260504', tripCount: 2 },
        { serviceDate: '20260505', tripCount: 2 },
        { serviceDate: '20260506', tripCount: 2 },
        { serviceDate: '20260507', tripCount: 2 },
      ],
      operatingDates: {
        first: '20260501',
        last: '20260507',
        count: 5,
      },
    });
  });

  it('ignores non-origin timetable groups and supports exception-only services', () => {
    const bundle = makeBundle();
    bundle.calendar.data.services = [];
    bundle.calendar.data.exceptions = [{ i: 'svc:x', d: '20260503', t: 1 }];
    bundle.timetable.data['test:S1'] = [
      {
        v: 2,
        tp: 'test:TP1',
        si: 1,
        d: { 'svc:x': [501, 601] },
        a: { 'svc:x': [501, 601] },
      },
      {
        v: 2,
        tp: 'test:TP1',
        si: 0,
        d: { 'svc:x': [500] },
        a: { 'svc:x': [500] },
      },
    ];

    expect(computeServiceDateCoverage(bundle)).toEqual({
      serviceDateCounts: [{ serviceDate: '20260503', tripCount: 1 }],
      operatingDates: {
        first: '20260503',
        last: '20260503',
        count: 1,
      },
    });
  });

  it('sums trip counts from multiple active services on the same service date', () => {
    const bundle = makeBundle();
    bundle.calendar.data.services = [
      { i: 'svc:a', s: '20260504', e: '20260506', d: [1, 1, 1, 0, 0, 0, 0] },
      { i: 'svc:b', s: '20260505', e: '20260507', d: [0, 1, 1, 1, 0, 0, 0] },
    ];
    bundle.timetable.data['test:S1'] = [
      {
        v: 2,
        tp: 'test:TP1',
        si: 0,
        d: {
          'svc:a': [480],
          'svc:b': [600, 720],
        },
        a: {
          'svc:a': [480],
          'svc:b': [600, 720],
        },
      },
    ];

    expect(computeServiceDateCoverage(bundle)).toEqual({
      serviceDateCounts: [
        { serviceDate: '20260504', tripCount: 1 },
        { serviceDate: '20260505', tripCount: 3 },
        { serviceDate: '20260506', tripCount: 3 },
        { serviceDate: '20260507', tripCount: 2 },
      ],
      operatingDates: {
        first: '20260504',
        last: '20260507',
        count: 4,
      },
    });
  });

  it('excludes dates removed by calendar exceptions', () => {
    const bundle = makeBundle();
    bundle.calendar.data.services = [
      { i: 'svc:wd', s: '20260504', e: '20260506', d: [1, 1, 1, 0, 0, 0, 0] },
    ];
    bundle.calendar.data.exceptions = [{ i: 'svc:wd', d: '20260505', t: 2 }];
    bundle.timetable.data['test:S1'] = [
      {
        v: 2,
        tp: 'test:TP1',
        si: 0,
        d: { 'svc:wd': [480, 540] },
        a: { 'svc:wd': [480, 540] },
      },
    ];

    expect(computeServiceDateCoverage(bundle)).toEqual({
      serviceDateCounts: [
        { serviceDate: '20260504', tripCount: 2 },
        { serviceDate: '20260506', tripCount: 2 },
      ],
      operatingDates: {
        first: '20260504',
        last: '20260506',
        count: 2,
      },
    });
  });

  it('returns empty output when no active date has trips', () => {
    const bundle = makeBundle();
    bundle.timetable.data['test:S1'] = [];

    expect(computeServiceDateCoverage(bundle)).toEqual({
      serviceDateCounts: [],
      operatingDates: {
        first: null,
        last: null,
        count: 0,
      },
    });
  });
});
