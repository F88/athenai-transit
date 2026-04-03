/**
 * Default agency languages used when agency_lang is not available.
 *
 * All current data sources are Japanese (feed_lang=ja).
 * When agency-specific lang becomes available, callers should
 * use agency.agency_lang instead of this default.
 */
export const DEFAULT_AGENCY_LANG: readonly string[] = ['ja'];
