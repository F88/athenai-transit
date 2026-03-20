/**
 * Tests for v2-build-odpt-agency.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type { Provider } from '../../../../../src/types/resource-common';
import { buildAgencyV2 } from '../build-agency';

const TEST_PROVIDER: Provider = {
  name: {
    ja: { long: 'テスト交通', short: 'テスト' },
    en: { long: 'Test Transit', short: 'Test' },
  },
  url: 'https://example.com',
};

describe('buildAgencyV2', () => {
  it('builds agency from provider info', () => {
    const result = buildAgencyV2('yrkm', TEST_PROVIDER);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      i: 'yrkm:Test Transit',
      n: 'テスト交通',
      sn: 'テスト',
      u: 'https://example.com',
      l: 'ja',
      tz: 'Asia/Tokyo',
      fu: '',
      cs: [],
    });
  });

  it('includes provider colors', () => {
    const provider: Provider = {
      ...TEST_PROVIDER,
      colors: [{ bg: '00B2E5', text: 'FFFFFF' }],
    };
    const result = buildAgencyV2('test', provider);
    expect(result[0].cs).toEqual([{ b: '00B2E5', t: 'FFFFFF' }]);
  });

  it('returns empty string for url when provider has no URL', () => {
    const provider: Provider = {
      name: {
        ja: { long: 'テスト', short: 'テスト' },
        en: { long: 'Test', short: 'Test' },
      },
    };
    const result = buildAgencyV2('test', provider);
    expect(result[0].u).toBe('');
  });

  it('includes multiple brand colors in order', () => {
    const provider: Provider = {
      ...TEST_PROVIDER,
      colors: [
        { bg: 'FF0000', text: 'FFFFFF' },
        { bg: '0000FF', text: 'FFFFFF' },
      ],
    };
    const result = buildAgencyV2('test', provider);
    expect(result[0].cs).toEqual([
      { b: 'FF0000', t: 'FFFFFF' },
      { b: '0000FF', t: 'FFFFFF' },
    ]);
  });
});
