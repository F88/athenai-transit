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

    logger.debug(`Fetching ${prefix}/ JSON files`);

    const fetchAndParse = (file: string) =>
      fetch(`/data/${prefix}/${file}.json`).then((r) => {
        if (!r.ok) {
          throw new Error(`HTTP ${r.status} for ${prefix}/${file}.json`);
        }
        return r.json() as Promise<unknown>;
      });

    const fetchOptional = (file: string) =>
      fetch(`/data/${prefix}/${file}.json`).then((r) => {
        if (r.status === 404) {
          return null;
        }
        if (!r.ok) {
          throw new Error(`HTTP ${r.status} for ${prefix}/${file}.json`);
        }
        return r.json() as Promise<unknown>;
      });

    const [stops, routes, calendar, timetable, shapes, agencies, feedInfo, translations] =
      await Promise.all([
        fetchAndParse('stops'),
        fetchAndParse('routes'),
        fetchAndParse('calendar'),
        fetchAndParse('timetable'),
        fetchAndParse('shapes'),
        fetchOptional('agency'),
        fetchOptional('feed-info'),
        fetchOptional('translations'),
      ]);

    logger.debug(
      `Loaded ${prefix}/: ${(stops as StopJson[]).length} stops, ${(routes as RouteJson[]).length} routes`,
    );

    return {
      prefix,
      stops: stops as StopJson[],
      routes: routes as RouteJson[],
      calendar: calendar as CalendarJson,
      timetable: timetable as TimetableJson,
      shapes: shapes as ShapesJson,
      agencies: (agencies as AgencyJson[] | null) ?? undefined,
      feedInfo: feedInfo as FeedInfoJson | null | undefined,
      translations: (translations as TranslationsJson | null) ?? undefined,
    };
  }
}
