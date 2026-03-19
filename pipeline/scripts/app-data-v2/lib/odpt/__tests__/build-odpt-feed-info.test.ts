/**
 * Tests for v2-build-odpt-feed-info.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type { Provider } from '../../../../../types/resource-common';
import { buildFeedInfoV2 } from '../build-feed-info';

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

  it('handles leap year date (Feb 29 -> Feb 28 next year)', () => {
    const result = buildFeedInfoV2('2024-02-29', TEST_PROVIDER);
    // 2025-02-29 does not exist, so it should clamp to 2025-02-28
    expect(result.s).toBe('20240229');
    expect(result.e).toBe('20250228');
  });

  it('returns empty string for pu when provider has no URL', () => {
    const providerNoUrl: Provider = {
      name: {
        ja: { long: 'テスト交通', short: 'テスト' },
        en: { long: 'Test Transit', short: 'Test' },
      },
      // url is undefined
    };

    const result = buildFeedInfoV2('2025-06-15', providerNoUrl);
    expect(result.pu).toBe('');
    expect(result.pn).toBe('テスト交通');
  });
});
