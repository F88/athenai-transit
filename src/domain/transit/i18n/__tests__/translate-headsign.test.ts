import { describe, expect, it } from 'vitest';
import { translateHeadsign } from '../translate-headsign';

describe('translateHeadsign', () => {
  it('returns headsign as-is when lang is omitted', () => {
    expect(translateHeadsign('新宿駅西口')).toBe('新宿駅西口');
  });

  it('returns headsign as-is when lang is undefined', () => {
    expect(translateHeadsign('新宿駅西口', undefined)).toBe('新宿駅西口');
  });

  it('returns headsign as-is when lang is provided (translations not yet supported)', () => {
    expect(translateHeadsign('新宿駅西口', 'en')).toBe('新宿駅西口');
  });

  it('returns empty string when headsign is empty', () => {
    expect(translateHeadsign('')).toBe('');
  });

  it('returns empty string when headsign is empty with lang', () => {
    expect(translateHeadsign('', 'en')).toBe('');
  });
});
