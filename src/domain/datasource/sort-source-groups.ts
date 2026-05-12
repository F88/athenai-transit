import type { SourceGroup } from '../../types/app/source-group';
import { getSourceGroupDisplayName } from './get-source-group-display-name';

/**
 * Return a new array of source groups sorted for display in the data-source
 * settings dialog.
 *
 * Sort order (descending priority):
 * 1. Country code, ascending. Uses the group's first country code (most
 *    groups have a single country; multi-country / cross-border groups
 *    sort under their first listed country).
 * 2. Localized name, ascending, using `String.prototype.localeCompare(lang)`
 *    so Japanese groups sort by reading and Latin-script groups sort
 *    alphabetically.
 *
 * Ordering rationale: country first groups geographically (JP / DE / IT
 * etc. surface together), and within a country alphabetical helps users
 * scan a long list. Status (loaded / failed / not-attempted) is
 * intentionally NOT part of the sort key — Phase N source toggling will
 * change status at runtime, so a status-aware sort would re-order the
 * list under the user's cursor.
 *
 * @param groups - Source groups to sort. The input array is not mutated.
 * @param lang - UI language used both for `names` lookup and the
 *   collation locale of `localeCompare`.
 * @returns A new array sorted according to the rules above.
 */
export function sortSourceGroupsForDisplay(
  groups: readonly SourceGroup[],
  lang: string,
): SourceGroup[] {
  // V8 `Array.prototype.sort` has been stable since ES2019, so groups that
  // tie on both keys retain their original definition order — useful for
  // deterministic snapshots in tests.
  return [...groups].sort((a, b) => {
    const countryA = a.countries[0] ?? '';
    const countryB = b.countries[0] ?? '';
    const countryDiff = countryA.localeCompare(countryB);
    if (countryDiff !== 0) {
      return countryDiff;
    }
    const nameA = getSourceGroupDisplayName(a, lang);
    const nameB = getSourceGroupDisplayName(b, lang);
    return nameA.localeCompare(nameB, lang);
  });
}
