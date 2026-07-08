import { describe, expect, it } from 'vitest';
import settings from '../data-source-settings';

const expectedIds = [
  'toko',
  'tokyo-23-wards-community-bus-group',
  'toei-bus',
  'toei-train',
  'yurikamome',
  'kanto-bus',
  'keio-bus',
  'chiyoda-bus',
  'chuo-bus',
  'suginami-gsm',
  'seibu-bus',
  'iyotetsu-bus',
  'kita-bus',
  'kyoto-city-bus',
  // 'kyoto-city-subway',
  'kyoto-bus',
  'odakyu-bus',
  'oshima-bus',
  'miyake-bus',
  'keisei-transit-bus',
  'nishi-tokyo-bus',
  'mir-train',
  // 'keio-train',
  // 'tobu-train',
  'nagoya-srt',
  'tama-monorail',
  'twr-rinkai',
  'tokyometro',
  'yokohama-municipal-subway',
  'yokohama-municipal-bus',
  'kawasaki-city-bus',
  'rinko-bus',
  'hachiko-bus',
  'chii-bus',
  'actv-nav',
  'tokyo-cruise-ship',
  'sanwa-shosen',
  'tokai-kisen',
  'kagoshima-maritime-bureau',
  'okushiri-ferry',
  'orange-ferry',
  'uwajima-unyu',
  'meimon-taiyo-ferry',
  'itsukishima-kisen',
  'vag-freiburg',
  'hankyu-ferry',
  'meguro-c-bus',
  'shinagawa-c-bus',
  'ota-c-bus',
  'bunkyo-c-bus',
  'taito-c-bus',
  'itabashi-rin2-bus',
] as const;

describe('data-source-settings', () => {
  it('matches the expected source-group count', () => {
    expect(settings).toHaveLength(expectedIds.length);
  });

  it('matches the expected source-group ids regardless of order', () => {
    expect([...new Set(settings.map((group) => group.id))].sort()).toEqual(
      [...new Set(expectedIds)].sort(),
    );
  });

  it('has unique ids across all groups', () => {
    const ids = settings.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique prefixes within each group (cross-group overlap is allowed by design)', () => {
    // SourceGroup intentionally permits the same prefix to appear in
    // multiple groups (e.g., a `toko` bundle group whose `prefixes`
    // overlaps with both `toei-bus` and `toei-train`). Only within a
    // single group's `prefixes` array must values be unique.
    for (const group of settings) {
      expect(new Set(group.prefixes).size).toBe(group.prefixes.length);
    }
  });

  it('every group has at least one country code', () => {
    for (const group of settings) {
      expect(group.countries.length).toBeGreaterThan(0);
    }
  });

  it('every country code is uppercase ISO 3166-1 alpha-2', () => {
    for (const group of settings) {
      for (const code of group.countries) {
        expect(code).toMatch(/^[A-Z]{2}$/);
      }
    }
  });
});
