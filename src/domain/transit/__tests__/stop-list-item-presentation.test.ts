import { describe, expect, it } from 'vitest';

import { makeStop } from '../../../__tests__/helpers';
import type { Agency } from '../../../types/app/transit';
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

function makeMeta(): StopWithMeta {
  return {
    stop: {
      ...makeStop('A'),
      stop_name: 'Fallback Name',
      stop_names: { en: 'Resolved Name' },
      agency_id: 'agency-1',
      platform_code: '2',
    },
    agencies: [makeAgency()],
    routes: [],
  };
}

describe('buildStopListItemPresentationFromMeta', () => {
  it('builds display props from the latest stop metadata', () => {
    const result = buildStopListItemPresentationFromMeta({
      meta: makeMeta(),
      routeTypes: [3],
      fallbackDisplayName: 'History Name',
      dataLang: ['en'],
      themeBackground: '#FFFFFF',
    });

    expect(result.displayName).toBe('Resolved Name');
    expect(result.routeTypes).toEqual([3]);
    expect(result.platformCode).toBe('2');
    expect(result.agencyBadges).toEqual([
      expect.objectContaining({
        key: 'agency-1',
        label: 'TB',
        bgColor: '#E60013',
        fgColor: '#FFFFFF',
      }),
    ]);
    expect(result.agencyBadges[0].borderColor).toEqual(expect.any(String));
  });

  it('falls back to the provided display name when stop name resolution is empty', () => {
    const meta = makeMeta();
    meta.stop.stop_name = '';
    meta.stop.stop_names = {};

    const result = buildStopListItemPresentationFromMeta({
      meta,
      routeTypes: [0, 3],
      fallbackDisplayName: 'Snapshot Name',
      dataLang: ['ja'],
      themeBackground: '#FFFFFF',
    });

    expect(result.displayName).toBe('Snapshot Name');
    expect(result.routeTypes).toEqual([0, 3]);
  });

  it('returns a copied routeTypes array instead of reusing the caller array', () => {
    const routeTypes = [3] as const;

    const result = buildStopListItemPresentationFromMeta({
      meta: makeMeta(),
      routeTypes,
      fallbackDisplayName: 'History Name',
      dataLang: ['en'],
      themeBackground: '#FFFFFF',
    });

    expect(result.routeTypes).toEqual([3]);
    expect(result.routeTypes).not.toBe(routeTypes);
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
      displayName: 'Stored Stop',
      routeTypes: [2, 3],
      platformCode: 'A',
      agencyBadges: [
        {
          key: '0:京都市バス',
          label: '京都市バス',
        },
      ],
    });
    expect(result.routeTypes).not.toBe(snapshot.routeTypes);
  });
});
