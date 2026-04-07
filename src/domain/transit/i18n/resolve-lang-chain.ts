import type { SupportedLang } from '../../../config/supported-langs';
import { createLogger } from '../../../lib/logger';

const logger = createLogger('LangChain');

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

  // Insert parent language prefixes after the last subtag variant of the
  // same language family (e.g. zh-Hant → zh-Hans → [zh] → en).
  // This allows data keyed by the generic language code (e.g. "zh") to be
  // found after explicit fallbacks but before unrelated languages.
  // Build set of all codes already in chain (including those from fallback)
  // to avoid duplicate prefix insertion.
  const chainLower = new Set(chain.map((c) => c.toLowerCase()));
  const result: string[] = [];
  const inserted = new Set<string>();
  for (let i = 0; i < chain.length; i++) {
    const code = chain[i];
    result.push(code);
    inserted.add(code.toLowerCase());

    const dash = code.indexOf('-');
    if (dash !== -1) {
      const prefix = code.slice(0, dash);
      const prefixLower = prefix.toLowerCase();
      // Insert prefix if: not already in chain (from fallback or earlier prefix),
      // and the next chain entry is NOT the same language family.
      if (!chainLower.has(prefixLower) && !inserted.has(prefixLower)) {
        const nextCode = chain[i + 1];
        const nextIsFamily = nextCode?.toLowerCase().startsWith(prefixLower + '-');
        if (!nextIsFamily) {
          result.push(prefix);
          inserted.add(prefixLower);
        }
      }
    }
  }

  logger.debug(`${lang} → [${result.join(' → ')}]`);
  return result;
}
