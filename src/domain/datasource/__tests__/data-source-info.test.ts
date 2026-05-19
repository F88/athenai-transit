import type { DataSourceCatalogSource } from '@contracts/data/transit-v2-catalog-json';
import { describe, expect, it } from 'vitest';
import type { SourceMeta } from '../../../types/app/transit-composed';
import { composeDataSourceInfo } from '../data-source-info';

function makeCatalogSource(
  overrides: Partial<DataSourceCatalogSource> = {},
): DataSourceCatalogSource {
  const base: DataSourceCatalogSource = {
    bundles: {
      dataBundle: {
        file: { sizeBytes: 1000 },
        counts: {
          stops: 0,
          routes: 0,
          agency: 0,
          calendar: 0,
          feedInfo: 0,
          timetable: 0,
          tripPatterns: 0,
          translations: 0,
          lookup: 0,
        },
      },
      insightsBundle: {
        file: { sizeBytes: 200 },
        counts: { serviceGroups: 0, tripPatternStats: 0, tripPatternGeo: 0, stopStats: 0 },
      },
    },
    summary: {
      periods: {
        feedValidity: { start: '20260101', end: '20261231' },
        servicePeriod: { start: '20260101', end: '20260930' },
        exceptionRange: { start: null, end: null },
      },
      agencies: [{ name: 'Default Agency', timezone: 'Asia/Tokyo' }],
      i18n: { languages: ['ja'] },
      routes: { typeCounts: { '3': 5 } },
      stops: {
        locationTypes: {
          '0': { count: 100, hasParentCount: 0 },
          '1': { count: 5, hasParentCount: 0 },
        },
        geo: { bbox: null },
      },
      service: {
        operatingDates: { first: '20260101', last: '20260930', count: 200 },
        maxTripsPerDay: 50,
      },
      shapes: { available: true, routeCount: 3 },
    },
  };
  return { ...base, ...overrides };
}

function makeSourceMeta(
  id = 'kobus',
  feedInfoOverrides: Partial<SourceMeta['feedInfo']> = {},
): SourceMeta {
  return {
    id,
    feedInfo: {
      publisherName: 'Pub',
      publisherUrl: 'https://example.com',
      version: '20260301_001',
      lang: 'ja',
      ...feedInfoOverrides,
    },
  };
}

