import { createInfoLevel } from '@/utils/create-info-level';
import type { RouteDisplayNames } from './get-route-display-names';
import type { InfoLevel } from '@/types/app/settings';

/**
 * Format a route label string from resolved display names.
 *
 * - simple: `name` only (e.g. "E", "都01")
 * - normal+: `name / subName1 / subName2` (e.g. "E / Oedo Line")
 *
 * Verbose-level raw field inspection is handled by the
 * {@link VerboseRoute} component, not by this formatter.
 *
 * @param names - Resolved route display names from {@link getRouteDisplayNames}.
 * @param infoLevel - Current info verbosity level.
 * @returns Formatted route label string.
 */
export function formatRouteLabel(names: RouteDisplayNames, infoLevel: InfoLevel): string {
  let ret = names.resolved.name || '?';
  const info = createInfoLevel(infoLevel);

  if (info.isNormalEnabled) {
    const subs = names.resolved.subNames.filter(Boolean);
    if (subs.length > 0) {
      ret += ' / ' + subs.join(' / ');
    }
  }
  return ret;
}
