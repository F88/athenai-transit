/**
 * Supported display language definition.
 */
export interface SupportedLang {
  /** BCP 47 language code (e.g. "ja", "en", "zh-Hans"). */
  code: string;
  /** Full language name for display (e.g. "日本語", "English"). */
  label: string;
  /** Short label for compact UI (e.g. toggle buttons). */
  shortLabel: string;
  /**
   * Fallback language code when translation is not found.
   *
   * The resolver chains through fallbacks until a translation is found
   * or `undefined` is reached (falling back to origin text).
   * e.g. `zh-Hant` → `zh-Hans` → `en` → origin.
   */
  fallback?: string;
}

/**
 * User-selectable display languages in cycle order.
 *
 * This list defines which languages the user can switch between
 * via the UI toggle button. It does NOT imply that all UI text
 * is translated for every language listed — static UI labels
 * fall back to `fallbackLng` (en) via i18next when no translation
 * exists. GTFS data translations (stop names, headsigns, etc.)
 * are resolved independently via `TranslatableText`.
 *
 * The first entry is the default language used as fallback
 * when a stored or unknown value is not in this list.
 */
export const SUPPORTED_LANGS: readonly SupportedLang[] = [
  // Japanese
  { code: 'ja', label: '日本語', shortLabel: 'JA', fallback: 'en' },
  { code: 'ja-Hrkt', label: 'かな', shortLabel: 'あ', fallback: 'ja' },

  // Global Fallback
  { code: 'en', label: 'English', shortLabel: 'EN' },

  // East Asian (High Inbound Demand)
  { code: 'zh-Hans', label: '简体中文', shortLabel: '简', fallback: 'en' },
  { code: 'zh-Hant', label: '繁體中文', shortLabel: '繁', fallback: 'zh-Hans' },
  { code: 'ko', label: '한국어', shortLabel: '한', fallback: 'en' },

  // European / Others (Alphabetical)
  { code: 'de', label: 'Deutsch', shortLabel: 'DE', fallback: 'en' },
  { code: 'es', label: 'Español', shortLabel: 'ES', fallback: 'en' },
  { code: 'fr', label: 'Français', shortLabel: 'FR', fallback: 'en' },
  // { code: 'ru', label: 'Русский', shortLabel: 'RU', fallback: 'en' },
  // { code: 'ar', label: 'العربية', shortLabel: 'AR', fallback: 'en' }, // RTL not supported
];

/** Default display language code. */
export const DEFAULT_LANG = SUPPORTED_LANGS[0].code;

/** All supported language codes. */
export const SUPPORTED_LANG_CODES: readonly string[] = SUPPORTED_LANGS.map((l) => l.code);

/**
 * Region-to-script mapping for Chinese locale variants.
 * navigator.language returns region-based codes (zh-CN, zh-TW, zh-HK)
 * but SUPPORTED_LANGS uses script-based codes (zh-Hans, zh-Hant).
 */
const REGION_TO_LANG: Record<string, string> = {
  'zh-cn': 'zh-Hans',
  'zh-sg': 'zh-Hans',
  'zh-tw': 'zh-Hant',
  'zh-hk': 'zh-Hant',
  'zh-mo': 'zh-Hant',
};

/**
 * Normalize a language code to a supported value.
 *
 * Tries the following strategies in order (case-insensitive per BCP 47):
 * 1. Exact match against {@link SUPPORTED_LANG_CODES}
 * 2. Region-to-script mapping via {@link REGION_TO_LANG} (e.g. `zh-CN` → `zh-Hans`)
 * 3. Script subtag match (e.g. `zh-Hant-TW` → `zh-Hant`)
 * 4. Primary language prefix match (e.g. `en-US` → `en`)
 * 5. Falls back to {@link DEFAULT_LANG}
 *
 * Returns the canonical code from {@link SUPPORTED_LANGS} (not the input casing).
 *
 * @param lang - Language code to normalize (e.g. `navigator.language`).
 * @returns A guaranteed-supported language code.
 */
export function normalizeLang(lang: string): string {
  // Case-insensitive match per BCP 47 (RFC 5646 §2.1.1).
  // Returns the canonical code from SUPPORTED_LANGS, not the input casing.
  const lower = lang.toLowerCase();
  // Exact match first (e.g. "zh-Hans" → "zh-Hans")
  const exact = SUPPORTED_LANGS.find((l) => l.code.toLowerCase() === lower);
  if (exact) {
    return exact.code;
  }
  // Region-to-script mapping (e.g. "zh-CN" → "zh-Hans", "zh-TW" → "zh-Hant")
  const regionMatch = REGION_TO_LANG[lower];
  if (regionMatch) {
    return regionMatch;
  }
  // Script subtag match (e.g. "zh-Hant-TW" → "zh-Hant", "zh-Hans-CN" → "zh-Hans")
  // BCP 47: language-script-region, script is 4 letters
  const parts = lower.split('-');
  if (parts.length >= 2) {
    const scriptCandidate = `${parts[0]}-${parts[1]}`;
    const scriptMatch = SUPPORTED_LANGS.find((l) => l.code.toLowerCase() === scriptCandidate);
    if (scriptMatch) {
      return scriptMatch.code;
    }
  }
  // Prefix match (e.g. "en-US" → "en", "ja-JP" → "ja")
  const prefixMatch = SUPPORTED_LANGS.find((l) => l.code.toLowerCase() === parts[0]);
  return prefixMatch?.code ?? DEFAULT_LANG;
}