describe('composeDataSourceInfo', () => {
  it('passes feedVersion through from SourceMeta.feedInfo.version', () => {
    const info = composeDataSourceInfo(
      'kobus',
      makeSourceMeta('kobus', { version: 'v1' }),
      undefined,
    );
    expect(info.feedVersion).toBe('v1');
  });

  it('returns null feedVersion when SourceMeta.feedInfo.version is null', () => {
    const info = composeDataSourceInfo(
      'kobus',
      makeSourceMeta('kobus', { version: null }),
      undefined,
    );
    expect(info.feedVersion).toBeNull();
  });

  it('returns null feedVersion when no SourceMeta', () => {
    const info = composeDataSourceInfo('kobus', undefined, makeCatalogSource());
    expect(info.feedVersion).toBeNull();
  });

  it('uses catalog feedValidity when available (already nullable)', () => {
    const catalogSource = makeCatalogSource({
      summary: {
        ...makeCatalogSource().summary,
        periods: {
          feedValidity: { start: '20260101', end: null },
          servicePeriod: { start: null, end: null },
          exceptionRange: { start: null, end: null },
        },
      },
    });
    const info = composeDataSourceInfo('kobus', makeSourceMeta(), catalogSource);
    expect(info.feedValidity).toEqual({ start: '20260101', end: null });
  });

  it('returns null feedValidity when catalog is missing', () => {
    const info = composeDataSourceInfo('kobus', makeSourceMeta(), undefined);
    expect(info.feedValidity).toBeNull();
  });

  it('exposes servicePeriod from catalog', () => {
    const info = composeDataSourceInfo('kobus', makeSourceMeta(), makeCatalogSource());
    expect(info.servicePeriod).toEqual({ start: '20260101', end: '20260930' });
  });

  it('returns null servicePeriod when catalog is missing', () => {
    const info = composeDataSourceInfo('kobus', makeSourceMeta(), undefined);
    expect(info.servicePeriod).toBeNull();
  });

  it('sums catalog bundle sizes (data + insights + shapes when present)', () => {
    const catalogSource = makeCatalogSource({
      bundles: {
        ...makeCatalogSource().bundles,
        shapesBundle: {
          file: { sizeBytes: 300 },
          counts: { routes: 0 },
          volume: { polylines: 0, points: 0, totalLengthKm: 0 },
        },
      },
    });
    const info = composeDataSourceInfo('kobus', makeSourceMeta(), catalogSource);
    expect(info.totalSizeBytes).toBe(1000 + 200 + 300);
  });

  it('omits shapes contribution when shapesBundle is absent', () => {
    const info = composeDataSourceInfo('kobus', makeSourceMeta(), makeCatalogSource());
    expect(info.totalSizeBytes).toBe(1000 + 200);
  });

  it('returns null totalSizeBytes when catalog is missing', () => {
    const info = composeDataSourceInfo('kobus', makeSourceMeta(), undefined);
    expect(info.totalSizeBytes).toBeNull();
  });

  it('reads maxTripsPerDay from catalog summary', () => {
    const info = composeDataSourceInfo('kobus', makeSourceMeta(), makeCatalogSource());
    expect(info.maxTripsPerDay).toBe(50);
  });

  it('reads operatingDates from catalog summary', () => {
    const info = composeDataSourceInfo('kobus', makeSourceMeta(), makeCatalogSource());
    expect(info.operatingDates).toEqual({
      first: '20260101',
      last: '20260930',
      count: 200,
    });
  });

  it('returns null maxTripsPerDay when catalog is missing', () => {
    const info = composeDataSourceInfo('kobus', makeSourceMeta(), undefined);
    expect(info.maxTripsPerDay).toBeNull();
  });

  it('returns null operatingDates when catalog is missing', () => {
    const info = composeDataSourceInfo('kobus', makeSourceMeta(), undefined);
    expect(info.operatingDates).toBeNull();
  });

  it('returns null operatingDates when catalog summary does not carry it', () => {
    const catalogSource = makeCatalogSource({
      summary: {
        ...makeCatalogSource().summary,
        service: { maxTripsPerDay: 50 },
      },
    });

    const info = composeDataSourceInfo('kobus', makeSourceMeta(), catalogSource);
    expect(info.operatingDates).toBeNull();
  });

  it('reads boardingStopsCount from locationTypes[0]', () => {
    const info = composeDataSourceInfo('kobus', makeSourceMeta(), makeCatalogSource());
    expect(info.boardingStopsCount).toBe(100);
  });

  it('reads routes.typeCounts from catalog summary', () => {
    const info = composeDataSourceInfo('kobus', makeSourceMeta(), makeCatalogSource());
    expect(info.routes).toEqual({ typeCounts: { 3: 5 } });
  });

  it('normalizes unsupported route types into -1', () => {
    const catalogSource = makeCatalogSource({
      summary: {
        ...makeCatalogSource().summary,
        routes: { typeCounts: { '3': 5, '100': 2 } },
      },
    });

    const info = composeDataSourceInfo('kobus', makeSourceMeta(), catalogSource);
    expect(info.routes).toEqual({ typeCounts: { 3: 5, [-1]: 2 } });
  });

  it('returns null routes when catalog is missing', () => {
    const info = composeDataSourceInfo('kobus', makeSourceMeta(), undefined);
    expect(info.routes).toBeNull();
  });

  it('returns null boardingStopsCount when locationTypes[0] is missing', () => {
    const catalogSource = makeCatalogSource({
      summary: {
        ...makeCatalogSource().summary,
        stops: { locationTypes: {}, geo: { bbox: null } },
      },
    });
    const info = composeDataSourceInfo('kobus', makeSourceMeta(), catalogSource);
    expect(info.boardingStopsCount).toBeNull();
  });

  it('returns null boardingStopsCount when catalog is missing', () => {
    const info = composeDataSourceInfo('kobus', makeSourceMeta(), undefined);
    expect(info.boardingStopsCount).toBeNull();
  });

  it('reads routeShapes.count from catalog summary', () => {
    const info = composeDataSourceInfo('kobus', makeSourceMeta(), makeCatalogSource());
    expect(info.routeShapes).toEqual({ count: 3 });
  });

  it('returns null routeShapes when catalog says shapes are unavailable', () => {
    const catalogSource = makeCatalogSource({
      summary: {
        ...makeCatalogSource().summary,
        shapes: { available: false, routeCount: 0 },
      },
    });
    const info = composeDataSourceInfo('kobus', makeSourceMeta(), catalogSource);
    expect(info.routeShapes).toBeNull();
  });

  it('returns null routeShapes when catalog is missing', () => {
    const info = composeDataSourceInfo('kobus', makeSourceMeta(), undefined);
    expect(info.routeShapes).toBeNull();
  });

  it('reads translationLanguages from catalog summary i18n.languages', () => {
    const catalogSource = makeCatalogSource({
      summary: { ...makeCatalogSource().summary, i18n: { languages: ['ja', 'en'] } },
    });
    const info = composeDataSourceInfo('kobus', makeSourceMeta(), catalogSource);
    expect(info.translationLanguages).toEqual(['ja', 'en']);
  });

  it('returns null translationLanguages when catalog is missing', () => {
    const info = composeDataSourceInfo('kobus', makeSourceMeta(), undefined);
    expect(info.translationLanguages).toBeNull();
  });

  it('preserves an empty translationLanguages array when catalog declares zero translations', () => {
    const catalogSource = makeCatalogSource({
      summary: { ...makeCatalogSource().summary, i18n: { languages: [] } },
    });
    const info = composeDataSourceInfo('kobus', makeSourceMeta(), catalogSource);
    expect(info.translationLanguages).toEqual([]);
  });
});
