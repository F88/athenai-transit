import { resolveMinPrefixLengths } from '../../utils/resolve-min-prefix-lengths';
import type { TimetableEntry } from '../../types/app/transit-composed';
import { getEffectiveHeadsign } from './get-effective-headsign';
import { getSelectedHeadsignDisplayName } from './get-headsign-display-names';

/**
 * Compute truncation lengths for timetable headsign badges using rendered labels.
 *
 * Timetable grouping keys are based on raw effective headsigns, but the UI shows
 * language-resolved labels. This helper derives the minimum visible length from
 * the rendered labels, then maps those lengths back to each raw headsign key so
 * callers can continue indexing by `getEffectiveHeadsign(...)`.
 *
 * When one raw headsign can render through multiple sources across entries
 * (for example some trips use `trip_headsign`, others `stop_headsign`), the
 * maximum required display length for that raw key is used.
 *
 * @param timetableEntries - Timetable entries whose headsign badges will be rendered.
 * @param preferredDisplayLangs - Ordered language fallback chain for display resolution.
 * @param resolveAgencyLangs - Resolve agency language priority for each agency_id.
 * @returns Map from raw effective headsign to the minimum safe truncation length.
 */
export function getTimetableHeadsignPrefixLengths(
  timetableEntries: readonly TimetableEntry[],
  preferredDisplayLangs: readonly string[],
  resolveAgencyLangs: (agencyId: string) => readonly string[],
): Map<string, number> {
  const displayLabelsByRawHeadsign = new Map<string, Set<string>>();

  for (const entry of timetableEntries) {
    const rawHeadsign = getEffectiveHeadsign(entry.routeDirection);
    const displayHeadsign = getSelectedHeadsignDisplayName(
      entry.routeDirection,
      rawHeadsign,
      preferredDisplayLangs,
      resolveAgencyLangs(entry.routeDirection.route.agency_id),
    );

    const labels = displayLabelsByRawHeadsign.get(rawHeadsign);
    if (labels) {
      labels.add(displayHeadsign);
    } else {
      displayLabelsByRawHeadsign.set(rawHeadsign, new Set([displayHeadsign]));
    }
  }

  const displayLabels = Array.from(
    new Set(
      Array.from(displayLabelsByRawHeadsign.values()).flatMap((labels) => Array.from(labels)),
    ),
  );
  const displayLengths = resolveMinPrefixLengths(displayLabels, 2);

  return new Map(
    Array.from(displayLabelsByRawHeadsign.entries()).map(([rawHeadsign, labels]) => [
      rawHeadsign,
      Math.max(...Array.from(labels, (label) => displayLengths.get(label) ?? label.length), 0),
    ]),
  );
}
