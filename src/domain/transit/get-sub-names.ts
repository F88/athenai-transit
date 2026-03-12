import type { Stop } from '../../types/app/transit';

/**
 * Extract alternative names (readings, translations) from a Stop,
 * excluding entries whose value matches the primary stop_name.
 *
 * Returns an array of { key, value } sorted by key for stable ordering.
 * Example: [{ key: "en", value: "Akebonobashi" }, { key: "ja-Hrkt", value: "あけぼのばし" }]
 */
export function getSubNames(stop: Stop): { key: string; value: string }[] {
  return Object.entries(stop.stop_names)
    .filter(([, value]) => value !== stop.stop_name)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ key, value }));
}
