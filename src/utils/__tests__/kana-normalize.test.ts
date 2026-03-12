import { describe, expect, it } from 'vitest';
import { katakanaToHiragana } from '../kana-normalize';

describe('katakanaToHiragana', () => {
  it('converts full katakana string to hiragana', () => {
    expect(katakanaToHiragana('ナカノ')).toBe('なかの');
  });

  it('leaves kanji unchanged', () => {
    expect(katakanaToHiragana('中野')).toBe('中野');
  });

  it('converts mixed katakana and kanji', () => {
    expect(katakanaToHiragana('中野サカウエ')).toBe('中野さかうえ');
  });

  it('leaves hiragana unchanged', () => {
    expect(katakanaToHiragana('なかの')).toBe('なかの');
  });

  it('leaves ASCII unchanged', () => {
    expect(katakanaToHiragana('ABC123')).toBe('ABC123');
  });

  it('handles empty string', () => {
    expect(katakanaToHiragana('')).toBe('');
  });

  it('converts boundary katakana characters (ァ and ヶ)', () => {
    // U+30A1 (ァ) -> U+3041 (ぁ)
    expect(katakanaToHiragana('ァ')).toBe('ぁ');
    // U+30F6 (ヶ) -> U+3096 (ゖ)
    expect(katakanaToHiragana('ヶ')).toBe('ゖ');
  });

  it('leaves katakana outside conversion range unchanged', () => {
    // U+30F7 (ヷ) is outside the range U+30A1-U+30F6
    expect(katakanaToHiragana('ヷ')).toBe('ヷ');
  });

  it('handles mixed content (katakana + hiragana + kanji + ASCII)', () => {
    expect(katakanaToHiragana('テスト test てすと 試験')).toBe('てすと test てすと 試験');
  });
});
