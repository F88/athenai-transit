import { describe, expect, it } from 'vitest';
import { getAgencyDisplayNames, resolveAgencyDisplayName } from '../get-agency-display-name';
import type { Agency } from '../../../types/app/transit';

const DEFAULT_LANGS = ['ja'];

function makeAgency(overrides: Partial<Agency> = {}): Agency {
  return {
    agency_id: 'test:agency',
    agency_name: 'Test Agency',
    agency_long_name: 'Test Agency',
    agency_short_name: 'Test',
    agency_names: {},
    agency_long_names: {},
    agency_short_names: {},
    agency_url: '',
    agency_lang: 'ja',
    agency_timezone: 'Asia/Tokyo',
    agency_fare_url: '',
    agency_colors: [],
    ...overrides,
  };
}

describe('getAgencyDisplayNames', () => {
  it('returns short name when available', () => {
    const result = getAgencyDisplayNames(makeAgency(), [], DEFAULT_LANGS);
    expect(result.resolved.name).toBe('Test');
    expect(result.resolvedSource).toBe('short');
  });

  it('falls back to agency_name when short name is empty', () => {
    const result = getAgencyDisplayNames(makeAgency({ agency_short_name: '' }), [], DEFAULT_LANGS);
    expect(result.resolved.name).toBe('Test Agency');
    expect(result.resolvedSource).toBe('long');
  });

  it('falls back to agency_id when both names are empty', () => {
    const result = getAgencyDisplayNames(
      makeAgency({ agency_short_name: '', agency_name: '', agency_long_name: '' }),
      [],
      DEFAULT_LANGS,
    );
    expect(result.resolved.name).toBe('test:agency');
  });

  it('uses translated short name when preferredDisplayLangs are provided', () => {
    const result = getAgencyDisplayNames(
      makeAgency({ agency_short_names: { en: 'Test EN' } }),
      ['en'],
      DEFAULT_LANGS,
    );
    expect(result.resolved.name).toBe('Test EN');
    expect(result.shortName.name).toBe('Test EN');
  });

  it('uses translated long name when preferred source is long', () => {
    const result = getAgencyDisplayNames(
      makeAgency({
        agency_long_names: { en: 'Test Agency EN' },
      }),
      ['en'],
      DEFAULT_LANGS,
      'long',
    );
    expect(result.resolved.name).toBe('Test Agency EN');
    expect(result.resolvedSource).toBe('long');
  });

  it('keeps short and long names available separately', () => {
    const result = getAgencyDisplayNames(
      makeAgency({
        agency_long_names: { en: 'Test Agency EN' },
        agency_short_names: { en: 'Test EN' },
      }),
      ['en'],
      DEFAULT_LANGS,
    );
    expect(result.shortName.name).toBe('Test EN');
    expect(result.longName.name).toBe('Test Agency EN');
  });
});

describe('resolveAgencyDisplayName', () => {
  const agencies = [
    makeAgency({ agency_id: 'a1', agency_short_name: 'Agency A' }),
    makeAgency({ agency_id: 'a2', agency_short_name: 'Agency B' }),
  ];

  it('resolves agency_id to display name', () => {
    expect(resolveAgencyDisplayName('a1', agencies, [], DEFAULT_LANGS)).toBe('Agency A');
    expect(resolveAgencyDisplayName('a2', agencies, [], DEFAULT_LANGS)).toBe('Agency B');
  });

  it('returns undefined for unknown agency_id', () => {
    expect(resolveAgencyDisplayName('unknown', agencies, [], DEFAULT_LANGS)).toBeUndefined();
  });
});
