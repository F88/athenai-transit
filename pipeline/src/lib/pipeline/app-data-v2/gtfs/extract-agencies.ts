/**
 * Extract AgencyJson[] from GTFS SQLite database (v2).
 *
 * Same structure as v1 — AgencyJson is an unchanged section.
 */

import type Database from 'better-sqlite3';

import type { AgencyJson } from '../../../../../../src/types/data/transit-json';
import type { Provider } from '../../../../types/resource-common';

/**
 * Extract all agencies from the GTFS database.
 *
 * @param db - SQLite database handle (readonly).
 * @param prefix - Source prefix for ID namespacing.
 * @param provider - Provider info for short name and colors.
 * @returns Array of AgencyJson records.
 */
export function extractAgenciesV2(
  db: Database.Database,
  prefix: string,
  provider: Provider,
): AgencyJson[] {
  const agencies = db
    .prepare(
      `SELECT agency_id, agency_name, agency_url, agency_lang,
              agency_timezone, agency_fare_url
       FROM agency
       ORDER BY agency_id`,
    )
    .all() as Array<{
    agency_id: string;
    agency_name: string;
    agency_url: string | null;
    agency_lang: string | null;
    agency_timezone: string | null;
    agency_fare_url: string | null;
  }>;

  const colors = (provider.colors ?? []).map((c) => ({ b: c.bg, t: c.text }));

  const result: AgencyJson[] = agencies.map((a) => ({
    i: `${prefix}:${a.agency_id}`,
    n: a.agency_name,
    sn: provider.name.ja.short,
    u: a.agency_url ?? '',
    l: a.agency_lang ?? '',
    tz: a.agency_timezone ?? '',
    fu: a.agency_fare_url ?? '',
    cs: colors,
  }));

  console.log(`  [${prefix}] ${agencies.length} agencies`);
  return result;
}
