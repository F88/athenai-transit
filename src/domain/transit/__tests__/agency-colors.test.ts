import { describe, expect, it } from 'vitest';
import { resolveAgencyColors } from '../agency-colors';

describe('resolveAgencyColors', () => {
  it('returns the primary agency colors unchanged', () => {
    expect(
      resolveAgencyColors({
        agency_colors: [{ bg: 'E60013', text: 'FFFFFF' }],
      }),
    ).toEqual({
      agencyColor: 'E60013',
      agencyTextColor: 'FFFFFF',
    });
  });

  it('preserves an explicit same-color agency pair as-is', () => {
    expect(
      resolveAgencyColors({
        agency_colors: [{ bg: '000000', text: '000000' }],
      }),
    ).toEqual({
      agencyColor: '000000',
      agencyTextColor: '000000',
    });
  });

  it('returns CSS-ready values when format is css-hex', () => {
    expect(
      resolveAgencyColors(
        {
          agency_colors: [{ bg: 'E60013', text: 'FFFFFF' }],
        },
        'css-hex',
      ),
    ).toEqual({
      agencyColor: '#E60013',
      agencyTextColor: '#FFFFFF',
    });
  });

  it('returns no colors when the agency has no primary color pair', () => {
    expect(
      resolveAgencyColors({
        agency_colors: [],
      }),
    ).toEqual({});
  });

  it('treats invalid agency colors as omitted', () => {
    expect(
      resolveAgencyColors({
        agency_colors: [{ bg: 'zzzzzz', text: 'FFFFFF' }],
      }),
    ).toEqual({
      agencyTextColor: 'FFFFFF',
    });
  });
});
