/**
 * Normalizes a stop name for fuzzy comparison across GTFS sources.
 *
 * Different providers use different conventions for the same physical stop.
 * This function reduces common variations so that names can be matched:
 *
 * - Trailing "前" removal: `渋谷駅前` → `渋谷駅`
 * - Small kana removal: `阿佐ヶ谷` / `阿佐ケ谷` → `阿佐谷`
 * - Kana normalization: `堀ノ内` → `堀の内`
 *
 * @param name - The stop name to normalize.
 * @returns The normalized name for comparison purposes.
 */
export function normalizeStopName(name: string): string {
  return name
    .replace(/前$/, '')
    .replace(/[ヶケが]/g, '')
    .replace(/ノ/g, 'の');
}
