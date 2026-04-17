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
    ['r3', 'agency:1', 'C', 'Route C', '', '3', '', '000000', '000000', '', '', '', '', ''].join(
      ',',
    ),
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

    expect(result.totalRoutes).toBe(3);
    expect(result.identityAndNames.both).toBe(2);
    expect(result.identityAndNames.longOnly).toBe(1);
    expect(result.identityAndNames.both + result.identityAndNames.longOnly).toBe(3);
    expect(result.routeTypes.distinctRouteTypes).toBe(2);
    expect(result.colorFields.both).toBe(2);
    expect(result.colorFields.neither).toBe(1);
    expect(result.colorFields.sameColorPairs).toBe(1);
    expect(result.colorFields.sameColorPairCounts).toEqual({ '000000/000000': 1 });
    expect(result.cemvSupport.supported).toBe(1);
    expect(result.cemvSupport.unknown).toBe(2);
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
    expect(report.totalRoutes).toBe(3);
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
    expect(output).toContain('## Overall summary');
    expect(output).toContain('sources=1, routes=3');
    expect(output).toContain(
      'names: shortOnly=0 (0.0% of routes), both=2 (66.7% of routes), longOnly=1 (33.3% of routes)',
    );
    expect(output).toContain(
      'colors: both=2 (66.7% of routes), samePair=1 (33.3% of routes), neither=1 (33.3% of routes), colorOnly=0 (0.0% of routes)',
    );
    expect(output).toContain('## Identity and names');
    expect(output).toContain('## Route types');
    expect(output).toContain('## Color fields');
    expect(output).toContain('## cEMV support');
    expect(output).toContain('## Continuous service fields');
    expect(output).toContain('## Optional presentation / operational fields');
    expect(output).toContain(
      'Shows whether each source relies on short names, long names, or both.',
    );
    expect(output).toContain('Shows whether each source is bus-only, multi-mode, or unexpected.');
    expect(output).toContain('route_short_name: nonEmpty=2, empty=1 (33.3% of routes empty)');
    expect(output).toContain('unknownRouteType=0 (0.0% of routes)');
    expect(output).toContain('State: All route_type values are known GTFS values.');
    expect(output).toContain('fatal pairs: sameColor=1 (33.3% of routes)');
    expect(output).toContain(
      'Fatal: Some routes use identical route_color and route_text_color and should be treated as data-quality issues.',
    );
    expect(output).toContain('same-color values: 000000/000000:1');
    expect(output).toContain('### Same-color values');
    expect(output).toContain('000000/000000');
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
