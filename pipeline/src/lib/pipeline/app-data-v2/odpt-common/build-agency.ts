/**
 * Build AgencyV2Json[] from ODPT Provider data.
 *
 * ODPT JSON data does not include operator name/metadata (odpt:Operator
 * API is not downloaded). Provider config is used only for agency_id
 * generation. Display names (long/short) and brand colors are managed
 * on the App side via agency-attributes.ts.
 */

import type { AgencyV2Json } from '../../../../../../src/types/data/transit-v2-json';
import type { Provider } from '../../../../types/resource-common';

/**
 * Build AgencyV2Json[] from provider info.
 *
 * The agency_id scheme (`${prefix}:${provider.name.en.long}`) must stay
 * in sync with {@link buildRoutesV2}, which sets `RouteV2Json.ai` using
 * the same formula so that route → agency lookups succeed after merge.
 *
 * @param prefix - Source prefix for ID namespacing.
 * @param provider - Provider info used only for agency_id generation.
 * @returns Array with a single AgencyV2Json record.
 */
export function buildAgencyV2(prefix: string, provider: Provider): AgencyV2Json[] {
  return [
    {
      v: 2,
      i: `${prefix}:${provider.name.en.long}`,
      n: '',
      u: '',
      tz: 'Asia/Tokyo',
      l: 'ja',
    },
  ];
}
