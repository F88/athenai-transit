import { SUPPORTED_LANGS } from '../../config/supported-langs';
import type { SourceGroup } from '../../types/app/source-group';
import { resolveLangChain } from '../transit/i18n/resolve-lang-chain';
import { resolveTranslatableText } from '../transit/i18n/resolve-translatable-text';

/**
 * Resolve the display name for a {@link SourceGroup} against a given UI
 * language.
 *
 * Walks the project's lang-fallback chain via {@link resolveLangChain}
 * and looks up the first matching translation with
 * {@link resolveTranslatableText}, falling back to the canonical
 * `name` when none match.
 *
 * The lang chain is what makes UI-only variants like `ja-Hrkt` (kana)
 * resolve to the underlying `ja` translation rather than dropping
 * straight to the English canonical label. With
 * `resolveLangChain('ja-Hrkt', SUPPORTED_LANGS)` returning
 * `['ja-Hrkt', 'ja', 'en']`, a SourceGroup whose `names` carries only
 * `ja` and `en` still serves a kana-mode user the Japanese label.
 * The same mechanism handles `zh-Hant` → `zh-Hans` → `en`, `de` → `en`,
 * `ko` → `en`, etc. — all consistent with how stop and agency names
 * are resolved elsewhere in the app.
 *
 * @param group - The source group to resolve a display name for.
 * @param lang - The current UI language code (e.g. `'ja'`, `'ja-Hrkt'`,
 *   `'en'`, `'zh-Hant'`).
 * @returns A non-empty display name string.
 */
export function getSourceGroupDisplayName(group: SourceGroup, lang: string): string {
  const chain = resolveLangChain(lang, SUPPORTED_LANGS);
  return resolveTranslatableText(group.name, chain).resolved.value;
}
