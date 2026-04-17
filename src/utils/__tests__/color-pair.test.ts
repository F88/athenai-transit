import { describe, expect, it } from 'vitest';
import { normalizeHexColor } from '../color-pair';

describe('normalizeHexColor', () => {
  it('returns six-digit hex strings unchanged', () => {
    expect(normalizeHexColor('FFFFFF')).toBe('FFFFFF');
    expect(normalizeHexColor('00a8F0')).toBe('00a8F0');
  });

  it('returns undefined for empty or invalid values', () => {
    expect(normalizeHexColor('')).toBeUndefined();
    expect(normalizeHexColor('FFF')).toBeUndefined();
    expect(normalizeHexColor('#FFFFFF')).toBeUndefined();
    expect(normalizeHexColor('GGGGGG')).toBeUndefined();
    expect(normalizeHexColor(undefined)).toBeUndefined();
    expect(normalizeHexColor(null)).toBeUndefined();
  });
});
