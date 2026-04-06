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
}

/**
 * Supported display languages in cycle order.
 *
 * The first entry is the default language used as fallback
 * when a stored or unknown value is not in this list.
 */
export const SUPPORTED_LANGS: readonly SupportedLang[] = [
  // Japanese
  { code: 'ja', label: '日本語', shortLabel: 'JA' },
  { code: 'ja-Hrkt', label: 'かな', shortLabel: 'あ' },

  // Global Fallback
  { code: 'en', label: 'English', shortLabel: 'EN' },

  // East Asian (High Inbound Demand)
  { code: 'zh-Hans', label: '简体中文', shortLabel: '简' },
  { code: 'zh-Hant', label: '繁體中文', shortLabel: '繁' },
  { code: 'ko', label: '한국어', shortLabel: '한' },

  // European / Others (Alphabetical)
  { code: 'de', label: 'Deutsch', shortLabel: 'DE' },
  { code: 'es', label: 'Español', shortLabel: 'ES' },
  { code: 'fr', label: 'Français', shortLabel: 'FR' },
  // { code: 'ru', label: 'Русский', shortLabel: 'RU' },
  // { code: 'ar', label: 'العربية', shortLabel: 'AR' }, // RTL not supported
];

/** Default display language code. */
export const DEFAULT_LANG = SUPPORTED_LANGS[0].code;

/** All supported language codes. */
export const SUPPORTED_LANG_CODES: readonly string[] = SUPPORTED_LANGS.map((l) => l.code);
