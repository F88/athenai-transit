import { describe, expect, it } from 'vitest';
import { translateAgencyName } from '../translate-agency-name';
import type { Agency } from '../../../../types/app/transit';

function makeAgency(overrides: Partial<Agency> = {}): Agency {
  return {
    agency_id: 'test:agency',
    agency_name: 'テスト交通',
    agency_short_name: 'テスト',
    agency_names: { en: 'Test Transit' },
    agency_short_names: { en: 'Test' },
    agency_url: '',
    agency_lang: 'ja',
    agency_timezone: 'Asia/Tokyo',
    agency_fare_url: '',
    agency_colors: [],
    ...overrides,
  };
}

describe('translateAgencyName', () => {
  it('returns primary names when no lang is specified', () => {
    const result = translateAgencyName(makeAgency());
    expect(result.name).toBe('テスト交通');
    expect(result.shortName).toBe('テスト');
  });

  it('returns translated names for a given lang', () => {
    const result = translateAgencyName(makeAgency(), 'en');
    expect(result.name).toBe('Test Transit');
    expect(result.shortName).toBe('Test');
  });

  it('falls back to primary when requested lang is not available', () => {
    const result = translateAgencyName(makeAgency(), 'fr');
    expect(result.name).toBe('テスト交通');
    expect(result.shortName).toBe('テスト');
  });

  it('handles empty translations records', () => {
    const result = translateAgencyName(
      makeAgency({ agency_names: {}, agency_short_names: {} }),
      'en',
    );
    expect(result.name).toBe('テスト交通');
    expect(result.shortName).toBe('テスト');
  });
});
