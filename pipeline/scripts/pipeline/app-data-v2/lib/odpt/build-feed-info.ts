/**
 * Build FeedInfoJson from ODPT metadata.
 */

import type { FeedInfoJson } from '../../../../../../src/types/data/transit-json';
import type { Provider } from '../../../../../src/types/resource-common';
import { computeDateRange } from './build-calendar';

/**
 * Build FeedInfoJson from ODPT issued date and provider.
 *
 * @param issuedDate - Issued date string (YYYY-MM-DD).
 * @param provider - Provider info.
 * @returns FeedInfoJson record.
 */
export function buildFeedInfoV2(issuedDate: string, provider: Provider): FeedInfoJson {
  const { startDate, endDate } = computeDateRange(issuedDate);
  return {
    pn: provider.name.ja.long,
    pu: provider.url ?? '',
    l: 'ja',
    s: startDate,
    e: endDate,
    v: issuedDate,
  };
}
