/**
 * Tests for v2-build-odpt-routes.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type { OdptRailway } from '../../../types/odpt-train';
import type { Provider } from '../../../types/resource-common';
import { buildRoutesV2 } from '../lib/odpt/build-routes';

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
});
