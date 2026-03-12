import { describe, expect, it } from 'vitest';
import { nextInfoLevel } from '../next-info-level';

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

  it('cycles verbose -> simple (wraps around)', () => {
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
