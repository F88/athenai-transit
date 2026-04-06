import type { SupportedLang } from '../../../config/supported-langs';

/** Ordered language fallback chain (e.g. `['zh-Hant', 'zh-Hans', 'en']`). */
export type LangChain = readonly string[];

/**
 * Resolve the fallback chain for a language code.
 *
 * Returns an ordered array of language codes to try, starting with the
 * given `lang` and following each entry's `fallback` until the chain ends.
 * Intended to be called once when `lang` changes, not per render.
 *
 * @param lang - Starting language code.
 * @param langs - Language definitions with fallback chains.
 * @returns Ordered fallback chain (e.g. `['zh-Hant', 'zh-Hans', 'en']`).
 *
 * @example
 * ```ts
 * resolveLangChain('zh-Hant', SUPPORTED_LANGS); // → ['zh-Hant', 'zh-Hans', 'en']
 * resolveLangChain('ja', SUPPORTED_LANGS);      // → ['ja', 'en']
 * resolveLangChain('en', SUPPORTED_LANGS);      // → ['en']
 * ```
 */
export function resolveLangChain(lang: string, langs: readonly SupportedLang[]): LangChain {
  const chain: string[] = [];
  const seen = new Set<string>();
  let current: string | undefined = lang;

  // Case-insensitive comparison per BCP 47 (RFC 5646 §2.1.1).
  // All entries use canonical codes from langs (not raw input casing).
  while (current != null) {
    const lower: string = current.toLowerCase();
    if (seen.has(lower)) {
      break;
    }
    const match: SupportedLang | undefined = langs.find((l) => l.code.toLowerCase() === lower);
    chain.push(match?.code ?? current);
    seen.add(lower);
    current = match?.fallback;
  }

  return chain;
}
