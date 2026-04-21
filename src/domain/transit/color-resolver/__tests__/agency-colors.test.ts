import { describe, expect, it } from 'vitest';
import { normalizeAgencyColorPairs, resolveAgencyColors } from '../agency-colors';

describe('normalizeAgencyColorPairs', () => {
  it('uppercases valid GTFS Color values while preserving order', () => {
    expect(
      normalizeAgencyColorPairs([
        { bg: '009f40', text: 'ffffff' },
        { bg: 'e2001a', text: 'FFFFFF' },
      ]),
    ).toEqual([
      { bg: '009F40', text: 'FFFFFF' },
      { bg: 'E2001A', text: 'FFFFFF' },
    ]);
  });

  it('preserves invalid values as-is instead of inventing fallbacks', () => {
    expect(normalizeAgencyColorPairs([{ bg: 'zzzzzz', text: 'FFFFFF' }])).toEqual([
      { bg: 'zzzzzz', text: 'FFFFFF' },
    ]);
  });
});

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
