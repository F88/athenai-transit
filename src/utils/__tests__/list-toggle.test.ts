import { describe, expect, it } from 'vitest';
import { toggleGroupInList, toggleInList } from '../list-toggle';

describe('toggleInList', () => {
  it('adds value when absent', () => {
    expect(toggleInList([0, 1], 2)).toEqual([0, 1, 2]);
  });

  it('removes value when present', () => {
    expect(toggleInList([0, 1, 2], 1)).toEqual([0, 2]);
  });

  it('works on empty array', () => {
    expect(toggleInList([], 3)).toEqual([3]);
  });

  it('removes last remaining value', () => {
    expect(toggleInList([3], 3)).toEqual([]);
  });

  it('does not mutate the original array', () => {
    const original = [0, 1, 2];
    toggleInList(original, 3);
    expect(original).toEqual([0, 1, 2]);

    toggleInList(original, 1);
    expect(original).toEqual([0, 1, 2]);
  });

  it('removes all occurrences when duplicates exist', () => {
    expect(toggleInList([1, 1, 2], 1)).toEqual([2]);
  });

  it('round-trips: toggle twice returns original', () => {
    const original = [0, 1, 2];
    const toggled = toggleInList(original, 3);
    expect(toggleInList(toggled, 3)).toEqual(original);
  });
});

describe('toggleGroupInList', () => {
  it('adds missing group values when not all present', () => {
    const result = toggleGroupInList([0, 3], [0, 1, 2]);
    expect(result).toEqual(expect.arrayContaining([0, 1, 2, 3]));
    expect(result).toHaveLength(4);
  });

  it('removes all group values when all present', () => {
    expect(toggleGroupInList([0, 1, 2, 3], [0, 1, 2])).toEqual([3]);
  });

  it('adds all when none present', () => {
    const result = toggleGroupInList([3], [0, 1, 2]);
    expect(result).toEqual(expect.arrayContaining([0, 1, 2, 3]));
    expect(result).toHaveLength(4);
  });

  it('removes all from matching-only list', () => {
    expect(toggleGroupInList([0, 1, 2], [0, 1, 2])).toEqual([]);
  });

  it('does not mutate the original array', () => {
    const original = [0, 1, 2, 3];
    toggleGroupInList(original, [0, 1, 2]);
    expect(original).toEqual([0, 1, 2, 3]);
  });

  it('does not create duplicates when adding partially present values', () => {
    const result = toggleGroupInList([0, 3], [0, 1, 2]);
    const counts = result.reduce(
      (acc, value) => acc.set(value, (acc.get(value) ?? 0) + 1),
      new Map<number, number>(),
    );
    for (const [, count] of counts) {
      expect(count).toBe(1);
    }
  });

  it('round-trips: toggle twice returns original', () => {
    const original = [0, 1, 2, 3];
    const toggled = toggleGroupInList(original, [0, 1, 2]);
    expect(toggleGroupInList(toggled, [0, 1, 2])).toEqual(expect.arrayContaining(original));
  });

  it('handles single-element group', () => {
    expect(toggleGroupInList([0, 1], [1])).toEqual([0]);
    const result = toggleGroupInList([0], [1]);
    expect(result).toEqual(expect.arrayContaining([0, 1]));
  });
});
