import { describe, expect, it } from 'vitest';
import { fullwidthAlnumToHalfwidth } from '../width-normalize';

/**
 * Build a string from code points. Fullwidth characters are constructed rather
 * than written literally so this file stays ASCII, which also makes the
 * boundary cases below unambiguous about which code point they cover.
 */
function cp(...codes: number[]): string {
  return String.fromCharCode(...codes);
}

const FULLWIDTH_A = 0xff21;
const FULLWIDTH_Z = 0xff3a;
const FULLWIDTH_SMALL_A = 0xff41;
const FULLWIDTH_SMALL_Z = 0xff5a;
const FULLWIDTH_ZERO = 0xff10;
const FULLWIDTH_NINE = 0xff19;
const FULLWIDTH_J = 0xff2a;
const FULLWIDTH_R = 0xff32;
const FULLWIDTH_TWO = 0xff12;

describe('fullwidthAlnumToHalfwidth', () => {
  it('converts fullwidth uppercase letters', () => {
    expect(fullwidthAlnumToHalfwidth(cp(FULLWIDTH_J, FULLWIDTH_R))).toBe('JR');
  });

  it('converts fullwidth lowercase letters', () => {
    expect(fullwidthAlnumToHalfwidth(cp(FULLWIDTH_SMALL_A, FULLWIDTH_SMALL_Z))).toBe('az');
  });

  it('converts fullwidth digits', () => {
    expect(fullwidthAlnumToHalfwidth(cp(FULLWIDTH_ZERO, FULLWIDTH_TWO, FULLWIDTH_NINE))).toBe(
      '029',
    );
  });

  it('converts the boundary code points of every range', () => {
    expect(fullwidthAlnumToHalfwidth(cp(FULLWIDTH_A, FULLWIDTH_Z))).toBe('AZ');
    expect(fullwidthAlnumToHalfwidth(cp(FULLWIDTH_SMALL_A, FULLWIDTH_SMALL_Z))).toBe('az');
    expect(fullwidthAlnumToHalfwidth(cp(FULLWIDTH_ZERO, FULLWIDTH_NINE))).toBe('09');
  });

  it('leaves code points just outside each range unchanged', () => {
    // U+FF0F is just below fullwidth 0, U+FF1A just above fullwidth 9,
    // U+FF20 just below fullwidth A, U+FF3B just above fullwidth Z,
    // U+FF40 just below fullwidth a, U+FF5B just above fullwidth z.
    const outside = cp(0xff0f, 0xff1a, 0xff20, 0xff3b, 0xff40, 0xff5b);
    expect(fullwidthAlnumToHalfwidth(outside)).toBe(outside);
  });

  it('leaves fullwidth parentheses unchanged (out of scope by design)', () => {
    const parens = cp(0xff08, 0xff09);
    expect(fullwidthAlnumToHalfwidth(parens)).toBe(parens);
  });

  it('leaves halfwidth katakana unchanged (handled separately, not 1:1)', () => {
    // U+FF7C U+FF9E is halfwidth "si" + voiced mark.
    const halfwidthKana = cp(0xff7c, 0xff9e);
    expect(fullwidthAlnumToHalfwidth(halfwidthKana)).toBe(halfwidthKana);
  });

  it('leaves halfwidth ASCII unchanged', () => {
    expect(fullwidthAlnumToHalfwidth('JR2')).toBe('JR2');
  });

  it('leaves kanji, hiragana and katakana unchanged', () => {
    expect(fullwidthAlnumToHalfwidth('王子駅')).toBe('王子駅');
    expect(fullwidthAlnumToHalfwidth('あおい')).toBe('あおい');
    expect(fullwidthAlnumToHalfwidth('アオイ')).toBe('アオイ');
  });

  it('converts only the fullwidth run inside a mixed stop name', () => {
    expect(fullwidthAlnumToHalfwidth(cp(FULLWIDTH_J, FULLWIDTH_R) + '王子駅')).toBe('JR王子駅');
    expect(fullwidthAlnumToHalfwidth('安善町' + cp(FULLWIDTH_TWO) + '丁目')).toBe('安善町2丁目');
  });

  it('preserves length, which the search highlight relies on', () => {
    const mixed = cp(FULLWIDTH_J, FULLWIDTH_R) + '王子駅' + cp(FULLWIDTH_TWO) + 'abc';
    expect(fullwidthAlnumToHalfwidth(mixed)).toHaveLength(mixed.length);
  });

  it('handles empty string', () => {
    expect(fullwidthAlnumToHalfwidth('')).toBe('');
  });
});
