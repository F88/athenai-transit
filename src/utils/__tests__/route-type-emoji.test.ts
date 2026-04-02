import { describe, it, expect } from 'vitest';
import { routeTypeEmoji, routeTypesEmoji } from '../route-type-emoji';

describe('routeTypeEmoji', () => {
  it.each([
    [0, '🚊'],
    [1, '🚇'],
    [2, '🚆'],
    [3, '🚌'],
    [4, '⛴️'],
    [5, '🚋'],
    [6, '🚡'],
    [7, '🚞'],
  ])('returns correct emoji for route_type %d', (routeType, expected) => {
    expect(routeTypeEmoji(routeType)).toBe(expected);
  });

  it('returns UFO emoji for unknown route_type', () => {
    expect(routeTypeEmoji(99)).toBe('🛸');
    expect(routeTypeEmoji(-1)).toBe('🛸');
    expect(routeTypeEmoji(11)).toBe('🛸');
    expect(routeTypeEmoji(12)).toBe('🛸');
  });
});

describe('routeTypesEmoji', () => {
  it('returns empty string for empty array', () => {
    expect(routeTypesEmoji([])).toBe('');
  });

  it('returns single emoji for single-element array', () => {
    expect(routeTypesEmoji([3])).toBe('🚌');
    expect(routeTypesEmoji([0])).toBe('🚊');
  });

  it('concatenates emojis for multiple route types', () => {
    expect(routeTypesEmoji([0, 1, 2, 3])).toBe('🚊🚇🚆🚌');
    expect(routeTypesEmoji([2, 3])).toBe('🚆🚌');
  });

  it('preserves order of input array', () => {
    expect(routeTypesEmoji([3, 0])).toBe('🚌🚊');
    expect(routeTypesEmoji([0, 3])).toBe('🚊🚌');
  });

  it('handles unknown route types in the array', () => {
    expect(routeTypesEmoji([3, 99])).toBe('🚌🛸');
  });
});
