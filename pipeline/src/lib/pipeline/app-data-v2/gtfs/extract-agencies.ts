/**
 * Extract AgencyV2Json[] from GTFS SQLite database.
 *
 * Outputs only data-source-derived fields. Display names (long/short)
 * and brand colors are managed on the App side via agency-attributes.ts.
 */

import type Database from 'better-sqlite3';

import type { AgencyV2Json } from '../../../../../../src/types/data/transit-v2-json';

/**
 * Extract all agencies from the GTFS database.
 *
 * @param db - SQLite database handle (readonly).
 * @param prefix - Source prefix for ID namespacing.
 * @returns Array of AgencyV2Json records.
 */
export function extractAgenciesV2(db: Database.Database, prefix: string): AgencyV2Json[] {
  const agencies = db
    .prepare(
      `SELECT agency_id, agency_name, agency_url, agency_timezone,
              agency_lang, agency_phone, agency_fare_url, agency_email,
              cemv_support
       FROM agency
       ORDER BY agency_id`,
    )
    .all() as Array<{
    agency_id: string;
    agency_name: string;
    agency_url: string | null;
    agency_timezone: string | null;
    agency_lang: string | null;
    agency_phone: string | null;
    agency_fare_url: string | null;
    agency_email: string | null;
    cemv_support: string | null;
  }>;

  const result: AgencyV2Json[] = agencies.map((a) => {
    const cemv = a.cemv_support != null ? Number(a.cemv_support) : undefined;
    return {
      v: 2 as const,
      i: `${prefix}:${a.agency_id}`,
      n: a.agency_name,
      u: a.agency_url ?? '',
      tz: a.agency_timezone ?? '',
      ...(a.agency_lang ? { l: a.agency_lang } : {}),
      ...(a.agency_phone ? { ph: a.agency_phone } : {}),
      ...(a.agency_fare_url ? { fu: a.agency_fare_url } : {}),
      ...(a.agency_email ? { em: a.agency_email } : {}),
      ...(cemv === 0 || cemv === 1 || cemv === 2 ? { cemv } : {}),
    };
  });

  console.log(`  [${prefix}] ${agencies.length} agencies`);
  return result;
}
