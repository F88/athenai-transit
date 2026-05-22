import { describe, expect, it } from 'vitest';

import { makeRoute, makeStop } from '../../../__tests__/helpers';
import type { Agency, AppRouteTypeValue } from '../../../types/app/transit';
import type { StopWithMeta } from '../../../types/app/transit-composed';
import {
  buildStopListItemPresentationFromHistorySnapshot,
  buildStopListItemPresentationFromMeta,
} from '../stop-list-item-presentation';

function makeAgency(overrides: Partial<Agency> = {}): Agency {
  return {
    agency_id: 'agency-1',
    agency_name: 'Transit Bus',
    agency_long_name: 'Transit Bus Company',
    agency_short_name: 'TB',
    agency_names: {},
    agency_long_names: {},
    agency_short_names: {},
    agency_url: 'https://example.com',
    agency_lang: 'ja',
    agency_timezone: 'Asia/Tokyo',
    agency_fare_url: '',
    agency_colors: [{ bg: 'E60013', text: 'FFFFFF' }],
    ...overrides,
  };
}

function makeMeta(routeTypes: AppRouteTypeValue[] = [3]): StopWithMeta {
  return {
    stop: {
      ...makeStop('A'),
      stop_name: 'Fallback Name',
      stop_names: { en: 'Resolved Name' },
      agency_id: 'agency-1',
      platform_code: '2',
    },
    agencies: [makeAgency()],
    routes: routeTypes.map((routeType, index) => makeRoute(`route-${index}`, routeType)),
  };
}

describe('buildStopListItemPresentationFromMeta', () => {
  it('builds display props from the latest stop metadata', () => {
    const result = buildStopListItemPresentationFromMeta({
      meta: makeMeta(),
      dataLang: ['en'],
      themeBackground: '#FFFFFF',
    });

    expect(result.name).toBe('Resolved Name');
    expect(result.routeTypes).toEqual([3]);
    expect(result.platformCode).toBe('2');
    expect(result.agencies).toEqual([
      expect.objectContaining({
        key: 'agency-1',
        name: 'TB',
        bgColor: '#E60013',
        fgColor: '#FFFFFF',
      }),
    ]);
    expect(result.agencies[0].borderColor).toEqual(expect.any(String));
  });

  it('falls back to the provided display name when stop name resolution is empty', () => {
    const meta = makeMeta();
    meta.stop.stop_name = '';
    meta.stop.stop_names = {};
    meta.routes = [makeRoute('route-0', 0), makeRoute('route-1', 3)];

    const result = buildStopListItemPresentationFromMeta({
      meta,
      dataLang: ['ja'],
      themeBackground: '#FFFFFF',
    });

    expect(result.name).toBe('?');
    expect(result.routeTypes).toEqual([0, 3]);
  });

  it('returns route types derived from the stop meta routes', () => {
    const result = buildStopListItemPresentationFromMeta({
      meta: makeMeta(),
      dataLang: ['en'],
      themeBackground: '#FFFFFF',
    });

    expect(result.routeTypes).toEqual([3]);
  });

  it.each([
    { input: [0] as AppRouteTypeValue[], expected: [0] },
    { input: [1] as AppRouteTypeValue[], expected: [1] },
    { input: [2] as AppRouteTypeValue[], expected: [2] },
    { input: [0, 1, 2] as AppRouteTypeValue[], expected: [0, 1, 2] },
    { input: [3, 1, 3, 0] as AppRouteTypeValue[], expected: [0, 1, 3] },
  ])('derives deduplicated sorted route types from meta.routes: $input', ({ input, expected }) => {
    const result = buildStopListItemPresentationFromMeta({
      meta: makeMeta(input),
      dataLang: ['en'],
      themeBackground: '#FFFFFF',
    });

    expect(result.routeTypes).toEqual(expected);
  });
});

describe('buildStopListItemPresentationFromHistorySnapshot', () => {
  it('builds minimal list item props from a stored history snapshot', () => {
    const snapshot = {
      stopId: 'stored',
      name: 'Stored Stop',
      lat: 35,
      lon: 139,
      routeTypes: [2, 3] as const,
      agencyNames: ['京都市バス'],
      platformCode: 'A',
    };

    const result = buildStopListItemPresentationFromHistorySnapshot(snapshot);

    expect(result).toEqual({
      name: 'Stored Stop',
      routeTypes: [2, 3],
      platformCode: 'A',
      agencies: [
        {
          key: '0:京都市バス',
          name: '京都市バス',
          bgColor: 'var(--color-muted)',
          fgColor: 'var(--color-muted-foreground)',
          borderColor: 'var(--color-border)',
        },
      ],
    });
    expect(result.routeTypes).not.toBe(snapshot.routeTypes);
  });
});
