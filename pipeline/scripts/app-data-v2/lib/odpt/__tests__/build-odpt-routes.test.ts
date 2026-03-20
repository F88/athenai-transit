/**
 * Tests for v2-build-odpt-routes.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type { OdptRailway } from '../../../../../src/types/odpt-train';
import type { Provider } from '../../../../../src/types/resource-common';
import { buildRoutesV2 } from '../build-routes';

const TEST_PROVIDER: Provider = {
  name: {
    ja: { long: 'テスト交通', short: 'テスト' },
    en: { long: 'Test Transit', short: 'Test' },
  },
};

function makeRailway(
  overrides: Partial<OdptRailway> & Pick<OdptRailway, 'odpt:lineCode' | 'odpt:stationOrder'>,
): OdptRailway {
  return {
    'dc:date': '2025-01-01',
    'dc:title': 'Test Railway',
    'odpt:color': '#00B2E5',
    'odpt:railwayTitle': { ja: 'テスト線', en: 'Test Line' },
    ...overrides,
  };
}

describe('buildRoutesV2', () => {
  it('builds a route with v:2', () => {
    const railway = makeRailway({
      'odpt:lineCode': 'U',
      'odpt:railwayTitle': { ja: 'ゆりかもめ', en: 'Yurikamome' },
      'odpt:color': '#00B2E5',
      'odpt:stationOrder': [],
    });

    const result = buildRoutesV2('yrkm', railway, TEST_PROVIDER);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      v: 2,
      i: 'yrkm:U',
      s: '',
      l: 'ゆりかもめ',
      t: 2,
      c: '00B2E5',
      tc: '',
      ai: 'yrkm:Test Transit',
    });
  });

  it('strips # prefix from color', () => {
    const railway = makeRailway({
      'odpt:lineCode': 'M',
      'odpt:color': '#FF5500',
      'odpt:stationOrder': [],
    });

    const result = buildRoutesV2('test', railway, TEST_PROVIDER);
    expect(result[0].c).toBe('FF5500');
  });

  it('produces one route per railway call (multiple railways produce multiple routes)', () => {
    const railwayA = makeRailway({
      'odpt:lineCode': 'A',
      'odpt:railwayTitle': { ja: 'A線', en: 'Line A' },
      'odpt:stationOrder': [],
    });
    const railwayB = makeRailway({
      'odpt:lineCode': 'B',
      'odpt:railwayTitle': { ja: 'B線', en: 'Line B' },
      'odpt:stationOrder': [],
    });

    const resultA = buildRoutesV2('test', railwayA, TEST_PROVIDER);
    const resultB = buildRoutesV2('test', railwayB, TEST_PROVIDER);
    const combined = [...resultA, ...resultB];

    expect(combined).toHaveLength(2);
    expect(combined[0].i).toBe('test:A');
    expect(combined[0].l).toBe('A線');
    expect(combined[1].i).toBe('test:B');
    expect(combined[1].l).toBe('B線');
  });
});
