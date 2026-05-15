import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type {
  DataSourceCatalogBundle,
  DataSourceCatalogDateRange,
  DataSourceCatalogSource,
} from '@contracts/data/transit-v2-catalog-json';
import type {
  DataBundle,
  GlobalInsightsBundle,
  InsightsBundle,
  ShapesBundle,
  StopV2Json,
} from '@contracts/data/transit-v2-json';

import { getDistanceKmLight } from '../../geo-utils';
import { V2_OUTPUT_DIR } from '../../paths';
import { loadAllGtfsSources } from '../../resources/load-gtfs-sources';
import { discoverOdptTrainSources } from '../../resources/load-odpt-train-sources';

interface ResolvedCatalogTarget {
  prefix: string;
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
}

function readRequiredJsonFile<T>(filePath: string, label: string): T {
  if (!existsSync(filePath)) {
    throw new Error(`Missing required ${label}: ${filePath}`);
  }
  return readJsonFile<T>(filePath);
}

function countSection(section: { data: unknown }): number {
  if (Array.isArray(section.data)) {
    return section.data.length;
  }
  if (typeof section.data === 'object' && section.data !== null) {
    return Object.keys(section.data as Record<string, unknown>).length;
  }
  return 0;
}

function countTranslations(bundle: DataBundle): number {
  let count = 0;
  for (const section of Object.values(bundle.translations.data)) {
    count += Object.keys(section as Record<string, unknown>).length;
  }
  return count;
}

function countLookupEntries(bundle: DataBundle): number {
  let count = 0;
  for (const section of Object.values(bundle.lookup.data)) {
    count += Object.keys(section as Record<string, unknown>).length;
  }
  return count;
}

function emptyToNull(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null;
}

function buildDateRange(start: string | null, end: string | null): DataSourceCatalogDateRange {
  return { start, end };
}

function minMaxDate(values: string[]): DataSourceCatalogDateRange {
  if (values.length === 0) {
    return { start: null, end: null };
  }

  let start = values[0];
  let end = values[0];
  for (const value of values) {
    if (value < start) {
      start = value;
    }
    if (value > end) {
      end = value;
    }
  }

  return { start, end };
}

function extractTranslationLanguages(bundle: DataBundle): string[] {
  const languages = new Set<string>();
  for (const section of Object.values(bundle.translations.data)) {
    for (const translations of Object.values(section as Record<string, Record<string, string>>)) {
      for (const language of Object.keys(translations)) {
        languages.add(language);
      }
    }
  }
  return Array.from(languages).sort();
}

