/**
 * Fold fullwidth Latin letters and digits to their halfwidth equivalents by
 * subtracting 0xFEE0.
 *
 * The fullwidth forms sit exactly 0xFEE0 above their ASCII counterparts, so one
 * subtraction covers all three ranges:
 *
 * - U+FF21-U+FF3A: fullwidth A-Z  -> U+0041-U+005A
 * - U+FF41-U+FF5A: fullwidth a-z  -> U+0061-U+007A
 * - U+FF10-U+FF19: fullwidth 0-9  -> U+0030-U+0039
 *
 * Scope is deliberately limited to letters and digits:
 *
 * - Fullwidth punctuation (U+FF08 and friends) is left alone. Parentheses are
 *   never a search term, so folding them would add churn without adding hits.
 * - Halfwidth katakana is NOT handled here. That fold is not one-to-one
 *   (halfwidth "si" plus a voiced mark is two code points, the fullwidth form
 *   is one), so it cannot share this function's length guarantee.
 *
 * The mapping is strictly one character to one character, so callers may rely
 * on the output having the same length as the input. Stop-name search highlight
 * depends on that: it locates a match in the normalized string and then slices
 * the original name at the same offset.
 *
 * @param str - Input string potentially containing fullwidth letters or digits.
 * @returns New string with fullwidth letters and digits replaced by halfwidth.
 *
 * @example
 * Real stop names, with the fullwidth run spelled out because this file is
 * kept ASCII:
 *
 * ```text
 * U+FF2A U+FF32 王子駅       -> JR王子駅
 * 安善町 U+FF12 丁目         -> 安善町2丁目
 * ```
 */
export function fullwidthAlnumToHalfwidth(str: string): string {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    const isFullwidthUpper = code >= 0xff21 && code <= 0xff3a;
    const isFullwidthLower = code >= 0xff41 && code <= 0xff5a;
    const isFullwidthDigit = code >= 0xff10 && code <= 0xff19;
    const isFullwidthAlnum = isFullwidthUpper || isFullwidthLower || isFullwidthDigit;
    result += isFullwidthAlnum ? String.fromCharCode(code - 0xfee0) : str[i];
  }
  return result;
}
