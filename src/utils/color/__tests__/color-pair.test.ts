import { describe, expect, it } from 'vitest';
import { isEmptyColorPair, mapColorPair } from '../color-pair';

describe('isEmptyColorPair', () => {
  it('returns true when both colors are missing', () => {
    expect(isEmptyColorPair({})).toBe(true);
  });

  it('returns false when the primary color exists', () => {
    expect(isEmptyColorPair({ primaryColor: '#000000' })).toBe(false);
  });

  it('returns false when the secondary color exists', () => {
    expect(isEmptyColorPair({ secondaryColor: '#FFFFFF' })).toBe(false);
  });
});

describe('mapColorPair', () => {
  it('maps both colors when both are present', () => {
    expect(
      mapColorPair(
        {
          primaryColor: '000000',
          secondaryColor: 'FFFFFF',
        },
        (color) => `#${color}`,
      ),
    ).toEqual({
      primaryColor: '#000000',
      secondaryColor: '#FFFFFF',
    });
  });

  it('preserves missing members while mapping the present color', () => {
    expect(
      mapColorPair(
        {
          secondaryColor: 'FFFFFF',
        },
        (color) => color.toLowerCase(),
      ),
    ).toEqual({
      primaryColor: undefined,
      secondaryColor: 'ffffff',
    });
  });

  it('passes the color role to the mapper', () => {
    expect(
      mapColorPair(
        {
          primaryColor: '111111',
          secondaryColor: '222222',
        },
        (color, role) => `${role}:${color}`,
      ),
    ).toEqual({
      primaryColor: 'primaryColor:111111',
      secondaryColor: 'secondaryColor:222222',
    });
  });
});
