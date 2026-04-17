import { describe, expect, it } from 'vitest';

import {
  GTFS_ROUTES_SECTION_NAMES,
  analyzeGtfsRoutesCsv,
  buildGtfsRoutesReport,
  formatGtfsRoutesAnalysis,
} from '../gtfs-routes-analysis';

/**
 * Smoke tests only. For this analysis tool, the exact numeric correctness
 * of every derived count is not asserted exhaustively here. These tests
 * guard against contract regressions and formatter crashes.
 */

function createRoutesCsv(): string {
  return [
    [
      'route_id',
      'agency_id',
      'route_short_name',
      'route_long_name',
      'route_desc',
      'route_type',
      'route_url',
      'route_color',
      'route_text_color',
      'route_sort_order',
      'network_id',
      'cemv_support',
      'continuous_pickup',
      'continuous_drop_off',
    ].join(','),
    [
      'r1',
      'agency:1',
      'A',
      'Route A',
      'Desc A',
      '3',
      'https://example.com/routes/a',
      '112233',
      'FFFFFF',
      '10',
      'network:a',
      '1',
      '2',
      '3',
    ].join(','),
    ['r2', 'agency:1', '', 'Route B', '', '4', '', '', '', '', '', '', '', ''].join(','),
  ].join('\n');
}

describe('analyzeGtfsRoutesCsv', () => {
  it('returns a stats object for a minimal valid routes.txt CSV', () => {
    const result = analyzeGtfsRoutesCsv({
      sourceName: 'test-source',
      prefix: 'test',
      nameEn: 'Test Transit',
      routesPath: '/tmp/test/routes.txt',
      csvText: createRoutesCsv(),
    });

    expect(result.totalRoutes).toBe(2);
    expect(result.identityAndNames.both).toBe(1);
    expect(result.identityAndNames.longOnly).toBe(1);
    expect(result.routeTypes.distinctRouteTypes).toBe(2);
    expect(result.colorFields.both).toBe(1);
    expect(result.colorFields.neither).toBe(1);
    expect(result.cemvSupport.supported).toBe(1);
    expect(result.cemvSupport.unknown).toBe(1);
    expect(result.continuousServiceFields.pickup.two).toBe(1);
    expect(result.continuousServiceFields.dropOff.three).toBe(1);
    expect(result.optionalPresentationFields.routeSortOrder.nonEmpty).toBe(1);
    expect(result.optionalPresentationFields.routeUrl.nonEmpty).toBe(1);
    expect(result.optionalPresentationFields.networkId.nonEmpty).toBe(1);
  });

  it('returns an empty stats object for an empty CSV', () => {
    const result = analyzeGtfsRoutesCsv({
      sourceName: 'empty-source',
      prefix: 'empty',
      nameEn: 'Empty Transit',
      routesPath: '/tmp/empty/routes.txt',
      csvText: '',
    });

    expect(result.totalRoutes).toBe(0);
    expect(result.routeTypes.fieldPresent).toBe(false);
    expect(result.colorFields.routeColor.fieldPresent).toBe(false);
  });
});

describe('report and formatter', () => {
  it('builds report metadata and total route count', () => {
    const result = analyzeGtfsRoutesCsv({
      sourceName: 'test-source',
      prefix: 'test',
      nameEn: 'Test Transit',
      routesPath: '/tmp/test/routes.txt',
      csvText: createRoutesCsv(),
    });

    const report = buildGtfsRoutesReport([result], {
      analyzedAt: new Date('2026-01-01T00:00:00Z'),
    });

    expect(report.meta.sourceCount).toBe(1);
    expect(report.totalRoutes).toBe(2);
    expect(report.sources[0]?.sourceName).toBe('test-source');
  });

  it('emits the expected section headers', () => {
    const result = analyzeGtfsRoutesCsv({
      sourceName: 'test-source',
      prefix: 'test',
      nameEn: 'Test Transit',
      routesPath: '/tmp/test/routes.txt',
      csvText: createRoutesCsv(),
    });

    const output = formatGtfsRoutesAnalysis([result], {
      analyzedAt: new Date('2026-01-01T00:00:00Z'),
    });

    expect(output).toContain('# Athenai Transit — GTFS routes.txt analysis');
    expect(output).toContain('## Identity and names');
    expect(output).toContain('## Route types');
    expect(output).toContain('## Color fields');
    expect(output).toContain('## cEMV support');
    expect(output).toContain('## Continuous service fields');
    expect(output).toContain('## Optional presentation / operational fields');
  });

  it('filters output to the requested sections', () => {
    const result = analyzeGtfsRoutesCsv({
      sourceName: 'test-source',
      prefix: 'test',
      nameEn: 'Test Transit',
      routesPath: '/tmp/test/routes.txt',
      csvText: createRoutesCsv(),
    });

    const output = formatGtfsRoutesAnalysis([result], {
      analyzedAt: new Date('2026-01-01T00:00:00Z'),
      sections: [GTFS_ROUTES_SECTION_NAMES[1], GTFS_ROUTES_SECTION_NAMES[2]],
    });

    expect(output).toContain('## Route types');
    expect(output).toContain('## Color fields');
    expect(output).not.toContain('## Identity and names');
    expect(output).not.toContain('## cEMV support');
  });

  it('treats an empty sections array as all sections', () => {
    const result = analyzeGtfsRoutesCsv({
      sourceName: 'test-source',
      prefix: 'test',
      nameEn: 'Test Transit',
      routesPath: '/tmp/test/routes.txt',
      csvText: createRoutesCsv(),
    });

    const output = formatGtfsRoutesAnalysis([result], {
      analyzedAt: new Date('2026-01-01T00:00:00Z'),
      sections: [],
    });

    expect(output).toContain('## Identity and names');
    expect(output).toContain('## Route types');
    expect(output).toContain('## Optional presentation / operational fields');
  });
});
