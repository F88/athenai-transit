/**
 * Tests for v2-build-odpt-feed-info.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type { Provider } from '../../../types/resource-common';
import { buildFeedInfoV2 } from '../lib/v2-build-odpt-feed-info';

const TEST_PROVIDER: Provider = {
  name: {
    ja: { long: 'テスト交通', short: 'テスト' },
    en: { long: 'Test Transit', short: 'Test' },
  },
  url: 'https://example.com',
};

describe('buildFeedInfoV2', () => {
  it('builds feed info from issued date and provider', () => {
    const result = buildFeedInfoV2('2025-04-01', TEST_PROVIDER);
    expect(result).toEqual({
      pn: 'テスト交通',
      pu: 'https://example.com',
      l: 'ja',
      s: '20250401',
      e: '20260401',
      v: '2025-04-01',
    });
  });
});
