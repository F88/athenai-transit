/**
 * Build RouteV2Json[] from ODPT Railway data.
 */

import type { RouteV2Json } from '../../../../../src/types/data/transit-v2-json';
import type { OdptRailway } from '../../../../src/types/odpt-train';
import type { Provider } from '../../../../src/types/resource-common';

/**
 * Build RouteV2Json[] from a single ODPT railway.
 *
 * @param prefix - Source prefix for ID namespacing.
 * @param railway - ODPT railway data.
 * @param provider - Provider info for agency_id.
 * @returns Array of RouteV2Json records (typically one per railway).
 */
export function buildRoutesV2(
  prefix: string,
  railway: OdptRailway,
  provider: Provider,
): RouteV2Json[] {
  const title = railway['odpt:railwayTitle'];
  const color = railway['odpt:color'].replace('#', '');
  const routeId = `${prefix}:${railway['odpt:lineCode']}`;

  return [
    {
      v: 2,
      i: routeId,
      s: '',
      l: title.ja,
      t: 2, // Rail
      c: color,
      tc: '',
      ai: `${prefix}:${provider.name.en.long}`,
    },
  ];
}
