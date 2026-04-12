/**
 * Tests for v2-build-odpt-agency.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type { Provider } from '../../../../../types/resource-common';
import { buildAgencyV2 } from '../build-agency';

const TEST_PROVIDER: Provider = {
  name: {
    ja: { long: 'テスト交通', short: 'テスト' },
    en: { long: 'Test Transit', short: 'Test' },
  },
  url: 'https://example.com',
  colors: [{ bg: '000000', text: 'FFFFFF' }],
};

describe('buildAgencyV2', () => {
  it('builds agency from provider info', () => {
    const result = buildAgencyV2('yrkm', TEST_PROVIDER);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      v: 2,
      i: 'yrkm:Test',
      n: '',
      u: '',
      tz: 'Asia/Tokyo',
      l: 'ja',
    });
  });

  it('uses provider.name.en.short for agency_id', () => {
    const provider: Provider = {
      name: {
        ja: { long: 'テスト鉄道', short: 'テスト' },
        en: { long: 'Test Railway', short: 'TRW' },
      },
      url: 'https://example.com',
      colors: [{ bg: '00B2E5', text: 'FFFFFF' }],
    };
    const result = buildAgencyV2('test', provider);
    expect(result[0].i).toBe('test:TRW');
  });

  it('emits empty strings for name and url (managed on App side)', () => {
    const result = buildAgencyV2('test', TEST_PROVIDER);
    expect(result[0].n).toBe('');
    expect(result[0].u).toBe('');
  });

  it('sets default timezone and language', () => {
    const result = buildAgencyV2('test', TEST_PROVIDER);
    expect(result[0].tz).toBe('Asia/Tokyo');
    expect(result[0].l).toBe('ja');
  });
});
