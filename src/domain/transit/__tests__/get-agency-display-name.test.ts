import { describe, expect, it } from 'vitest';
import { getAgencyDisplayNames, resolveAgencyDisplayName } from '../get-agency-display-name';
import type { Agency } from '../../../types/app/transit';

function makeAgency(overrides: Partial<Agency> = {}): Agency {
  return {
    agency_id: 'test:agency',
    agency_name: 'Test Agency',
    agency_short_name: 'Test',
    agency_names: {},
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
    const result = getAgencyDisplayNames(makeAgency(), 'simple');
    expect(result.name).toBe('Test');
  });

  it('falls back to agency_name when short name is empty', () => {
    const result = getAgencyDisplayNames(makeAgency({ agency_short_name: '' }), 'simple');
    expect(result.name).toBe('Test Agency');
  });

  it('falls back to agency_id when both names are empty', () => {
    const result = getAgencyDisplayNames(
      makeAgency({ agency_short_name: '', agency_name: '' }),
      'simple',
    );
    expect(result.name).toBe('test:agency');
  });

  it('uses translated short name when lang is provided', () => {
    const result = getAgencyDisplayNames(
      makeAgency({ agency_short_names: { en: 'Test EN' } }),
      'simple',
      'en',
    );
    expect(result.name).toBe('Test EN');
  });

  it('uses translated name when short name translation is missing', () => {
    const result = getAgencyDisplayNames(
      makeAgency({
        agency_short_name: '',
        agency_names: { en: 'Test Agency EN' },
      }),
      'simple',
      'en',
    );
    expect(result.name).toBe('Test Agency EN');
  });

  it('returns short name at verbose level (same as other levels)', () => {
    const result = getAgencyDisplayNames(makeAgency(), 'verbose');
    expect(result.name).toBe('Test');
  });
});

describe('resolveAgencyDisplayName', () => {
  const agencies = [
    makeAgency({ agency_id: 'a1', agency_short_name: 'Agency A' }),
    makeAgency({ agency_id: 'a2', agency_short_name: 'Agency B' }),
  ];

  it('resolves agency_id to display name', () => {
    expect(resolveAgencyDisplayName('a1', agencies, 'simple')).toBe('Agency A');
    expect(resolveAgencyDisplayName('a2', agencies, 'simple')).toBe('Agency B');
  });

  it('returns undefined for unknown agency_id', () => {
    expect(resolveAgencyDisplayName('unknown', agencies, 'simple')).toBeUndefined();
  });
});
