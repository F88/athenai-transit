/**
 * Tests for gtfs-csv-converter.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import {
  GTFS_JP_LEGACY_TRANSLATION_HEADERS,
  GTFS_TRANSLATABLE_FIELDS,
  convertGtfsJpLegacyTranslationRow,
  isGtfsJpLegacyTranslationsHeader,
  normalizeGtfsJpLegacyLanguageCode,
  type GtfsJpLegacyTranslationSets,
} from './gtfs-csv-converter';

describe('isGtfsJpLegacyTranslationsHeader', () => {
  it('matches the exact 3-column legacy header', () => {
    expect(isGtfsJpLegacyTranslationsHeader(['trans_id', 'lang', 'translation'])).toBe(true);
  });

  it('matches the exported constant', () => {
    expect(isGtfsJpLegacyTranslationsHeader([...GTFS_JP_LEGACY_TRANSLATION_HEADERS])).toBe(true);
  });

  it('rejects the standard 6-column header', () => {
    expect(
      isGtfsJpLegacyTranslationsHeader([
        'table_name',
        'field_name',
        'language',
        'translation',
        'record_id',
        'field_value',
      ]),
    ).toBe(false);
  });

  it('rejects a column-order swap', () => {
    expect(isGtfsJpLegacyTranslationsHeader(['lang', 'trans_id', 'translation'])).toBe(false);
  });

  it('rejects extra columns', () => {
    expect(isGtfsJpLegacyTranslationsHeader(['trans_id', 'lang', 'translation', 'extra'])).toBe(
      false,
    );
  });

  it('rejects missing columns', () => {
    expect(isGtfsJpLegacyTranslationsHeader(['trans_id', 'lang'])).toBe(false);
  });

  it('rejects an empty header array', () => {
    expect(isGtfsJpLegacyTranslationsHeader([])).toBe(false);
  });
});

/**
 * Build a `GtfsJpLegacyTranslationSets` from a plain object mapping
 * `${table}.${field}` -> string values, for test convenience.
 */
function makeSets(entries: Record<string, string[]>): GtfsJpLegacyTranslationSets {
  const m = new Map<string, Set<string>>();
  for (const [k, vs] of Object.entries(entries)) {
    m.set(k, new Set(vs));
  }
  return { byTableField: m };
}

