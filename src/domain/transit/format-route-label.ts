import { createInfoLevel } from '@/utils/create-info-level';
import type { RouteDisplayNames } from './get-route-display-names';
import type { InfoLevel } from '@/types/app/settings';

/**
 * Format a route label string from resolved display names.
 *
 * - simple: `name` only (e.g. "E", "都01")
 * - normal+: `name / subName1 / subName2` (e.g. "E / Oedo Line")
 * - verbose: appends raw `[shortName|longName]` for data inspection
 *   (e.g. "E / Oedo Line [E|大江戸線]")
 *
 * @param names - Resolved route display names from {@link getRouteDisplayNames}.
 * @param infoLevel - Current info verbosity level.
 * @returns Formatted route label string.
 */

export function formatRouteLabel(names: RouteDisplayNames, infoLevel: InfoLevel): string {
  let ret = names.name || '?';
  const info = createInfoLevel(infoLevel);

  if (info.isNormalEnabled) {
    const subs = names.subNames.filter(Boolean);
    if (subs.length > 0) {
      ret += ' / ' + subs.join(' / ');
    }
  }

  if (info.isVerboseEnabled) {
    const sl = [
      //
      names.shortName || 'N/A',
      names.longName || 'N/A',
    ].join('|');
    ret += ` [${sl}]`;
  }

  return ret;
}
