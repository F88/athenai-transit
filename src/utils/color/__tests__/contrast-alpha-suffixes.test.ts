import { describe, expect, it } from 'vitest';
import { getContrastAwareAlphaSuffixes } from '../contrast-alpha-suffixes';

describe('getContrastAwareAlphaSuffixes', () => {
  it('returns the default subtle alpha when ratio is unavailable', () => {
    expect(getContrastAwareAlphaSuffixes(null)).toEqual({
      subtleAlphaSuffix: '20',
      emphasisAlphaSuffix: '50',
    });
  });

  it('returns the strongest subtle alpha for very low ratios', () => {
    expect(getContrastAwareAlphaSuffixes(1.1)).toEqual({
      subtleAlphaSuffix: '',
      emphasisAlphaSuffix: '',
    });
  });

  it('returns intermediate subtle alpha steps as ratio improves', () => {
    expect(getContrastAwareAlphaSuffixes(1.3)).toEqual({
      subtleAlphaSuffix: '55',
      emphasisAlphaSuffix: 'AA',
    });
    expect(getContrastAwareAlphaSuffixes(1.76)).toEqual({
      subtleAlphaSuffix: '44',
      emphasisAlphaSuffix: '66',
    });
    expect(getContrastAwareAlphaSuffixes(2.4)).toEqual({
      subtleAlphaSuffix: '33',
      emphasisAlphaSuffix: '50',
    });
  });

  it('returns the weakest subtle alpha when contrast is comfortably visible', () => {
    expect(getContrastAwareAlphaSuffixes(2.6)).toEqual({
      subtleAlphaSuffix: '20',
      emphasisAlphaSuffix: '50',
    });
  });
});
