/**
 * Build AgencyJson[] from ODPT Provider data.
 */

import type { AgencyJson } from '../../../../../src/types/data/transit-json';
import type { Provider } from '../../../../src/types/resource-common';

/**
 * Build AgencyJson[] from provider info.
 *
 * @param prefix - Source prefix for ID namespacing.
 * @param provider - Provider info.
 * @returns Array with a single AgencyJson record.
 */
export function buildAgencyV2(prefix: string, provider: Provider): AgencyJson[] {
  const colors = (provider.colors ?? []).map((c) => ({ b: c.bg, t: c.text }));
  return [
    {
      i: `${prefix}:${provider.name.en.long}`,
      n: provider.name.ja.long,
      sn: provider.name.ja.short,
      u: provider.url ?? '',
      l: 'ja',
      tz: 'Asia/Tokyo',
      fu: '',
      cs: colors,
    },
  ];
}
