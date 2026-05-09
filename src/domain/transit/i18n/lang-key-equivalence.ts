import { REGION_TO_LANG } from '../../../config/supported-langs';

/**
 * Compare two BCP 47-ish language keys, treating known
 * script/region aliases as equivalent.
 *
 * The base relation is case-insensitive comparison per BCP 47
 * §2.1.1 (so `ja-HrKt` ≡ `ja-Hrkt`). On top of that, region-based
 * Chinese subtags are mapped to their script-based canonical form
 * (`zh-cn` ≡ `zh-Hans`, `zh-tw` ≡ `zh-Hant`, etc.) using
 * {@link REGION_TO_LANG}.
 *
 * Unknown codes pass through unchanged, so unrelated languages stay
 * non-equivalent (e.g. `zh-Hans` and `zh-Hant` are NOT equivalent —
 * they are different scripts, intentionally distinct).
 *
 * Designed for use inside translation lookup paths where the source
 * data (`translations.txt`) and the user-selected language may use
 * different conformant-but-non-canonical spellings of the same
 * language.
 *
 * @example
 * langKeysEquivalent('ja-Hrkt', 'ja-HrKt'); // true (case)
 * langKeysEquivalent('zh-cn', 'zh-Hans');   // true (region → script)
 * langKeysEquivalent('zh-Hans', 'zh-Hant'); // false (different scripts)
 * langKeysEquivalent('en', 'ja');            // false (different languages)
 */
export function langKeysEquivalent(a: string, b: string): boolean {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  if (aLower === bLower) {
    return true;
  }
  const aCanonical = (REGION_TO_LANG[aLower] ?? aLower).toLowerCase();
  const bCanonical = (REGION_TO_LANG[bLower] ?? bLower).toLowerCase();
  return aCanonical === bCanonical;
}
