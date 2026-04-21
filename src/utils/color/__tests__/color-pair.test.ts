import { describe, expect, it } from 'vitest';
import { mapColorPair } from '../color-pair';

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
