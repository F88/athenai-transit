/**
 * Tests for gtfs-csv-converter.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import {
  GTFS_JP_LEGACY_TRANSLATION_HEADERS,
  convertGtfsJpLegacyTranslationRow,
  isGtfsJpLegacyTranslationsHeader,
  normalizeGtfsJpLegacyLanguageCode,
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

describe('convertGtfsJpLegacyTranslationRow', () => {
  it('produces a standard 6-column row for a Japanese translation', () => {
    expect(
      convertGtfsJpLegacyTranslationRow({
        trans_id: '八丈島',
        lang: 'ja',
        translation: '八丈島',
      }),
    ).toEqual({
      table_name: 'stops',
      field_name: 'stop_name',
      language: 'ja',
      translation: '八丈島',
      field_value: '八丈島',
    });
  });

  it('produces a standard row for an English translation', () => {
    expect(
      convertGtfsJpLegacyTranslationRow({
        trans_id: '八丈島',
        lang: 'en',
        translation: 'Hachijojima',
      }),
    ).toEqual({
      table_name: 'stops',
      field_name: 'stop_name',
      language: 'en',
      translation: 'Hachijojima',
      field_value: '八丈島',
    });
  });

  it('normalizes the legacy ja-HrKt language tag', () => {
    const row = convertGtfsJpLegacyTranslationRow({
      trans_id: '八丈島',
      lang: 'ja-HrKt',
      translation: 'はちじょうじま',
    });
    expect(row?.language).toBe('ja-Hrkt');
  });

  it('trims surrounding whitespace from each field', () => {
    expect(
      convertGtfsJpLegacyTranslationRow({
        trans_id: '  父島  ',
        lang: ' en ',
        translation: '  Chichijima  ',
      }),
    ).toEqual({
      table_name: 'stops',
      field_name: 'stop_name',
      language: 'en',
      translation: 'Chichijima',
      field_value: '父島',
    });
  });

  it('returns null when trans_id is empty', () => {
    expect(
      convertGtfsJpLegacyTranslationRow({ trans_id: '', lang: 'en', translation: 'X' }),
    ).toBeNull();
  });

  it('returns null when lang is empty', () => {
    expect(
      convertGtfsJpLegacyTranslationRow({ trans_id: 'X', lang: '', translation: 'X' }),
    ).toBeNull();
  });

  it('returns null when translation is empty', () => {
    expect(
      convertGtfsJpLegacyTranslationRow({ trans_id: 'X', lang: 'en', translation: '' }),
    ).toBeNull();
  });

  it('returns null when fields are whitespace-only', () => {
    expect(
      convertGtfsJpLegacyTranslationRow({
        trans_id: '   ',
        lang: 'en',
        translation: 'X',
      }),
    ).toBeNull();
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