function buildRouteTypeCounts(bundle: DataBundle): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const route of bundle.routes.data) {
    const key = String(route.t);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function buildStopLocationTypes(
  stops: StopV2Json[],
): Record<string, { count: number; hasParentCount: number }> {
  const result: Record<string, { count: number; hasParentCount: number }> = {};
  for (const stop of stops) {
    const key = String(stop.l);
    const current = result[key] ?? { count: 0, hasParentCount: 0 };
    current.count += 1;
    if (stop.ps) {
      current.hasParentCount += 1;
    }
    result[key] = current;
  }
  return result;
}

function buildStopBbox(stops: StopV2Json[]): null | {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
} {
  if (stops.length === 0) {
    return null;
  }

  let latMin = stops[0].a;
  let latMax = stops[0].a;
  let lonMin = stops[0].o;
  let lonMax = stops[0].o;
  for (const stop of stops) {
    if (stop.a < latMin) {
      latMin = stop.a;
    }
    if (stop.a > latMax) {
      latMax = stop.a;
    }
    if (stop.o < lonMin) {
      lonMin = stop.o;
    }
    if (stop.o > lonMax) {
      lonMax = stop.o;
    }
  }

  return { latMin, latMax, lonMin, lonMax };
}

function buildDataBundleSummary(bundle: DataBundle, filePath: string) {
  return {
    file: {
      sizeBytes: statSync(filePath).size,
    },
    counts: {
      stops: bundle.stops.data.length,
      routes: bundle.routes.data.length,
      agency: bundle.agency.data.length,
      calendar: countSection(bundle.calendar),
      feedInfo: 1,
      timetable: countSection(bundle.timetable),
      tripPatterns: countSection(bundle.tripPatterns),
      translations: countTranslations(bundle),
      lookup: countLookupEntries(bundle),
    },
  };
}

function buildInsightsBundleSummary(bundle: InsightsBundle, filePath: string) {
  return {
    file: {
      sizeBytes: statSync(filePath).size,
    },
    counts: {
      serviceGroups: bundle.serviceGroups.data.length,
      tripPatternStats: bundle.tripPatternStats
        ? Object.keys(bundle.tripPatternStats.data).length
        : 0,
      tripPatternGeo: bundle.tripPatternGeo ? Object.keys(bundle.tripPatternGeo.data).length : 0,
      stopStats: bundle.stopStats ? Object.keys(bundle.stopStats.data).length : 0,
    },
  };
}

function buildShapesBundleSummary(bundle: ShapesBundle, filePath: string) {
  let polylines = 0;
  let points = 0;
  let totalLengthKm = 0;

  for (const routePolylines of Object.values(bundle.shapes.data)) {
    polylines += routePolylines.length;
    for (const polyline of routePolylines) {
      points += polyline.length;
      for (let i = 1; i < polyline.length; i++) {
        const prev = polyline[i - 1];
        const current = polyline[i];
        totalLengthKm += getDistanceKmLight(prev[0], prev[1], current[0], current[1]);
      }
    }
  }

  return {
    file: {
      sizeBytes: statSync(filePath).size,
    },
    counts: {
      routes: Object.keys(bundle.shapes.data).length,
    },
    volume: {
      polylines,
      points,
      totalLengthKm,
    },
  };
}

function buildCatalogSource(
  dataBundle: DataBundle,
  dataFilePath: string,
  insightsBundle: InsightsBundle,
  insightsFilePath: string,
  shapesBundle: ShapesBundle | null,
  shapesFilePath: string,
): DataSourceCatalogSource {
  return {
    summary: {
      periods: {
        feedValidity: buildDateRange(
          emptyToNull(dataBundle.feedInfo.data.s),
          emptyToNull(dataBundle.feedInfo.data.e),
        ),
        servicePeriod: minMaxDate(
          dataBundle.calendar.data.services.flatMap((service) => [service.s, service.e]),
        ),
        exceptionRange: minMaxDate(
          dataBundle.calendar.data.exceptions.map((exception) => exception.d),
        ),
      },
      agencies: dataBundle.agency.data.map((agency) => ({
        name: agency.n,
        ...(agency.l ? { lang: agency.l } : {}),
        timezone: agency.tz,
      })),
      i18n: {
        languages: extractTranslationLanguages(dataBundle),
      },
      routes: {
        typeCounts: buildRouteTypeCounts(dataBundle),
      },
      stops: {
        locationTypes: buildStopLocationTypes(dataBundle.stops.data),
        geo: {
          bbox: buildStopBbox(dataBundle.stops.data),
        },
      },
    },
    bundles: {
      dataBundle: buildDataBundleSummary(dataBundle, dataFilePath),
      insightsBundle: buildInsightsBundleSummary(insightsBundle, insightsFilePath),
      ...(shapesBundle
        ? { shapesBundle: buildShapesBundleSummary(shapesBundle, shapesFilePath) }
        : {}),
    },
  };
}

async function resolveCatalogTargets(prefixes: string[]): Promise<ResolvedCatalogTarget[]> {
  const knownPrefixes = new Set<string>();

  for (const source of await loadAllGtfsSources()) {
    knownPrefixes.add(source.pipeline.prefix);
  }
  for (const source of await discoverOdptTrainSources()) {
    knownPrefixes.add(source.prefix);
  }

  return prefixes.map((prefix) => {
    if (!knownPrefixes.has(prefix)) {
      throw new Error(`Unknown target prefix: ${prefix}`);
    }
    return { prefix };
  });
}

function buildGlobalInsightsSummary(filePath: string): {
  file: { sizeBytes: number };
  counts: { stopGeo: number };
} {
  const bundle = readRequiredJsonFile<GlobalInsightsBundle>(filePath, 'global insights bundle');
  return {
    file: {
      sizeBytes: statSync(filePath).size,
    },
    counts: {
      stopGeo: bundle.stopGeo ? Object.keys(bundle.stopGeo.data).length : 0,
    },
  };
}

export async function buildDataSourceCatalogBundle(
  targetPrefixes: string[],
): Promise<DataSourceCatalogBundle> {
  const resolvedTargets = await resolveCatalogTargets(targetPrefixes);
  const sources: Record<string, DataSourceCatalogSource> = {};

  for (const target of resolvedTargets) {
    const sourceDir = join(V2_OUTPUT_DIR, target.prefix);
    const dataFilePath = join(sourceDir, 'data.json');
    const insightsFilePath = join(sourceDir, 'insights.json');
    const shapesFilePath = join(sourceDir, 'shapes.json');

    const dataBundle = readRequiredJsonFile<DataBundle>(dataFilePath, `${target.prefix}/data.json`);
    const insightsBundle = readRequiredJsonFile<InsightsBundle>(
      insightsFilePath,
      `${target.prefix}/insights.json`,
    );
    const shapesBundle = existsSync(shapesFilePath)
      ? readJsonFile<ShapesBundle>(shapesFilePath)
      : null;

    sources[target.prefix] = buildCatalogSource(
      dataBundle,
      dataFilePath,
      insightsBundle,
      insightsFilePath,
      shapesBundle,
      shapesFilePath,
    );
  }

  return {
    bundle_version: 3,
    kind: 'data-source-catalog',
    metadata: {
      v: 1,
      data: {
        createdAt: new Date().toISOString(),
      },
    },
    sources: {
      v: 1,
      data: sources,
    },
    globalInsights: {
      v: 1,
      data: buildGlobalInsightsSummary(join(V2_OUTPUT_DIR, 'global', 'insights.json')),
    },
  };
}
