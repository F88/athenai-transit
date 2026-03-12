/**
 * Convert katakana (U+30A1-U+30F6) to hiragana by subtracting 0x60.
 *
 * @param str - Input string potentially containing katakana characters.
 * @returns New string with all katakana replaced by corresponding hiragana.
 *
 * @example
 * ```ts
 * katakanaToHiragana("ナカノ")  // => "なかの"
 * katakanaToHiragana("中野")    // => "中野" (non-katakana unchanged)
 * ```
 */
export function katakanaToHiragana(str: string): string {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    result += code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : str[i];
  }
  return result;
}
