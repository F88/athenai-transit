import { describe, expect, it } from 'vitest';

import { reconcileIdSet } from '../reconcile-id-set';

describe('reconcileIdSet', () => {
  it('returns the same reference when every tracked id is still present', () => {
    const tracked = new Set(['a', 'b']);
    const present = new Set(['a', 'b', 'c']);
    const result = reconcileIdSet(tracked, present);
    expect(result).toBe(tracked);
  });

  it('drops stale ids and returns a new set containing only survivors', () => {
    const tracked = new Set(['a', 'b', 'c']);
    const present = new Set(['a', 'c']);
    const result = reconcileIdSet(tracked, present);
    expect(result).not.toBe(tracked);
    expect(Array.from(result).sort()).toEqual(['a', 'c']);
  });

  it('returns an empty set when every tracked id has dropped out', () => {
    const tracked = new Set(['a', 'b']);
    const present = new Set(['c', 'd']);
    const result = reconcileIdSet(tracked, present);
    expect(result.size).toBe(0);
  });

  it('returns the same empty reference when tracked is already empty', () => {
    const tracked = new Set<string>();
    const present = new Set(['a', 'b']);
    const result = reconcileIdSet(tracked, present);
    expect(result).toBe(tracked);
  });

  it('returns the same empty reference when both inputs are empty', () => {
    const tracked = new Set<string>();
    const present = new Set<string>();
    const result = reconcileIdSet(tracked, present);
    expect(result).toBe(tracked);
  });

  it('returns an empty set when present is empty and tracked is not', () => {
    const tracked = new Set(['a', 'b']);
    const present = new Set<string>();
    const result = reconcileIdSet(tracked, present);
    expect(result).not.toBe(tracked);
    expect(result.size).toBe(0);
  });
});
