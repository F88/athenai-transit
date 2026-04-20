import { describe, it, expect } from 'vitest';
import { adjustColorForContrast } from '../color-adjust';

// The function is currently a stub that returns fg unchanged. These
// tests lock in that behavior so call sites can depend on the
// signature today. Replace them with real coverage when the function
// gains actual logic.

describe('adjustColorForContrast (stub)', () => {
  it('returns fg unchanged for a well-contrasted pair', () => {
    expect(adjustColorForContrast('#000000', '#ffffff')).toBe('#000000');
  });

  it('returns fg unchanged for a low-contrast pair', () => {
    expect(adjustColorForContrast('#ffff00', '#ffffff')).toBe('#ffff00');
  });

  it('returns fg unchanged regardless of minRatio', () => {
    expect(adjustColorForContrast('#ff0000', '#ffffff', 3)).toBe('#ff0000');
    expect(adjustColorForContrast('#ff0000', '#ffffff', 7)).toBe('#ff0000');
  });

  it('defaults minRatio to WCAG AA 4.5 without changing the result', () => {
    expect(adjustColorForContrast('#abcdef', '#fedcba')).toBe('#abcdef');
  });
});
