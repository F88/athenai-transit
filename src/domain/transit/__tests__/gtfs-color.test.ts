import { describe, expect, it } from 'vitest';
import { convertGtfsColor } from '../gtfs-color';

describe('convertGtfsColor', () => {
  it('returns the raw GTFS value unchanged for raw format', () => {
    expect(convertGtfsColor('FFFFFF', 'raw')).toBe('FFFFFF');
  });

  it('returns a CSS hex color for css-hex format', () => {
    expect(convertGtfsColor('FFFFFF', 'css-hex')).toBe('#FFFFFF');
  });

  it('returns undefined for empty values', () => {
    expect(convertGtfsColor('', 'css-hex')).toBeUndefined();
    expect(convertGtfsColor(undefined, 'raw')).toBeUndefined();
    expect(convertGtfsColor(null, 'raw')).toBeUndefined();
  });
});
