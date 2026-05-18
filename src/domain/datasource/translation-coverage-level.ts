function normalizeLanguageTag(language: string): string {
  return language.trim().toLowerCase();
}

function toPrimaryLanguage(language: string): string {
  return normalizeLanguageTag(language).split(/[-_]/)[0] ?? '';
}

function getPrimaryLanguages(languages: ReadonlySet<string>): ReadonlySet<string> {
  const primaryLanguages = new Set<string>();
  for (const language of languages) {
    const primaryLanguage = toPrimaryLanguage(language);
    if (primaryLanguage !== '') {
      primaryLanguages.add(primaryLanguage);
    }
  }
  return primaryLanguages;
}

/**
 * Maps translation language diversity to a compact 5-level scale.
 *
 * Language tags are normalized case-insensitively and collapsed to their
 * primary language subtag (`ja-Hrkt` -> `ja`, `en-US` -> `en`) before
 * counting distinct languages.
 *
 * When two or more raw language tags are present, the result is at least
 * level 2 even if they collapse to a single primary language (for example
 * `ja` + `ja-Hrkt` still indicates richer coverage than a single tag).
 *
 * - 1: 0-1 raw language tags
 * - 2: 2+ raw language tags, 1 primary language
 * - 3: 2 primary languages
 * - 4: 3-9 primary languages
 * - 5: 10+ primary languages
 */
export function toTranslationCoverageLevel(languages: ReadonlySet<string>): number {
  if (languages.size <= 1) {
    return 1;
  }

  const primaryLanguageCount = getPrimaryLanguages(languages).size;
  if (primaryLanguageCount <= 1) {
    return 2;
  }
  if (primaryLanguageCount === 2) {
    return 3;
  }
  if (primaryLanguageCount === 3) {
    return 4;
  }
  if (primaryLanguageCount >= 10) {
    return 5;
  }
  return 4;
}