describe('GTFS_TRANSLATABLE_FIELDS', () => {
  it('lists exactly the 28 translatable (table, field) pairs', () => {
    expect(GTFS_TRANSLATABLE_FIELDS).toHaveLength(28);
  });

  it('includes stops.stop_name as the highest-priority stops entry', () => {
    const stopsEntries = GTFS_TRANSLATABLE_FIELDS.filter((e) => e.table === 'stops');
    expect(stopsEntries[0]).toEqual({ table: 'stops', field: 'stop_name' });
  });

  it('uses the GTFS spec spelling reversed_signposted_as (not reverse_)', () => {
    const pathwaysFields = GTFS_TRANSLATABLE_FIELDS.filter((e) => e.table === 'pathways').map(
      (e) => e.field,
    );
    expect(pathwaysFields).toContain('reversed_signposted_as');
    expect(pathwaysFields).not.toContain('reverse_signposted_as');
  });

  it('contains no duplicate (table, field) pairs', () => {
    const keys = GTFS_TRANSLATABLE_FIELDS.map((e) => `${e.table}.${e.field}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('convertGtfsJpLegacyTranslationRow', () => {
  // The classic case: trans_id matches one stop_name, no overlap with
  // other fields.
  it('emits one stops.stop_name row for a stop-only trans_id', () => {
    const sets = makeSets({ 'stops.stop_name': ['新宿駅西口'] });
    expect(
      convertGtfsJpLegacyTranslationRow(
        { trans_id: '新宿駅西口', lang: 'en', translation: 'Shinjuku Sta. West Exit' },
        sets,
      ),
    ).toEqual([
      {
        table_name: 'stops',
        field_name: 'stop_name',
        language: 'en',
        translation: 'Shinjuku Sta. West Exit',
        field_value: '新宿駅西口',
      },
    ]);
  });

  it('emits one routes.route_long_name row for a route-only trans_id', () => {
    const sets = makeSets({
      'routes.route_long_name': ['吉祥寺営業所前〜吉祥寺駅(2〜6番線)'],
    });
    expect(
      convertGtfsJpLegacyTranslationRow(
        {
          trans_id: '吉祥寺営業所前〜吉祥寺駅(2〜6番線)',
          lang: 'en',
          translation: 'Kichijoji Eigyosho Mae - Kichijoji Sta. (2-6)',
        },
        sets,
      ),
    ).toEqual([
      {
        table_name: 'routes',
        field_name: 'route_long_name',
        language: 'en',
        translation: 'Kichijoji Eigyosho Mae - Kichijoji Sta. (2-6)',
        field_value: '吉祥寺営業所前〜吉祥寺駅(2〜6番線)',
      },
    ]);
  });

  it('emits one trips.trip_headsign row for a headsign-only trans_id', () => {
    const sets = makeSets({ 'trips.trip_headsign': ['東予港'] });
    expect(
      convertGtfsJpLegacyTranslationRow(
        { trans_id: '東予港', lang: 'en', translation: 'Toyo Port' },
        sets,
      ),
    ).toEqual([
      {
        table_name: 'trips',
        field_name: 'trip_headsign',
        language: 'en',
        translation: 'Toyo Port',
        field_value: '東予港',
      },
    ]);
  });

  it('emits one stop_times.stop_headsign row for a stop_headsign-only trans_id', () => {
    const sets = makeSets({ 'stop_times.stop_headsign': ['吉祥寺駅(神代植物公園前)'] });
    expect(
      convertGtfsJpLegacyTranslationRow(
        {
          trans_id: '吉祥寺駅(神代植物公園前)',
          lang: 'ko',
          translation: '기치조지역',
        },
        sets,
      ),
    ).toEqual([
      {
        table_name: 'stop_times',
        field_name: 'stop_headsign',
        language: 'ko',
        translation: '기치조지역',
        field_value: '吉祥寺駅(神代植物公園前)',
      },
    ]);
  });

  it('emits one routes.route_short_name row for a route_short_name-only trans_id', () => {
    const sets = makeSets({ 'routes.route_short_name': ['鶴11'] });
    expect(
      convertGtfsJpLegacyTranslationRow(
        { trans_id: '鶴11', lang: 'en', translation: 'Tsuru 11' },
        sets,
      ),
    ).toEqual([
      {
        table_name: 'routes',
        field_name: 'route_short_name',
        language: 'en',
        translation: 'Tsuru 11',
        field_value: '鶴11',
      },
    ]);
  });

  it('emits one agency.agency_name row for an agency-only trans_id', () => {
    const sets = makeSets({ 'agency.agency_name': ['小田急バス株式会社'] });
    expect(
      convertGtfsJpLegacyTranslationRow(
        { trans_id: '小田急バス株式会社', lang: 'en', translation: 'Odakyu Bus Co., Ltd.' },
        sets,
      ),
    ).toEqual([
      {
        table_name: 'agency',
        field_name: 'agency_name',
        language: 'en',
        translation: 'Odakyu Bus Co., Ltd.',
        field_value: '小田急バス株式会社',
      },
    ]);
  });

  // Multi-emit: the central improvement of the value-based design.
  it('emits one row per matching table when a trans_id matches stop_name AND stop_headsign', () => {
    // 'あざみ野駅' — a terminal stop that is also the destination
    // headsign for trips terminating there. Both translations must
    // succeed at lookup time.
    const sets = makeSets({
      'stops.stop_name': ['あざみ野駅'],
      'stop_times.stop_headsign': ['あざみ野駅'],
    });
    expect(
      convertGtfsJpLegacyTranslationRow(
        { trans_id: 'あざみ野駅', lang: 'en', translation: 'Azamino Sta.' },
        sets,
      ),
    ).toEqual([
      {
        table_name: 'stops',
        field_name: 'stop_name',
        language: 'en',
        translation: 'Azamino Sta.',
        field_value: 'あざみ野駅',
      },
      {
        table_name: 'stop_times',
        field_name: 'stop_headsign',
        language: 'en',
        translation: 'Azamino Sta.',
        field_value: 'あざみ野駅',
      },
    ]);
  });

  it('emits one row per matching table when a trans_id matches stop_name AND trip_headsign', () => {
    // The exact data-loss scenario in 4 ferry sources before this
    // refactor: e.g. orange-ferry stop 'Toyo' that also appears as a
    // trip_headsign.
    const sets = makeSets({
      'stops.stop_name': ['東予'],
      'trips.trip_headsign': ['東予'],
    });
    const result = convertGtfsJpLegacyTranslationRow(
      { trans_id: '東予', lang: 'en', translation: 'Toyo' },
      sets,
    );
    expect(result).toHaveLength(2);
    expect(result.map((r) => `${r.table_name}.${r.field_name}`)).toEqual([
      'stops.stop_name',
      'trips.trip_headsign',
    ]);
  });

  it('emits rows in the GTFS_TRANSLATABLE_FIELDS declared order when matching multiple tables', () => {
    // Build sets matching a value across stops, routes, trips, and
    // stop_times to verify ordering.
    const sets = makeSets({
      'stops.stop_name': ['共通名'],
      'routes.route_long_name': ['共通名'],
      'trips.trip_headsign': ['共通名'],
      'stop_times.stop_headsign': ['共通名'],
    });
    const result = convertGtfsJpLegacyTranslationRow(
      { trans_id: '共通名', lang: 'en', translation: 'Common' },
      sets,
    );
    expect(result.map((r) => `${r.table_name}.${r.field_name}`)).toEqual([
      'stops.stop_name',
      'routes.route_long_name',
      'trips.trip_headsign',
      'stop_times.stop_headsign',
    ]);
  });

  it('normalizes ja-HrKt to ja-Hrkt on every emitted row', () => {
    const sets = makeSets({
      'stops.stop_name': ['吉祥寺駅'],
      'stop_times.stop_headsign': ['吉祥寺駅'],
    });
    const result = convertGtfsJpLegacyTranslationRow(
      { trans_id: '吉祥寺駅', lang: 'ja-HrKt', translation: 'きちじょうじえき' },
      sets,
    );
    expect(result.map((r) => r.language)).toEqual(['ja-Hrkt', 'ja-Hrkt']);
  });

  it('passes uncommon languages through unchanged', () => {
    const sets = makeSets({ 'stops.stop_name': ['新宿駅西口'] });
    const result = convertGtfsJpLegacyTranslationRow(
      { trans_id: '新宿駅西口', lang: 'zh-cn', translation: '新宿站西口' },
      sets,
    );
    expect(result[0]?.language).toBe('zh-cn');
  });

  it('trims surrounding whitespace from each field before classifying', () => {
    const sets = makeSets({ 'stops.stop_name': ['新宿駅西口'] });
    expect(
      convertGtfsJpLegacyTranslationRow(
        { trans_id: '  新宿駅西口  ', lang: ' en ', translation: '  Shinjuku Sta. West Exit  ' },
        sets,
      ),
    ).toEqual([
      {
        table_name: 'stops',
        field_name: 'stop_name',
        language: 'en',
        translation: 'Shinjuku Sta. West Exit',
        field_value: '新宿駅西口',
      },
    ]);
  });

  it('returns an empty array when trans_id does not match any set (orphan row)', () => {
    const sets = makeSets({ 'stops.stop_name': ['新宿駅西口'] });
    expect(
      convertGtfsJpLegacyTranslationRow(
        { trans_id: '存在しない名前', lang: 'en', translation: 'X' },
        sets,
      ),
    ).toEqual([]);
  });

  it('returns an empty array when the sets map is empty', () => {
    expect(
      convertGtfsJpLegacyTranslationRow(
        { trans_id: '新宿駅西口', lang: 'en', translation: 'X' },
        { byTableField: new Map() },
      ),
    ).toEqual([]);
  });

  it('returns an empty array when trans_id is empty', () => {
    const sets = makeSets({ 'stops.stop_name': ['新宿駅西口'] });
    expect(
      convertGtfsJpLegacyTranslationRow({ trans_id: '', lang: 'en', translation: 'X' }, sets),
    ).toEqual([]);
  });

  it('returns an empty array when lang is empty', () => {
    const sets = makeSets({ 'stops.stop_name': ['新宿駅西口'] });
    expect(
      convertGtfsJpLegacyTranslationRow(
        { trans_id: '新宿駅西口', lang: '', translation: 'X' },
        sets,
      ),
    ).toEqual([]);
  });

  it('returns an empty array when translation is empty', () => {
    const sets = makeSets({ 'stops.stop_name': ['新宿駅西口'] });
    expect(
      convertGtfsJpLegacyTranslationRow(
        { trans_id: '新宿駅西口', lang: 'en', translation: '' },
        sets,
      ),
    ).toEqual([]);
  });

  it('returns an empty array when fields are whitespace-only', () => {
    const sets = makeSets({ 'stops.stop_name': ['新宿駅西口'] });
    expect(
      convertGtfsJpLegacyTranslationRow({ trans_id: '   ', lang: 'en', translation: 'X' }, sets),
    ).toEqual([]);
  });

  it('matches pathways.reversed_signposted_as when present (not the typo reverse_)', () => {
    const sets = makeSets({ 'pathways.reversed_signposted_as': ['Concourse'] });
    const result = convertGtfsJpLegacyTranslationRow(
      { trans_id: 'Concourse', lang: 'ja', translation: 'コンコース' },
      sets,
    );
    expect(result).toEqual([
      {
        table_name: 'pathways',
        field_name: 'reversed_signposted_as',
        language: 'ja',
        translation: 'コンコース',
        field_value: 'Concourse',
      },
    ]);
  });

  it('ignores byTableField keys that are not in GTFS_TRANSLATABLE_FIELDS (spec-foreign)', () => {
    // Even if the caller mistakenly provides sets for a non-spec key,
    // the converter must only emit rows for entries it knows about.
    const sets: GtfsJpLegacyTranslationSets = {
      byTableField: new Map([
        // spec-foreign: not in GTFS_TRANSLATABLE_FIELDS at all
        ['unknown.field', new Set(['XXX'])],
        // spec-foreign: existing table but column not in our scope
        ['stops.invalid_column', new Set(['XXX'])],
        // spec-foreign: legacy typo we explicitly excluded
        ['pathways.reverse_signposted_as', new Set(['XXX'])],
      ]),
    };
    expect(
      convertGtfsJpLegacyTranslationRow({ trans_id: 'XXX', lang: 'en', translation: 'X' }, sets),
    ).toEqual([]);
  });
});

describe('convertGtfsJpLegacyTranslationRow — full GTFS_TRANSLATABLE_FIELDS coverage', () => {
  // Data-driven: assert that every (table, field) pair declared in
  // GTFS_TRANSLATABLE_FIELDS is actually classified by the converter
  // when its set contains the trans_id. This guards against a future
  // entry being added to GTFS_TRANSLATABLE_FIELDS without the
  // classification logic noticing it.
  for (const { table, field } of GTFS_TRANSLATABLE_FIELDS) {
    it(`emits a single row for a trans_id matching only ${table}.${field}`, () => {
      const sets = makeSets({ [`${table}.${field}`]: ['SAMPLE_VALUE'] });
      const result = convertGtfsJpLegacyTranslationRow(
        { trans_id: 'SAMPLE_VALUE', lang: 'en', translation: 'sample translation' },
        sets,
      );
      expect(result).toEqual([
        {
          table_name: table,
          field_name: field,
          language: 'en',
          translation: 'sample translation',
          field_value: 'SAMPLE_VALUE',
        },
      ]);
    });
  }

  it('emits one row per matching field in GTFS_TRANSLATABLE_FIELDS declared order when ALL match', () => {
    // Construct sets where every translatable column contains the
    // same trans_id; the converter should emit one row per field, in
    // exactly the declared order — including pairings that are far
    // apart (e.g. agency.agency_url early, attributions.* at the end).
    const sets: GtfsJpLegacyTranslationSets = {
      byTableField: new Map(
        GTFS_TRANSLATABLE_FIELDS.map(({ table, field }) => [
          `${table}.${field}`,
          new Set(['UNIVERSAL']),
        ]),
      ),
    };
    const result = convertGtfsJpLegacyTranslationRow(
      { trans_id: 'UNIVERSAL', lang: 'ja', translation: 'ユニバーサル' },
      sets,
    );
    expect(result).toHaveLength(GTFS_TRANSLATABLE_FIELDS.length);
    expect(result.map((r) => `${r.table_name}.${r.field_name}`)).toEqual(
      GTFS_TRANSLATABLE_FIELDS.map(({ table, field }) => `${table}.${field}`),
    );
    // All rows share the same value/lang/translation
    for (const row of result) {
      expect(row.field_value).toBe('UNIVERSAL');
      expect(row.language).toBe('ja');
      expect(row.translation).toBe('ユニバーサル');
    }
  });

  it('preserves declared order when only non-adjacent fields match (agency.agency_url + attributions.organization_name)', () => {
    // Pick two fields that sit at very different positions in the
    // declared order — agency.agency_url is near the top,
    // attributions.organization_name is near the bottom — to confirm
    // the order is anchored to GTFS_TRANSLATABLE_FIELDS and not just
    // the iteration order of the input Map.
    const sets = makeSets({
      'attributions.organization_name': ['MIXED'],
      'agency.agency_url': ['MIXED'],
    });
    const result = convertGtfsJpLegacyTranslationRow(
      { trans_id: 'MIXED', lang: 'en', translation: 'X' },
      sets,
    );
    expect(result.map((r) => `${r.table_name}.${r.field_name}`)).toEqual([
      'agency.agency_url',
      'attributions.organization_name',
    ]);
  });
});

describe('normalizeGtfsJpLegacyLanguageCode', () => {
  it('maps the legacy ja-HrKt to the BCP 47 ja-Hrkt', () => {
    expect(normalizeGtfsJpLegacyLanguageCode('ja-HrKt')).toBe('ja-Hrkt');
  });

  it('returns ja unchanged', () => {
    expect(normalizeGtfsJpLegacyLanguageCode('ja')).toBe('ja');
  });

  it('returns en unchanged', () => {
    expect(normalizeGtfsJpLegacyLanguageCode('en')).toBe('en');
  });

  it('returns the already-normalized ja-Hrkt unchanged', () => {
    expect(normalizeGtfsJpLegacyLanguageCode('ja-Hrkt')).toBe('ja-Hrkt');
  });

  it('passes unknown codes through unchanged', () => {
    expect(normalizeGtfsJpLegacyLanguageCode('fr')).toBe('fr');
    expect(normalizeGtfsJpLegacyLanguageCode('zh-Hant')).toBe('zh-Hant');
  });
});
