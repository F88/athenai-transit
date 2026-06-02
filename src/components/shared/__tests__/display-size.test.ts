import { describe, expect, it } from 'vitest';
import { resolveContainerDisplaySize } from '../display-size';

describe('resolveContainerDisplaySize', () => {
  it('returns md below the large container threshold', () => {
    expect(resolveContainerDisplaySize(0)).toBe('md');
    expect(resolveContainerDisplaySize(799)).toBe('md');
    expect(resolveContainerDisplaySize(799.999)).toBe('md');
  });

  it('returns lg at the large container threshold', () => {
    expect(resolveContainerDisplaySize(800)).toBe('lg');
  });

  it('returns lg below the extra-large container threshold', () => {
    expect(resolveContainerDisplaySize(801)).toBe('lg');
    expect(resolveContainerDisplaySize(1199)).toBe('lg');
    expect(resolveContainerDisplaySize(1199.999)).toBe('lg');
  });

  it('returns xl at the extra-large container threshold', () => {
    expect(resolveContainerDisplaySize(1200)).toBe('xl');
  });

  it('returns xl above the extra-large container threshold', () => {
    expect(resolveContainerDisplaySize(1201)).toBe('xl');
    expect(resolveContainerDisplaySize(3840)).toBe('xl');
  });

  it('treats negative and non-finite widths as compact fallback inputs', () => {
    expect(resolveContainerDisplaySize(-1)).toBe('md');
    expect(resolveContainerDisplaySize(Number.NEGATIVE_INFINITY)).toBe('md');
    expect(resolveContainerDisplaySize(Number.NaN)).toBe('md');
  });

  it('returns xl for positive infinity', () => {
    expect(resolveContainerDisplaySize(Number.POSITIVE_INFINITY)).toBe('xl');
  });
});
