/**
 * Tests for country-flag.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import { countriesFlagEmoji, countryFlagEmoji } from '../country-flag';

describe('countryFlagEmoji', () => {
  it('returns the JP flag for "JP"', () => {
    expect(countryFlagEmoji('JP')).toBe('🇯🇵');
  });

  it('returns the DE flag for "DE"', () => {
    expect(countryFlagEmoji('DE')).toBe('🇩🇪');
  });

  it('returns the IT flag for "IT"', () => {
    expect(countryFlagEmoji('IT')).toBe('🇮🇹');
  });

  it('accepts lowercase input', () => {
    expect(countryFlagEmoji('jp')).toBe('🇯🇵');
  });

  it('accepts mixed case input', () => {
    expect(countryFlagEmoji('Jp')).toBe('🇯🇵');
  });

  it('returns empty string for codes shorter than two letters', () => {
    expect(countryFlagEmoji('J')).toBe('');
  });

  it('returns empty string for codes longer than two letters', () => {
    expect(countryFlagEmoji('JPN')).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(countryFlagEmoji('')).toBe('');
  });

  it('returns empty string when either character is non-ASCII-letter', () => {
    expect(countryFlagEmoji('J1')).toBe('');
    expect(countryFlagEmoji('1J')).toBe('');
    expect(countryFlagEmoji('!J')).toBe('');
  });
});

describe('countriesFlagEmoji', () => {
  it('concatenates flags in the given order', () => {
    expect(countriesFlagEmoji(['JP', 'DE', 'IT'])).toBe('🇯🇵🇩🇪🇮🇹');
  });

  it('returns an empty string for an empty array', () => {
    expect(countriesFlagEmoji([])).toBe('');
  });

  it('skips malformed entries silently', () => {
    expect(countriesFlagEmoji(['JP', 'XX1', 'DE'])).toBe('🇯🇵🇩🇪');
  });

  it('handles single-country arrays', () => {
    expect(countriesFlagEmoji(['DE'])).toBe('🇩🇪');
  });
});
