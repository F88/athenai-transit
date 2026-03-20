/**
 * Parse GTFS feed_info.txt from extracted text files.
 *
 * Uses the existing {@link splitCsvLine} utility for RFC 4180 CSV parsing.
 * Returns null if the file does not exist or is empty.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { FeedInfoMeta } from '../download/download-meta';
import { splitCsvLine } from './gtfs-csv-parser';

/**
 * Parse feed_info.txt from a GTFS directory.
 *
 * @param gtfsDir - Path to the directory containing GTFS .txt files.
 * @returns Parsed feed info, or null if feed_info.txt is missing or empty.
 */
export function parseFeedInfoTxt(gtfsDir: string): FeedInfoMeta | null {
  const filePath = join(gtfsDir, 'feed_info.txt');
  if (!existsSync(filePath)) {
    return null;
  }

  const text = readFileSync(filePath, 'utf-8').trim();
  if (!text) {
    return null;
  }

  const lines = text.split('\n').map((line) => line.trim().replace(/\r$/, ''));
  if (lines.length < 2) {
    return null;
  }

  const headers = splitCsvLine(lines[0]);
  const values = splitCsvLine(lines[1]);

  const record: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    record[headers[i]] = values[i] ?? '';
  }

  return {
    publisherName: record['feed_publisher_name'] ?? '',
    publisherUrl: record['feed_publisher_url'] ?? '',
    lang: record['feed_lang'] ?? '',
    startDate: record['feed_start_date'] ?? '',
    endDate: record['feed_end_date'] ?? '',
    version: record['feed_version'] ?? '',
  };
}
