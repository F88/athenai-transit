import type { Agency } from '../types/app/transit';

/**
 * Default agency languages used when agency_lang is not available.
 *
 * All current data sources are Japanese (feed_lang=ja).
 * When agency-specific lang becomes available, callers should
 * use {@link resolveAgencyLang} instead of this default.
 */
export const DEFAULT_AGENCY_LANG: readonly string[] = ['ja'];

/**
 * Default timezone for date/time display.
 *
 * All current data sources use Asia/Tokyo. This should eventually be
 * resolved from agency_timezone or map center position.
 * See Issue #65 for timezone-aware implementation.
 */
export const DEFAULT_TIMEZONE = 'Asia/Tokyo';

/**
 * Resolve agency language for subNames sort priority.
 *
 * Looks up the agency by ID and returns `[agency_lang]`.
 * Falls back to {@link DEFAULT_AGENCY_LANG} when the agency
 * is not found or agency_lang is empty.
 *
 * @param agencies - Available agencies.
 * @param agencyId - Agency ID to look up.
 * @returns Agency language array for sort priority.
 */
export function resolveAgencyLang(
  agencies: readonly Agency[],
  agencyId: string,
): readonly string[] {
  const lang = agencies.find((a) => a.agency_id === agencyId)?.agency_lang;
  return lang ? [lang] : DEFAULT_AGENCY_LANG;
}
