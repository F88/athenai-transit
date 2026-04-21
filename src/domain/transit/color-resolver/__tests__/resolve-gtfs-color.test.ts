import { describe, expect, it } from 'vitest';
import { LOW_CONTRAST_TEXT_MIN_RATIO } from '../contrast-thresholds';
import type { GtfsColor } from '../../../../types/app/gtfs-color';
import {
  formatResolvedColorPair,
  hasLowContrastBetweenGtfsColors,
  normalizeGtfsColor,
  normalizeOptionalGtfsColor,
  resolveGtfsColor,
} from '../resolve-gtfs-color';

function asGtfsColor(value: string): GtfsColor {
  return value as GtfsColor;
}

describe('normalizeOptionalGtfsColor', () => {
  it('returns an uppercase GTFS Color when the input is valid', () => {
    expect(normalizeOptionalGtfsColor('ffffff')).toBe('FFFFFF');
  });

  it('trims surrounding whitespace before uppercasing', () => {
    expect(normalizeOptionalGtfsColor('  abcdef  ')).toBe('ABCDEF');
  });

  it('returns undefined when the input is missing', () => {
    expect(normalizeOptionalGtfsColor(undefined)).toBeUndefined();
    expect(normalizeOptionalGtfsColor(null)).toBeUndefined();
  });

  it('returns undefined when the input is invalid', () => {
    expect(normalizeOptionalGtfsColor('zzz')).toBeUndefined();
  });
});

describe('normalizeGtfsColor', () => {
  it('returns an uppercase GTFS Color when the input is valid', () => {
    expect(normalizeGtfsColor('ffffff', asGtfsColor('333333'))).toBe('FFFFFF');
  });

  it('trims surrounding whitespace before uppercasing', () => {
    expect(normalizeGtfsColor('  abcdef  ', asGtfsColor('333333'))).toBe('ABCDEF');
  });

  it('returns the default GTFS Color when the input is missing', () => {
    expect(normalizeGtfsColor(undefined, asGtfsColor('333333'))).toBe('333333');
  });

  it('returns the default GTFS Color when the input is invalid', () => {
    expect(normalizeGtfsColor('zzz', asGtfsColor('333333'))).toBe('333333');
  });
});

describe('resolveGtfsColor', () => {
  it('returns the raw normalized GTFS color unchanged', () => {
    expect(resolveGtfsColor(asGtfsColor('FFFFFF'), 'raw')).toBe('FFFFFF');
  });

  it('formats a normalized GTFS color as css hex', () => {
    expect(resolveGtfsColor(asGtfsColor('FFFFFF'), 'css-hex')).toBe('#FFFFFF');
  });
});

describe('hasLowContrastBetweenGtfsColors', () => {
  it('returns true for a severely low-contrast pair', () => {
    expect(
      hasLowContrastBetweenGtfsColors(
        asGtfsColor('000000'),
        asGtfsColor('000001'),
        LOW_CONTRAST_TEXT_MIN_RATIO,
      ),
    ).toBe(true);
  });

  it('returns false for a clearly readable pair', () => {
    expect(
      hasLowContrastBetweenGtfsColors(
        asGtfsColor('000000'),
        asGtfsColor('FFFFFF'),
        LOW_CONTRAST_TEXT_MIN_RATIO,
      ),
    ).toBe(false);
  });

  it('supports a custom threshold', () => {
    expect(hasLowContrastBetweenGtfsColors(asGtfsColor('777777'), asGtfsColor('999999'), 1.1)).toBe(
      false,
    );
  });
});

describe('formatResolvedColorPair', () => {
  it('formats both colors when present', () => {
    expect(
      formatResolvedColorPair(
        {
          primaryColor: asGtfsColor('000000'),
          secondaryColor: asGtfsColor('FFFFFF'),
        },
        'css-hex',
      ),
    ).toEqual({
      primaryColor: '#000000',
      secondaryColor: '#FFFFFF',
    });
  });
});
