import { describe, expect, it } from 'vitest';
import { hasDisplayContent } from '../get-display-names';

describe('hasDisplayContent', () => {
  it('returns true when name is non-empty', () => {
    expect(hasDisplayContent({ name: '中野駅', subNames: [] })).toBe(true);
  });

  it('returns true when subNames has non-empty value', () => {
    expect(hasDisplayContent({ name: '', subNames: ['Nakano Sta.'] })).toBe(true);
  });

  it('returns true when both name and subNames have content', () => {
    expect(hasDisplayContent({ name: '中野駅', subNames: ['Nakano Sta.'] })).toBe(true);
  });

  it('returns true when subNames has multiple non-empty values', () => {
    expect(hasDisplayContent({ name: '', subNames: ['Nakano Sta.', '中野站'] })).toBe(true);
  });

  it('returns true when name is empty but one subName is non-empty', () => {
    expect(hasDisplayContent({ name: '', subNames: ['', 'Nakano'] })).toBe(true);
  });

  it('returns false when name is empty and subNames is empty', () => {
    expect(hasDisplayContent({ name: '', subNames: [] })).toBe(false);
  });

  it('returns false when name is empty and all subNames are empty strings', () => {
    expect(hasDisplayContent({ name: '', subNames: ['', ''] })).toBe(false);
  });

  it('treats a whitespace-only name as content (strict empty-string check)', () => {
    expect(hasDisplayContent({ name: ' ', subNames: [] })).toBe(true);
  });

  it('treats a whitespace-only subName as content (strict empty-string check)', () => {
    expect(hasDisplayContent({ name: '', subNames: [' '] })).toBe(true);
  });
});
