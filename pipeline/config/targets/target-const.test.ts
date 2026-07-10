/**
 * Lock tests for the values exported by `target-const.ts`.
 *
 * These target lists drive the batch pipeline (`--targets`), so a structural
 * regression silently skips or breaks sources. In particular, a missing spread
 * (e.g. `...[CONFIG_GTFS_FERRY_TARGETS]` instead of `...CONFIG_GTFS_FERRY_TARGETS`)
 * leaks a nested array in as a single entry, which the batch runner then treats
 * as one comma-joined source name.
 *
 * The tests pin:
 *   1. Structural invariants  - every entry is a plain string, no duplicates.
 *   2. Exact contents         - the full list, order included.
 *
 * When a source is intentionally added/removed, update the expected arrays
 * below to match; a diff here is a deliberate change, not a surprise.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import { CONFIG_GTFS_ALL_TARGETS, PREFIX_ALL_TARGETS } from './target-const';

/** Expected GTFS source-name targets (46, order-locked to match target-const.ts). */
const EXPECTED_GTFS_ALL_TARGETS = [
  'mir-train',
  'tama-monorail',
  'toei-train',
  'tokyometro',
  'twr-rinkai',
  'yokohama-municipal-subway',
  'actv-nav',
  'hankyu-ferry',
  'itsukishima-kisen',
  'kagoshima-maritime-bureau',
  'meimon-taiyo-ferry',
  'okushiri-ferry',
  'orange-ferry',
  'sanwa-shosen',
  'tokai-kisen',
  'tokyo-cruise-ship',
  'uwajima-unyu',
  'bunkyo-c-bus',
  'chii-bus',
  'chiyoda-bus',
  'chuo-bus',
  'hachiko-bus',
  'itabashi-rin2-bus',
  'iyotetsu-bus',
  'kanto-bus',
  'kawasaki-city-bus',
  'keio-bus',
  'keisei-transit-bus',
  'kita-bus',
  'kyoto-bus',
  'kyoto-city-bus',
  'meguro-c-bus',
  'miyake-bus',
  'nagoya-srt',
  'nishi-tokyo-bus',
  'odakyu-bus',
  'oshima-bus',
  'ota-c-bus',
  'rinko-bus',
  'seibu-bus',
  'shinagawa-c-bus',
  'suginami-gsm',
  'taito-c-bus',
  'toei-bus',
  'vag-freiburg',
  'yokohama-municipal-bus',
];

/** Expected prefix targets (47, order-locked to match target-const.ts). */
const EXPECTED_PREFIX_ALL_TARGETS = [
  'mir',
  'tmm',
  'toaran',
  'tome',
  'twrr',
  'yht',
  'yurimo', // Note: Yurikamome is not GTFS but ODPT-Train
  'actvnav',
  'han9fry',
  'itkfry',
  'kcmb',
  'mtfry',
  'oksrif',
  'orgfry',
  'snws',
  'tkksn',
  'tcship',
  'uwjmfry',
  'bgle',
  '13103b',
  'kazag',
  'edobus',
  '85b',
  'rin2',
  'iyt2',
  'ktbus',
  'norufin',
  'kobus',
  'kseiw',
  'kbus',
  'kytbus',
  'kcbus',
  'sanma',
  'mykbus',
  'nsrt',
  'ntbus',
  'od9bus',
  'osmbus',
  'tamachan',
  'rintan',
  'sbbus',
  'shinabus',
  'sggsm',
  'megurin',
  'minkuru',
  'vagfr',
  'yhb',
];

describe('target-const exported lists', () => {
  describe.each([
    {
      name: 'CONFIG_GTFS_ALL_TARGETS',
      actual: CONFIG_GTFS_ALL_TARGETS,
      expected: EXPECTED_GTFS_ALL_TARGETS,
    },
    {
      name: 'PREFIX_ALL_TARGETS',
      actual: PREFIX_ALL_TARGETS,
      expected: EXPECTED_PREFIX_ALL_TARGETS,
    },
  ])('$name', ({ actual, expected }) => {
    // Structural invariants -------------------------------------------------
    it('is a flat array of strings (no nested arrays / non-string entries)', () => {
      expect(Array.isArray(actual)).toBe(true);
      for (const entry of actual) {
        expect(typeof entry).toBe('string');
      }
    });

    it('has no duplicate entries', () => {
      expect(new Set(actual).size).toBe(actual.length);
    });

    // Size lock -------------------------------------------------------------
    it('has the same number of entries as the locked fixture', () => {
      expect(actual).toHaveLength(expected.length);
    });

    // Contents, order-independent (catches add/remove regardless of order) --
    it('contains exactly the locked set of entries (order-independent)', () => {
      expect([...actual].sort()).toEqual([...expected].sort());
    });

    // Contents, order-strict (catches any reordering too) -------------------
    it('matches the locked contents in exact order', () => {
      expect(actual).toEqual(expected);
    });
  });
});
