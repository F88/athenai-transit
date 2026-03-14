/**
 * @module FetchDataSource
 *
 * Loads GTFS JSON data via HTTP fetch from `/data/{prefix}/`.
 * Extracted from GtfsRepository.create() to separate data fetching
 * from data transformation.
 */

import { createLogger } from '../utils/logger';
import type {
  AgencyJson,
  CalendarJson,
  FeedInfoJson,
  RouteJson,
  ShapesJson,
  StopJson,
  TimetableJson,
  TranslationsJson,
} from '../types/data/transit-json';
import type { SourceData, TransitDataSource } from './transit-data-source';

const logger = createLogger('FetchDataSource');

/**
 * Loads GTFS JSON files via `fetch` from `/data/{prefix}/{file}.json`.
 *
 * Required files (stops, routes, calendar, timetable, shapes) are
 * fetched in parallel. Optional files (agency, feed-info, translations)
 * are fetched with graceful 404 handling.
 */
export class FetchDataSource implements TransitDataSource {
  /**
   * Load all GTFS data for a single source via HTTP fetch.
   *
   * @param prefix - Source identifier (e.g. "tobus").
   * @returns All raw JSON data for the source.
   * @throws When any required file fails to load (HTTP error or network failure).
   */
  async load(prefix: string): Promise<SourceData> {
    if (!/^[a-z0-9_-]+$/.test(prefix)) {
      throw new Error(`Invalid prefix: "${prefix}"`);
    }

    const t0 = performance.now();

    const fetchWithLog = async (file: string, optional: boolean): Promise<unknown> => {
      const path = `${prefix}/${file}.json`;
      const ft0 = performance.now();
      const r = await fetch(`/data/${path}`);

      if (optional && r.status === 404) {
        return null;
      }
      if (!r.ok) {
        if (optional) {
          return null;
        }
        throw new Error(`HTTP ${r.status} for ${path}`);
      }
      if (optional) {
        // SPA fallback rewrites (e.g. Vercel) return 200 + HTML for missing
        // files instead of 404. Detect this by checking content-type.
        const ct = r.headers.get('content-type') ?? '';
        if (!ct.includes('application/json')) {
          return null;
        }
      }

      const text = await r.text();
      const elapsed = Math.round(performance.now() - ft0);
      const sizeKB = (text.length / 1024).toFixed(1);
      logger.debug(`${path}: ${sizeKB}KB in ${elapsed}ms`);
      return JSON.parse(text) as unknown;
    };

    const [stops, routes, calendar, timetable, shapes, agencies, feedInfo, translations] =
      await Promise.all([
        fetchWithLog('stops', false),
        fetchWithLog('routes', false),
        fetchWithLog('calendar', false),
        fetchWithLog('timetable', false),
        fetchWithLog('shapes', true),
        fetchWithLog('agency', true),
        fetchWithLog('feed-info', true),
        fetchWithLog('translations', true),
      ]);

    const elapsed = Math.round(performance.now() - t0);
    logger.info(
      `Loaded ${prefix}/ in ${elapsed}ms: ${(stops as StopJson[]).length} stops, ${(routes as RouteJson[]).length} routes`,
    );

    return {
      prefix,
      stops: stops as StopJson[],
      routes: routes as RouteJson[],
      calendar: calendar as CalendarJson,
      timetable: timetable as TimetableJson,
      shapes: (shapes as ShapesJson | null) ?? {},
      agencies: (agencies as AgencyJson[] | null) ?? undefined,
      feedInfo: feedInfo as FeedInfoJson | null | undefined,
      translations: (translations as TranslationsJson | null) ?? undefined,
    };
  }
}
