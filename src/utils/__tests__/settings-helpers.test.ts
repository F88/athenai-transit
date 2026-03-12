import { describe, it, expect } from 'vitest';
import {
  toggleInList,
  toggleGroupInList,
  nextRenderMode,
  nextPerfMode,
  nextTileIndex,
} from '../settings-helpers';

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

  it('removes only the first-matching value (no duplicates assumed)', () => {
    // Even with duplicates in input, filter removes all occurrences
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
    // [0, 3] + group [0, 1, 2]: 0 is already present, should not duplicate
    const result = toggleGroupInList([0, 3], [0, 1, 2]);
    const counts = result.reduce(
      (acc, v) => acc.set(v, (acc.get(v) ?? 0) + 1),
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

describe('nextRenderMode', () => {
  it('cycles auto → lightweight → standard → auto', () => {
    expect(nextRenderMode('auto')).toBe('lightweight');
    expect(nextRenderMode('lightweight')).toBe('standard');
    expect(nextRenderMode('standard')).toBe('auto');
  });

  it('full cycle returns to starting mode', () => {
    const start = 'auto' as const;
    const result = nextRenderMode(nextRenderMode(nextRenderMode(start)));
    expect(result).toBe(start);
  });
});

describe('nextPerfMode', () => {
  it('cycles normal → lite → full → normal', () => {
    expect(nextPerfMode('normal')).toBe('lite');
    expect(nextPerfMode('lite')).toBe('full');
    expect(nextPerfMode('full')).toBe('normal');
  });

  it('full cycle returns to starting mode', () => {
    const start = 'normal' as const;
    const result = nextPerfMode(nextPerfMode(nextPerfMode(start)));
    expect(result).toBe(start);
  });
});

describe('nextTileIndex', () => {
  it('cycles 0 → 1 → 2 → 3 with count=4', () => {
    expect(nextTileIndex(0, 4)).toBe(1);
    expect(nextTileIndex(1, 4)).toBe(2);
    expect(nextTileIndex(2, 4)).toBe(3);
  });

  it('wraps to null at end', () => {
    expect(nextTileIndex(3, 4)).toBeNull();
  });

  it('wraps from null back to 0', () => {
    expect(nextTileIndex(null, 4)).toBe(0);
  });

  it('full cycle returns to starting index', () => {
    let idx: number | null = 0;
    for (let i = 0; i < 5; i++) {
      idx = nextTileIndex(idx, 4);
    }
    // 0→1→2→3→null→0
    expect(idx).toBe(0);
  });

  it('count=1 cycles between 0 and null', () => {
    expect(nextTileIndex(0, 1)).toBeNull();
    expect(nextTileIndex(null, 1)).toBe(0);
  });
});
