import { describe, it, expect } from 'vitest';
import { truncateLabel } from '../truncate-label';

describe('truncateLabel', () => {
  it('returns the name unchanged when within maxLength', () => {
    expect(truncateLabel('abc', 5)).toBe('abc');
  });

  it('returns the name unchanged when exactly maxLength', () => {
    expect(truncateLabel('abcde', 5)).toBe('abcde');
  });

  it('truncates and appends ellipsis when exceeding maxLength', () => {
    expect(truncateLabel('abcdef', 5)).toBe('abcde…');
  });

  it('handles maxLength of 0', () => {
    expect(truncateLabel('abc', 0)).toBe('…');
  });

  it('handles empty string', () => {
    expect(truncateLabel('', 5)).toBe('');
  });

  it('handles Japanese characters', () => {
    expect(truncateLabel('曙橋駅前', 3)).toBe('曙橋駅…');
    expect(truncateLabel('曙橋駅前', 4)).toBe('曙橋駅前');
  });

  it('returns full string for maxLength of 1 with single char', () => {
    expect(truncateLabel('A', 1)).toBe('A');
  });

  it('truncates to 1 char + ellipsis for maxLength of 1 with longer string', () => {
    expect(truncateLabel('AB', 1)).toBe('A…');
  });
});
