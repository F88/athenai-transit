import type { TranslatableText } from '@/types/app/transit-composed';

/**
 * Build a {@link TranslatableText} from a base name and an optional
 * translation table.
 *
 * `translations` is keyed by the base name and yields a per-language
 * record of translated values. When the base name has no entry (or the
 * translations table itself is unavailable), an empty `names` object is
 * returned, so callers can always read `result.names` safely.
 *
 * Used to wrap GTFS-derived strings (trip_headsign, stop_headsign, etc.)
 * with their multilingual variants from the merged translations table.
 */
export function buildTranslatableText(
  name: string,
  translations: Record<string, Record<string, string>> | undefined,
): TranslatableText {
  return {
    name,
    names: translations?.[name] ?? {},
  };
}
