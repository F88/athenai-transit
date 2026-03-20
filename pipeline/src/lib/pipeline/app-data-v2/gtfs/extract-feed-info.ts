/**
 * Extract FeedInfoJson from GTFS SQLite database (v2).
 *
 * Same structure as v1 — FeedInfoJson is an unchanged section.
 */

import type Database from 'better-sqlite3';

import type { FeedInfoJson } from '../../../../../../src/types/data/transit-json';

/**
 * Extract feed_info from the GTFS database.
 *
 * @param db - SQLite database handle (readonly).
 * @param prefix - Source prefix (used for logging only).
 * @returns FeedInfoJson, or a default empty record if feed_info is absent.
 */
export function extractFeedInfoV2(db: Database.Database, prefix: string): FeedInfoJson {
  const row = db
    .prepare(
      `SELECT feed_publisher_name, feed_publisher_url, feed_lang,
              feed_start_date, feed_end_date, feed_version
       FROM feed_info
       LIMIT 1`,
    )
    .get() as
    | {
        feed_publisher_name: string;
        feed_publisher_url: string;
        feed_lang: string;
        feed_start_date: string | null;
        feed_end_date: string | null;
        feed_version: string | null;
      }
    | undefined;

  if (!row) {
    console.log(`  [${prefix}] no feed_info (using empty defaults)`);
    return { pn: '', pu: '', l: '', s: '', e: '', v: '' };
  }

  console.log(
    `  [${prefix}] feed_info: ${row.feed_publisher_name} (${row.feed_version ?? 'no version'})`,
  );
  return {
    pn: row.feed_publisher_name,
    pu: row.feed_publisher_url,
    l: row.feed_lang,
    s: row.feed_start_date ?? '',
    e: row.feed_end_date ?? '',
    v: row.feed_version ?? '',
  };
}
