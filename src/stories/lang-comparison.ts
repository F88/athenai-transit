import { SUPPORTED_LANGS } from '../config/supported-langs';
import { resolveLangChain } from '../domain/transit/i18n/resolve-lang-chain';

/** A single row definition for Storybook language comparison stories. */
export interface LangComparisonCase {
  /** Ordered language chain passed to component props. */
  dataLang: readonly string[];
  /** Row label shown in the story. */
  label: string;
}

/**
 * Standard language rows for multilingual Storybook comparisons.
 *
 * Supported languages use the same fallback chain as the app runtime.
 * One unsupported language row is included to verify direct, no-match
 * behavior, followed by a no-language row.
 */
export const LANG_COMPARISON_CASES: readonly LangComparisonCase[] = [
  ...SUPPORTED_LANGS.map(({ code }) => ({
    dataLang: resolveLangChain(code, SUPPORTED_LANGS),
    label: code,
  })),
  { dataLang: ['it'], label: 'it (unsupported)' },
  { dataLang: [], label: '(none)' },
];
