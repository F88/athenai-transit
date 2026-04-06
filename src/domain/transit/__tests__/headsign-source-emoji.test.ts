import { describe, expect, it } from 'vitest';
import { headsignSourceEmoji } from '../headsign-source-emoji';

describe('headsignSourceEmoji', () => {
  it('returns placard emoji for trip', () => {
    expect(headsignSourceEmoji('trip')).toBe('🪧');
  });

  it('returns pin emoji for stop', () => {
    expect(headsignSourceEmoji('stop')).toBe('📍');
  });
});
