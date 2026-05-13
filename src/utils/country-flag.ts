/**
 * Convert an ISO 3166-1 alpha-2 country code to its flag emoji.
 *
 * Flag emojis are formed from two Regional Indicator Symbols, one per
 * letter of the alpha-2 code. For example, "JP" → 🇯🇵 (U+1F1EF U+1F1F5).
 *
 * Returns an empty string when the input is not exactly two ASCII
 * letters, since there is no canonical flag to fall back to.
 *
 * @param code - ISO 3166-1 alpha-2 country code (case-insensitive).
 * @returns Flag emoji string, or empty string for malformed input.
 */
export function countryFlagEmoji(code: string): string {
  if (code.length !== 2) {
    return '';
  }

  const upper = code.toUpperCase();
  const codePoints: number[] = [];
  const base = 0x1f1e6; // Regional Indicator Symbol Letter A
  for (const ch of upper) {
    const ascii = ch.charCodeAt(0);
    if (ascii < 0x41 || ascii > 0x5a) {
      return '';
    }
    codePoints.push(base + (ascii - 0x41));
  }
  return String.fromCodePoint(...codePoints);
}

/**
 * Concatenated flag emoji string for multiple country codes.
 *
 * @param codes - Array of ISO 3166-1 alpha-2 country codes.
 * @returns Concatenated flag emoji string (e.g. "🇯🇵🇩🇪🇮🇹").
 */
export function countriesFlagEmoji(codes: readonly string[]): string {
  return codes.map(countryFlagEmoji).join('');
}
