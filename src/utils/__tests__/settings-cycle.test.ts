import { describe, expect, it } from 'vitest';
import { nextInfoLevel, nextPerfMode, nextRenderMode, nextTileIndex } from '../settings-cycle';

describe('nextInfoLevel', () => {
  it('cycles simple -> normal', () => {
    expect(nextInfoLevel('simple')).toBe('normal');
  });

  it('cycles normal -> detailed', () => {
    expect(nextInfoLevel('normal')).toBe('detailed');
  });

  it('cycles detailed -> verbose', () => {
    expect(nextInfoLevel('detailed')).toBe('verbose');
  });

  it('cycles verbose -> simple', () => {
    expect(nextInfoLevel('verbose')).toBe('simple');
  });

  it('completes a full cycle back to the start', () => {
    let level = nextInfoLevel('simple');
    level = nextInfoLevel(level);
    level = nextInfoLevel(level);
    level = nextInfoLevel(level);
    expect(level).toBe('simple');
  });
});

describe('nextRenderMode', () => {
  it('cycles auto -> lightweight -> standard -> auto', () => {
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
  it('cycles normal -> lite -> full -> normal', () => {
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
  it('cycles 0 -> 1 -> 2 -> 3 with count=4', () => {
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
    let index: number | null = 0;
    for (let i = 0; i < 5; i++) {
      index = nextTileIndex(index, 4);
    }
    expect(index).toBe(0);
  });

  it('count=1 cycles between 0 and null', () => {
    expect(nextTileIndex(0, 1)).toBeNull();
    expect(nextTileIndex(null, 1)).toBe(0);
  });
});
