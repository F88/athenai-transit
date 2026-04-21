import { describe, expect, it } from 'vitest';
import { getContrastAwareAlphaSuffixes } from '../contrast-alpha-suffixes';

describe('getContrastAwareAlphaSuffixes', () => {
  it('returns the default subtle alpha when ratio is unavailable', () => {
    expect(getContrastAwareAlphaSuffixes(null)).toEqual({
      subtleAlphaSuffix: '20',
      emphasisAlphaSuffix: '50',
    });
  });

  it('returns the strongest alpha pair below the 1.5 threshold', () => {
    expect(getContrastAwareAlphaSuffixes(1.1)).toEqual({
      subtleAlphaSuffix: '60',
      emphasisAlphaSuffix: 'A0',
    });
  });

  it('steps through the configured threshold bands as ratio improves', () => {
    expect(getContrastAwareAlphaSuffixes(1.3)).toEqual({
      subtleAlphaSuffix: '60',
      emphasisAlphaSuffix: 'A0',
    });
    expect(getContrastAwareAlphaSuffixes(1.76)).toEqual({
      subtleAlphaSuffix: '40',
      emphasisAlphaSuffix: '70',
    });
    expect(getContrastAwareAlphaSuffixes(2.4)).toEqual({
      subtleAlphaSuffix: '30',
      emphasisAlphaSuffix: '60',
    });
  });

  it('returns the weakest alpha pair only at ratios of 3.0 and above', () => {
    expect(getContrastAwareAlphaSuffixes(2.6)).toEqual({
      subtleAlphaSuffix: '30',
      emphasisAlphaSuffix: '60',
    });
    expect(getContrastAwareAlphaSuffixes(3.0)).toEqual({
      subtleAlphaSuffix: '20',
      emphasisAlphaSuffix: '50',
    });
  });
});
