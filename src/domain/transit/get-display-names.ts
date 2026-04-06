/**
 * Result of display name resolution.
 *
 * Common return type for `getXxxDisplayNames` resolvers
 * (e.g. {@link getStopDisplayNames}, {@link getHeadsignDisplayNames}).
 */
export interface ResolvedDisplayNames {
  /** Primary display name resolved for the requested language. */
  name: string;
  /**
   * Alternative names, deduplicated by value.
   * Excludes values that match `name`.
   * Empty array when no alternatives exist.
   */
  subNames: string[];
}

/**
 * Whether the resolved display names contain any displayable content.
 *
 * Returns `false` when `name` is empty and all `subNames` are empty strings.
 */
export function hasDisplayContent(names: ResolvedDisplayNames): boolean {
  return !!names.name || names.subNames.some(Boolean);
}
