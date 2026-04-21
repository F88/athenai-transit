/**
 * Pure analysis helpers for GTFS `routes.txt` files.
 *
 * Covers current-state `routes.txt` sections only:
 *   - identity and names
 *   - route types
 *   - color fields
 *   - cEMV support
 *   - continuous service fields
 *   - optional presentation / operational fields
 *
 * The CLI wrapper is responsible for locating sources and reading files.
 */

import { splitCsvLine } from '../../../src/lib/pipeline/gtfs-csv-parser';
import { type AnalysisSectionDefinition } from './analysis-sections';
import { renderTable } from './render-utils';

export interface PresenceCount {
  nonEmpty: number;
  empty: number;
}

export interface FieldCoverage extends PresenceCount {
  fieldPresent: boolean;
}

export interface AnalyzeGtfsRoutesCsvInput {
  sourceName: string;
  prefix: string;
  nameEn: string;
  routesPath: string;
  csvText: string;
}

export interface NameFieldsStats {
  agencyId: FieldCoverage;
  routeShortName: FieldCoverage;
  routeLongName: FieldCoverage;
  routeDesc: FieldCoverage;
  shortOnly: number;
  longOnly: number;
  both: number;
  neither: number;
}

export interface RouteTypesStats {
  fieldPresent: boolean;
  distinctRouteTypes: number;
  counts: Record<string, number>;
  unknown: number;
}

export interface ColorFieldsStats {
  routeColor: FieldCoverage;
  routeTextColor: FieldCoverage;
  routeColorEmptyRate: number;
  routeTextColorEmptyRate: number;
  colorOnly: number;
  textOnly: number;
  both: number;
  neither: number;
  sameColorPairs: number;
  distinctRouteColors: number;
  distinctRouteTextColors: number;
  sameColorPairCounts: Record<string, number>;
}

export interface CemvSupportStats {
  fieldPresent: boolean;
  unknown: number;
  supported: number;
  unsupported: number;
  other: number;
  known: number;
  knownRate: number;
}

export interface ContinuousValueCounts {
  empty: number;
  zero: number;
  one: number;
  two: number;
  three: number;
  other: number;
}

export interface ContinuousServiceFieldsStats {
  pickupFieldPresent: boolean;
  dropOffFieldPresent: boolean;
  pickup: ContinuousValueCounts;
  dropOff: ContinuousValueCounts;
  pickupNonDefault: number;
  dropOffNonDefault: number;
  bothNonDefault: number;
}

export interface OptionalPresentationFieldsStats {
  routeSortOrder: FieldCoverage;
  routeUrl: FieldCoverage;
  networkId: FieldCoverage;
}

export interface GtfsRoutesSourceStats {
  sourceName: string;
  prefix: string;
  nameEn: string;
  routesPath: string;
  totalRoutes: number;
  identityAndNames: NameFieldsStats;
  routeTypes: RouteTypesStats;
  colorFields: ColorFieldsStats;
  cemvSupport: CemvSupportStats;
  continuousServiceFields: ContinuousServiceFieldsStats;
  optionalPresentationFields: OptionalPresentationFieldsStats;
}

export interface GtfsRoutesAnalysisReport {
  meta: {
    analyzedAt: string;
    sourceCount: number;
  };
  totalRoutes: number;
  sources: GtfsRoutesSourceStats[];
}

export type GtfsRoutesSectionName =
  | 'identity-and-names'
  | 'route-types'
  | 'color-fields'
  | 'cemv-support'
  | 'continuous-service-fields'
  | 'optional-presentation-fields';

export type GtfsRoutesSectionDefinition = AnalysisSectionDefinition<
  GtfsRoutesSourceStats[],
  GtfsRoutesSectionName
>;

const ROUTE_TYPE_LABELS: Record<string, string> = {
  '0': 'tram',
  '1': 'subway',
  '2': 'rail',
  '3': 'bus',
  '4': 'ferry',
  '5': 'cable-tram',
  '6': 'aerial-lift',
  '7': 'funicular',
  '11': 'trolleybus',
  '12': 'monorail',
};

function isNonEmpty(value: string | undefined): boolean {
  return (value ?? '').trim() !== '';
}

function createFieldCoverage(fieldPresent: boolean): FieldCoverage {
  return { fieldPresent, nonEmpty: 0, empty: 0 };
}

function createContinuousValueCounts(): ContinuousValueCounts {
  return { empty: 0, zero: 0, one: 0, two: 0, three: 0, other: 0 };
}

function toRate(count: number, total: number): number {
  if (total === 0) {
    return 0;
  }
  return (count / total) * 100;
}

function countDistinctNonEmpty(values: string[]): number {
  const valuesSet = new Set<string>();

  for (const value of values) {
    if (!isNonEmpty(value)) {
      continue;
    }
    valuesSet.add(value);
  }

  return valuesSet.size;
}

function incrementRecordCount(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function addFieldValue(coverage: FieldCoverage, value: string): void {
  if (isNonEmpty(value)) {
    coverage.nonEmpty += 1;
  } else {
    coverage.empty += 1;
  }
}

function addContinuousValue(counts: ContinuousValueCounts, value: string): void {
  const normalized = value.trim();

  if (normalized === '') {
    counts.empty += 1;
    return;
  }

  if (normalized === '0') {
    counts.zero += 1;
    return;
  }
  if (normalized === '1') {
    counts.one += 1;
    return;
  }
  if (normalized === '2') {
    counts.two += 1;
    return;
  }
  if (normalized === '3') {
    counts.three += 1;
    return;
  }

  counts.other += 1;
}

function sumPresence(
  results: GtfsRoutesSourceStats[],
  select: (result: GtfsRoutesSourceStats) => PresenceCount,
) {
  return results.reduce(
    (acc, result) => {
      const value = select(result);
      acc.nonEmpty += value.nonEmpty;
      acc.empty += value.empty;
      return acc;
    },
    { nonEmpty: 0, empty: 0 },
  );
}

function sumNumber(
  results: GtfsRoutesSourceStats[],
  select: (result: GtfsRoutesSourceStats) => number,
): number {
  return results.reduce((acc, result) => acc + select(result), 0);
}

function sumRecordCounts(
  results: GtfsRoutesSourceStats[],
  select: (result: GtfsRoutesSourceStats) => Record<string, number>,
): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const result of results) {
    const counts = select(result);
    for (const [key, count] of Object.entries(counts)) {
      totals[key] = (totals[key] ?? 0) + count;
    }
  }

  return totals;
}

function sumContinuousCounts(
  results: GtfsRoutesSourceStats[],
  select: (result: GtfsRoutesSourceStats) => ContinuousValueCounts,
): ContinuousValueCounts {
  return results.reduce((acc, result) => {
    const counts = select(result);
    acc.empty += counts.empty;
    acc.zero += counts.zero;
    acc.one += counts.one;
    acc.two += counts.two;
    acc.three += counts.three;
    acc.other += counts.other;
    return acc;
  }, createContinuousValueCounts());
}

function countSourcesWithField(
  results: GtfsRoutesSourceStats[],
  select: (result: GtfsRoutesSourceStats) => boolean,
): number {
  return results.filter(select).length;
}

function getTotalRoutes(results: GtfsRoutesSourceStats[]): number {
  return sumNumber(results, (result) => result.totalRoutes);
}

function formatRouteTypeSummary(counts: Record<string, number>): string {
  const entries = Object.entries(counts).sort(([left], [right]) => Number(left) - Number(right));

  if (entries.length === 0) {
    return '-';
  }

  return entries
    .map(([value, count]) => {
      const label = ROUTE_TYPE_LABELS[value];
      return label ? `${value}(${label}):${count}` : `${value}:${count}`;
    })
    .join(', ');
}

function formatContinuousSummary(counts: ContinuousValueCounts): string {
  const parts: string[] = [];

  if (counts.empty > 0) {
    parts.push(`empty:${counts.empty}`);
  }
  if (counts.zero > 0) {
    parts.push(`0:${counts.zero}`);
  }
  if (counts.one > 0) {
    parts.push(`1:${counts.one}`);
  }
  if (counts.two > 0) {
    parts.push(`2:${counts.two}`);
  }
  if (counts.three > 0) {
    parts.push(`3:${counts.three}`);
  }
  if (counts.other > 0) {
    parts.push(`other:${counts.other}`);
  }

  return parts.length === 0 ? '-' : parts.join(', ');
}

function formatColorPairValue(color: string, textColor: string): string {
  return `${color}/${textColor}`;
}

function formatTopCounts(counts: Record<string, number>, limit: number): string {
  const entries = Object.entries(counts).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  });

  if (entries.length === 0) {
    return '-';
  }

  return entries
    .slice(0, limit)
    .map(([value, count]) => `${value}:${count}`)
    .join(', ');
}

function formatFieldMarker(fieldPresent: boolean): string {
  return fieldPresent ? 'yes' : 'no';
}

function formatPercent(count: number, total: number): string {
  return `${toRate(count, total).toFixed(1)}%`;
}

function formatEmptyRate(label: string, value: PresenceCount): string {
  const total = value.nonEmpty + value.empty;
  return `${label}: nonEmpty=${value.nonEmpty}, empty=${value.empty} (${formatPercent(value.empty, total)} of routes empty)`;
}

function renderSection(title: string, description: string, body: string): string {
  return [`## ${title}`, '', description, '', body].join('\n');
}

function formatOverallSummary(results: GtfsRoutesSourceStats[]): string {
  const totalRoutes = getTotalRoutes(results);
  const sourceCount = results.length;
  const bothNames = sumNumber(results, (result) => result.identityAndNames.both);
  const shortOnlyNames = sumNumber(results, (result) => result.identityAndNames.shortOnly);
  const longOnlyNames = sumNumber(results, (result) => result.identityAndNames.longOnly);
  const routeTypeCounts = sumRecordCounts(results, (result) => result.routeTypes.counts);
  const multiModeSources = sumNumber(results, (result) =>
    result.routeTypes.distinctRouteTypes > 1 ? 1 : 0,
  );
  const nonBusRoutes = Object.entries(routeTypeCounts).reduce((acc, [value, count]) => {
    return value === '3' ? acc : acc + count;
  }, 0);
  const unknownRouteType = sumNumber(results, (result) => result.routeTypes.unknown);
  const colorBoth = sumNumber(results, (result) => result.colorFields.both);
  const colorNeither = sumNumber(results, (result) => result.colorFields.neither);
  const colorOnly = sumNumber(results, (result) => result.colorFields.colorOnly);
  const sameColorPairs = sumNumber(results, (result) => result.colorFields.sameColorPairs);
  const routeUrl = sumPresence(results, (result) => result.optionalPresentationFields.routeUrl);
  const routeSortOrder = sumPresence(
    results,
    (result) => result.optionalPresentationFields.routeSortOrder,
  );
  const networkId = sumPresence(results, (result) => result.optionalPresentationFields.networkId);
  const sourcesWithCemvField = countSourcesWithField(
    results,
    (result) => result.cemvSupport.fieldPresent,
  );
  const pickupNonDefault = sumNumber(
    results,
    (result) => result.continuousServiceFields.pickupNonDefault,
  );
  const dropOffNonDefault = sumNumber(
    results,
    (result) => result.continuousServiceFields.dropOffNonDefault,
  );

  return [
    '## Overall summary',
    '',
    'Quick overview of naming style, route types, color coverage, and optional field usage before section details.',
    '',
    `sources=${sourceCount}, routes=${totalRoutes}`,
    `names: shortOnly=${shortOnlyNames} (${formatPercent(shortOnlyNames, totalRoutes)} of routes), both=${bothNames} (${formatPercent(bothNames, totalRoutes)} of routes), longOnly=${longOnlyNames} (${formatPercent(longOnlyNames, totalRoutes)} of routes)`,
    `route types: multiModeSources=${multiModeSources}/${sourceCount} (${formatPercent(multiModeSources, sourceCount)} of sources), nonBusRoutes=${nonBusRoutes} (${formatPercent(nonBusRoutes, totalRoutes)} of routes), unknown=${unknownRouteType}`,
    `colors: both=${colorBoth} (${formatPercent(colorBoth, totalRoutes)} of routes), samePair=${sameColorPairs} (${formatPercent(sameColorPairs, totalRoutes)} of routes), neither=${colorNeither} (${formatPercent(colorNeither, totalRoutes)} of routes), colorOnly=${colorOnly} (${formatPercent(colorOnly, totalRoutes)} of routes)`,
    `optional fields: route_url=${routeUrl.nonEmpty} (${formatPercent(routeUrl.nonEmpty, totalRoutes)} of routes), route_sort_order=${routeSortOrder.nonEmpty} (${formatPercent(routeSortOrder.nonEmpty, totalRoutes)} of routes), network_id=${networkId.nonEmpty} (${formatPercent(networkId.nonEmpty, totalRoutes)} of routes)`,
    `unused fields: cemv_support headers=${sourcesWithCemvField}/${sourceCount} (${formatPercent(sourcesWithCemvField, sourceCount)} of sources), continuous non-default=pickup ${pickupNonDefault} / drop_off ${dropOffNonDefault}`,
  ].join('\n');
}

function formatIdentityAndNamesSectionBody(results: GtfsRoutesSourceStats[]): string {
  const totalRoutes = getTotalRoutes(results);
  const shortName = sumPresence(results, (result) => result.identityAndNames.routeShortName);
  const longName = sumPresence(results, (result) => result.identityAndNames.routeLongName);
  const routeDesc = sumPresence(results, (result) => result.identityAndNames.routeDesc);
  const agencyId = sumPresence(results, (result) => result.identityAndNames.agencyId);
  const both = sumNumber(results, (result) => result.identityAndNames.both);
  const shortOnly = sumNumber(results, (result) => result.identityAndNames.shortOnly);
  const longOnly = sumNumber(results, (result) => result.identityAndNames.longOnly);
  const neither = sumNumber(results, (result) => result.identityAndNames.neither);

  const summary = renderTable(
    [
      'source',
      'prefix',
      'routes',
      'short',
      'long',
      'both',
      'shortOnly',
      'longOnly',
      'neither',
      'desc',
      'agencyId',
    ],
    results.map((result) => [
      result.sourceName,
      result.prefix,
      String(result.totalRoutes),
      String(result.identityAndNames.routeShortName.nonEmpty),
      String(result.identityAndNames.routeLongName.nonEmpty),
      String(result.identityAndNames.both),
      String(result.identityAndNames.shortOnly),
      String(result.identityAndNames.longOnly),
      String(result.identityAndNames.neither),
      String(result.identityAndNames.routeDesc.nonEmpty),
      String(result.identityAndNames.agencyId.nonEmpty),
    ]),
    3,
  );

  return [
    '### Totals',
    '',
    `routes=${totalRoutes}`,
    formatEmptyRate('route_short_name', shortName),
    formatEmptyRate('route_long_name', longName),
    formatEmptyRate('route_desc', routeDesc),
    formatEmptyRate('agency_id', agencyId),
    `name combinations: both=${both} (${formatPercent(both, totalRoutes)} of routes), shortOnly=${shortOnly} (${formatPercent(shortOnly, totalRoutes)} of routes), longOnly=${longOnly} (${formatPercent(longOnly, totalRoutes)} of routes), neither=${neither} (${formatPercent(neither, totalRoutes)} of routes)`,
    '',
    '### Summary',
    '',
    summary,
  ].join('\n');
}

function formatRouteTypesSectionBody(results: GtfsRoutesSourceStats[]): string {
  const combinedCounts = sumRecordCounts(results, (result) => result.routeTypes.counts);
  const totalRoutes = getTotalRoutes(results);
  const sourcesWithRouteTypeField = countSourcesWithField(
    results,
    (result) => result.routeTypes.fieldPresent,
  );
  const unknownRouteType = sumNumber(results, (result) => result.routeTypes.unknown);
  const summary = renderTable(
    ['source', 'prefix', 'routes', 'typeField', 'distinctTypes', 'unknown', 'types'],
    results.map((result) => [
      result.sourceName,
      result.prefix,
      String(result.totalRoutes),
      formatFieldMarker(result.routeTypes.fieldPresent),
      String(result.routeTypes.distinctRouteTypes),
      String(result.routeTypes.unknown),
      formatRouteTypeSummary(result.routeTypes.counts),
    ]),
    3,
  );

  const lines = [
    '### Totals',
    '',
    `routes=${totalRoutes}`,
    `sourcesWithRouteTypeField=${sourcesWithRouteTypeField}/${results.length} (${formatPercent(sourcesWithRouteTypeField, results.length)} of sources)`,
    `unknownRouteType=${unknownRouteType} (${formatPercent(unknownRouteType, totalRoutes)} of routes)`,
    `route_type values: ${formatRouteTypeSummary(combinedCounts)}`,
  ];
  if (unknownRouteType === 0) {
    lines.push('State: All route_type values are known GTFS values.');
  }
  lines.push('', '### Summary', '', summary);
  return lines.join('\n');
}

function formatColorFieldsSectionBody(results: GtfsRoutesSourceStats[]): string {
  const totalRoutes = getTotalRoutes(results);
  const routeColor = sumPresence(results, (result) => result.colorFields.routeColor);
  const routeTextColor = sumPresence(results, (result) => result.colorFields.routeTextColor);
  const both = sumNumber(results, (result) => result.colorFields.both);
  const colorOnly = sumNumber(results, (result) => result.colorFields.colorOnly);
  const textOnly = sumNumber(results, (result) => result.colorFields.textOnly);
  const neither = sumNumber(results, (result) => result.colorFields.neither);
  const sameColorPairs = sumNumber(results, (result) => result.colorFields.sameColorPairs);
  const sameColorPairCounts = sumRecordCounts(
    results,
    (result) => result.colorFields.sameColorPairCounts,
  );
  const summary = renderTable(
    [
      'source',
      'prefix',
      'routes',
      'colorField',
      'textField',
      'colorNonEmpty',
      'colorEmpty',
      'textNonEmpty',
      'textEmpty',
      'both',
      'samePair',
      'colorOnly',
      'textOnly',
      'neither',
      'distinctColors',
      'distinctTextColors',
    ],
    results.map((result) => [
      result.sourceName,
      result.prefix,
      String(result.totalRoutes),
      formatFieldMarker(result.colorFields.routeColor.fieldPresent),
      formatFieldMarker(result.colorFields.routeTextColor.fieldPresent),
      String(result.colorFields.routeColor.nonEmpty),
      String(result.colorFields.routeColor.empty),
      String(result.colorFields.routeTextColor.nonEmpty),
      String(result.colorFields.routeTextColor.empty),
      String(result.colorFields.both),
      String(result.colorFields.sameColorPairs),
      String(result.colorFields.colorOnly),
      String(result.colorFields.textOnly),
      String(result.colorFields.neither),
      String(result.colorFields.distinctRouteColors),
      String(result.colorFields.distinctRouteTextColors),
    ]),
    3,
  );

  const sameColorValuesTable = renderTable(
    ['source', 'prefix', 'pair', 'count', 'share'],
    results.flatMap((result) => {
      const entries = Object.entries(result.colorFields.sameColorPairCounts).sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }
        return left[0].localeCompare(right[0]);
      });

      return entries
        .slice(0, 5)
        .map(([pair, count]) => [
          result.sourceName,
          result.prefix,
          pair,
          String(count),
          formatPercent(count, result.totalRoutes),
        ]);
    }),
    3,
  );

  const lines = [
    '### Totals',
    '',
    `routes=${totalRoutes}`,
    formatEmptyRate('route_color', routeColor),
    formatEmptyRate('route_text_color', routeTextColor),
    `pairings: both=${both} (${formatPercent(both, totalRoutes)} of routes), colorOnly=${colorOnly} (${formatPercent(colorOnly, totalRoutes)} of routes), textOnly=${textOnly} (${formatPercent(textOnly, totalRoutes)} of routes), neither=${neither} (${formatPercent(neither, totalRoutes)} of routes)`,
    `fatal pairs: sameColor=${sameColorPairs} (${formatPercent(sameColorPairs, totalRoutes)} of routes)`,
  ];
  if (sameColorPairs > 0) {
    lines.push(
      'Fatal: Some routes use identical route_color and route_text_color and should be treated as data-quality issues.',
    );
    lines.push(`same-color values: ${formatTopCounts(sameColorPairCounts, 5)}`);
  }
  if (colorOnly > 0 && textOnly === 0) {
    lines.push('Anomaly: Some sources provide route_color without route_text_color.');
  }
  lines.push('', '### Summary', '', summary);
  if (sameColorPairs > 0) {
    lines.push('', '### Same-color values', '', sameColorValuesTable);
  }
  return lines.join('\n');
}

function formatCemvSupportSectionBody(results: GtfsRoutesSourceStats[]): string {
  const totalRoutes = getTotalRoutes(results);
  const sourcesWithCemvField = countSourcesWithField(
    results,
    (result) => result.cemvSupport.fieldPresent,
  );
  const known = sumNumber(results, (result) => result.cemvSupport.known);
  const unknown = sumNumber(results, (result) => result.cemvSupport.unknown);
  const supported = sumNumber(results, (result) => result.cemvSupport.supported);
  const unsupported = sumNumber(results, (result) => result.cemvSupport.unsupported);
  const other = sumNumber(results, (result) => result.cemvSupport.other);
  const summary = renderTable(
    [
      'source',
      'prefix',
      'routes',
      'field',
      'known',
      'unknown',
      'supported',
      'unsupported',
      'other',
      'known(%)',
    ],
    results.map((result) => [
      result.sourceName,
      result.prefix,
      String(result.totalRoutes),
      formatFieldMarker(result.cemvSupport.fieldPresent),
      String(result.cemvSupport.known),
      String(result.cemvSupport.unknown),
      String(result.cemvSupport.supported),
      String(result.cemvSupport.unsupported),
      String(result.cemvSupport.other),
      result.cemvSupport.knownRate.toFixed(1),
    ]),
    3,
  );

  const lines = [
    '### Totals',
    '',
    `routes=${totalRoutes}`,
    `sourcesWithCemvField=${sourcesWithCemvField}/${results.length} (${formatPercent(sourcesWithCemvField, results.length)} of sources)`,
  ];
  if (sourcesWithCemvField === 0) {
    lines.push('State: No sources currently use cemv_support.');
  }
  lines.push(
    `known=${known} (${formatPercent(known, totalRoutes)} of routes), unknown=${unknown} (${formatPercent(unknown, totalRoutes)} of routes), supported=${supported} (${formatPercent(supported, totalRoutes)} of routes), unsupported=${unsupported} (${formatPercent(unsupported, totalRoutes)} of routes), other=${other} (${formatPercent(other, totalRoutes)} of routes)`,
  );
  lines.push('', '### Summary', '', summary);
  return lines.join('\n');
}

function formatContinuousServiceFieldsSectionBody(results: GtfsRoutesSourceStats[]): string {
  const totalRoutes = getTotalRoutes(results);
  const pickupTotals = sumContinuousCounts(
    results,
    (result) => result.continuousServiceFields.pickup,
  );
  const dropOffTotals = sumContinuousCounts(
    results,
    (result) => result.continuousServiceFields.dropOff,
  );
  const sourcesWithPickupField = countSourcesWithField(
    results,
    (result) => result.continuousServiceFields.pickupFieldPresent,
  );
  const sourcesWithDropOffField = countSourcesWithField(
    results,
    (result) => result.continuousServiceFields.dropOffFieldPresent,
  );
  const pickupNonDefault = sumNumber(
    results,
    (result) => result.continuousServiceFields.pickupNonDefault,
  );
  const dropOffNonDefault = sumNumber(
    results,
    (result) => result.continuousServiceFields.dropOffNonDefault,
  );
  const bothNonDefault = sumNumber(
    results,
    (result) => result.continuousServiceFields.bothNonDefault,
  );
  const summary = renderTable(
    [
      'source',
      'prefix',
      'routes',
      'pickupField',
      'dropOffField',
      'pickupValues',
      'dropOffValues',
      'pickupNonDefault',
      'dropOffNonDefault',
      'bothNonDefault',
    ],
    results.map((result) => [
      result.sourceName,
      result.prefix,
      String(result.totalRoutes),
      formatFieldMarker(result.continuousServiceFields.pickupFieldPresent),
      formatFieldMarker(result.continuousServiceFields.dropOffFieldPresent),
      formatContinuousSummary(result.continuousServiceFields.pickup),
      formatContinuousSummary(result.continuousServiceFields.dropOff),
      String(result.continuousServiceFields.pickupNonDefault),
      String(result.continuousServiceFields.dropOffNonDefault),
      String(result.continuousServiceFields.bothNonDefault),
    ]),
    3,
  );

  const lines = [
    '### Totals',
    '',
    `routes=${totalRoutes}`,
    `sourcesWithPickupField=${sourcesWithPickupField}/${results.length} (${formatPercent(sourcesWithPickupField, results.length)} of sources)`,
    `sourcesWithDropOffField=${sourcesWithDropOffField}/${results.length} (${formatPercent(sourcesWithDropOffField, results.length)} of sources)`,
  ];
  if (pickupNonDefault === 0 && dropOffNonDefault === 0) {
    lines.push('State: continuous_pickup and continuous_drop_off are unused across all sources.');
  }
  lines.push(
    `pickup values: ${formatContinuousSummary(pickupTotals)}`,
    `drop_off values: ${formatContinuousSummary(dropOffTotals)}`,
    `non-default usage: pickup=${pickupNonDefault} (${formatPercent(pickupNonDefault, totalRoutes)} of routes), drop_off=${dropOffNonDefault} (${formatPercent(dropOffNonDefault, totalRoutes)} of routes), both=${bothNonDefault} (${formatPercent(bothNonDefault, totalRoutes)} of routes)`,
  );
  lines.push('', '### Summary', '', summary);
  return lines.join('\n');
}

function formatOptionalPresentationFieldsSectionBody(results: GtfsRoutesSourceStats[]): string {
  const totalRoutes = getTotalRoutes(results);
  const routeSortOrder = sumPresence(
    results,
    (result) => result.optionalPresentationFields.routeSortOrder,
  );
  const routeUrl = sumPresence(results, (result) => result.optionalPresentationFields.routeUrl);
  const networkId = sumPresence(results, (result) => result.optionalPresentationFields.networkId);
  const summary = renderTable(
    [
      'source',
      'prefix',
      'routes',
      'sortField',
      'sortNonEmpty',
      'urlField',
      'urlNonEmpty',
      'networkField',
      'networkNonEmpty',
    ],
    results.map((result) => [
      result.sourceName,
      result.prefix,
      String(result.totalRoutes),
      formatFieldMarker(result.optionalPresentationFields.routeSortOrder.fieldPresent),
      String(result.optionalPresentationFields.routeSortOrder.nonEmpty),
      formatFieldMarker(result.optionalPresentationFields.routeUrl.fieldPresent),
      String(result.optionalPresentationFields.routeUrl.nonEmpty),
      formatFieldMarker(result.optionalPresentationFields.networkId.fieldPresent),
      String(result.optionalPresentationFields.networkId.nonEmpty),
    ]),
    3,
  );

  const lines = [
    '### Totals',
    '',
    `routes=${totalRoutes}`,
    formatEmptyRate('route_sort_order', routeSortOrder),
    formatEmptyRate('route_url', routeUrl),
    formatEmptyRate('network_id', networkId),
  ];
  if (
    routeSortOrder.nonEmpty === 0 &&
    countSourcesWithField(
      results,
      (result) => result.optionalPresentationFields.routeSortOrder.fieldPresent,
    ) > 0
  ) {
    lines.push(
      'State: route_sort_order headers exist in some sources, but no non-empty values are present.',
    );
  }
  lines.push('', '### Summary', '', summary);
  return lines.join('\n');
}

export const GTFS_ROUTES_SECTIONS = {
  'identity-and-names': {
    name: 'identity-and-names',
    title: 'Identity and names',
    description: 'Shows whether each source relies on short names, long names, or both.',
    render: formatIdentityAndNamesSectionBody,
  },
  'route-types': {
    name: 'route-types',
    title: 'Route types',
    description: 'Shows whether each source is bus-only, multi-mode, or unexpected.',
    render: formatRouteTypesSectionBody,
  },
  'color-fields': {
    name: 'color-fields',
    title: 'Color fields',
    description: 'Shows whether route_color and route_text_color are complete as pairs.',
    render: formatColorFieldsSectionBody,
  },
  'cemv-support': {
    name: 'cemv-support',
    title: 'cEMV support',
    description: 'Shows whether cemv_support is used at all and whether support states are known.',
    render: formatCemvSupportSectionBody,
  },
  'continuous-service-fields': {
    name: 'continuous-service-fields',
    title: 'Continuous service fields',
    description:
      'Shows whether continuous service fields are used and whether any non-default values appear.',
    render: formatContinuousServiceFieldsSectionBody,
  },
  'optional-presentation-fields': {
    name: 'optional-presentation-fields',
    title: 'Optional presentation / operational fields',
    description: 'Shows whether optional presentation fields are actually used, not just declared.',
    render: formatOptionalPresentationFieldsSectionBody,
  },
} satisfies Record<GtfsRoutesSectionName, GtfsRoutesSectionDefinition>;

export const GTFS_ROUTES_SECTION_NAMES: readonly GtfsRoutesSectionName[] = [
  'identity-and-names',
  'route-types',
  'color-fields',
  'cemv-support',
  'continuous-service-fields',
  'optional-presentation-fields',
];

export function analyzeGtfsRoutesCsv(input: AnalyzeGtfsRoutesCsvInput): GtfsRoutesSourceStats {
  const normalized = input.csvText.replace(/^\uFEFF/, '').trimEnd();
  const lines = normalized === '' ? [] : normalized.split(/\r?\n/);

  if (lines.length === 0) {
    return {
      sourceName: input.sourceName,
      prefix: input.prefix,
      nameEn: input.nameEn,
      routesPath: input.routesPath,
      totalRoutes: 0,
      identityAndNames: {
        agencyId: createFieldCoverage(false),
        routeShortName: createFieldCoverage(false),
        routeLongName: createFieldCoverage(false),
        routeDesc: createFieldCoverage(false),
        shortOnly: 0,
        longOnly: 0,
        both: 0,
        neither: 0,
      },
      routeTypes: {
        fieldPresent: false,
        distinctRouteTypes: 0,
        counts: {},
        unknown: 0,
      },
      colorFields: {
        routeColor: createFieldCoverage(false),
        routeTextColor: createFieldCoverage(false),
        routeColorEmptyRate: 0,
        routeTextColorEmptyRate: 0,
        colorOnly: 0,
        textOnly: 0,
        both: 0,
        neither: 0,
        sameColorPairs: 0,
        distinctRouteColors: 0,
        distinctRouteTextColors: 0,
        sameColorPairCounts: {},
      },
      cemvSupport: {
        fieldPresent: false,
        unknown: 0,
        supported: 0,
        unsupported: 0,
        other: 0,
        known: 0,
        knownRate: 0,
      },
      continuousServiceFields: {
        pickupFieldPresent: false,
        dropOffFieldPresent: false,
        pickup: createContinuousValueCounts(),
        dropOff: createContinuousValueCounts(),
        pickupNonDefault: 0,
        dropOffNonDefault: 0,
        bothNonDefault: 0,
      },
      optionalPresentationFields: {
        routeSortOrder: createFieldCoverage(false),
        routeUrl: createFieldCoverage(false),
        networkId: createFieldCoverage(false),
      },
    };
  }

  const header = splitCsvLine(lines[0]);
  const agencyIdIndex = header.indexOf('agency_id');
  const routeShortNameIndex = header.indexOf('route_short_name');
  const routeLongNameIndex = header.indexOf('route_long_name');
  const routeDescIndex = header.indexOf('route_desc');
  const routeTypeIndex = header.indexOf('route_type');
  const routeUrlIndex = header.indexOf('route_url');
  const routeColorIndex = header.indexOf('route_color');
  const routeTextColorIndex = header.indexOf('route_text_color');
  const routeSortOrderIndex = header.indexOf('route_sort_order');
  const networkIdIndex = header.indexOf('network_id');
  const cemvSupportIndex = header.indexOf('cemv_support');
  const continuousPickupIndex = header.indexOf('continuous_pickup');
  const continuousDropOffIndex = header.indexOf('continuous_drop_off');

  let totalRoutes = 0;
  const identityAndNames: NameFieldsStats = {
    agencyId: createFieldCoverage(agencyIdIndex >= 0),
    routeShortName: createFieldCoverage(routeShortNameIndex >= 0),
    routeLongName: createFieldCoverage(routeLongNameIndex >= 0),
    routeDesc: createFieldCoverage(routeDescIndex >= 0),
    shortOnly: 0,
    longOnly: 0,
    both: 0,
    neither: 0,
  };
  const routeTypes: RouteTypesStats = {
    fieldPresent: routeTypeIndex >= 0,
    distinctRouteTypes: 0,
    counts: {},
    unknown: 0,
  };
  const colorFields: ColorFieldsStats = {
    routeColor: createFieldCoverage(routeColorIndex >= 0),
    routeTextColor: createFieldCoverage(routeTextColorIndex >= 0),
    routeColorEmptyRate: 0,
    routeTextColorEmptyRate: 0,
    colorOnly: 0,
    textOnly: 0,
    both: 0,
    neither: 0,
    sameColorPairs: 0,
    distinctRouteColors: 0,
    distinctRouteTextColors: 0,
    sameColorPairCounts: {},
  };
  const cemvSupport: CemvSupportStats = {
    fieldPresent: cemvSupportIndex >= 0,
    unknown: 0,
    supported: 0,
    unsupported: 0,
    other: 0,
    known: 0,
    knownRate: 0,
  };
  const continuousServiceFields: ContinuousServiceFieldsStats = {
    pickupFieldPresent: continuousPickupIndex >= 0,
    dropOffFieldPresent: continuousDropOffIndex >= 0,
    pickup: createContinuousValueCounts(),
    dropOff: createContinuousValueCounts(),
    pickupNonDefault: 0,
    dropOffNonDefault: 0,
    bothNonDefault: 0,
  };
  const optionalPresentationFields: OptionalPresentationFieldsStats = {
    routeSortOrder: createFieldCoverage(routeSortOrderIndex >= 0),
    routeUrl: createFieldCoverage(routeUrlIndex >= 0),
    networkId: createFieldCoverage(networkIdIndex >= 0),
  };
  const routeColorValues: string[] = [];
  const routeTextColorValues: string[] = [];
  const routeTypeValues = new Set<string>();

  for (const line of lines.slice(1)) {
    if (line.trim() === '') {
      continue;
    }

    const fields = splitCsvLine(line);
    totalRoutes += 1;

    const agencyIdValue = agencyIdIndex >= 0 ? (fields[agencyIdIndex] ?? '') : '';
    const shortNameValue = routeShortNameIndex >= 0 ? (fields[routeShortNameIndex] ?? '') : '';
    const longNameValue = routeLongNameIndex >= 0 ? (fields[routeLongNameIndex] ?? '') : '';
    const descValue = routeDescIndex >= 0 ? (fields[routeDescIndex] ?? '') : '';
    const routeTypeValue = routeTypeIndex >= 0 ? (fields[routeTypeIndex] ?? '') : '';
    const routeUrlValue = routeUrlIndex >= 0 ? (fields[routeUrlIndex] ?? '') : '';
    const colorValue = routeColorIndex >= 0 ? (fields[routeColorIndex] ?? '') : '';
    const textColorValue = routeTextColorIndex >= 0 ? (fields[routeTextColorIndex] ?? '') : '';
    const routeSortOrderValue = routeSortOrderIndex >= 0 ? (fields[routeSortOrderIndex] ?? '') : '';
    const networkIdValue = networkIdIndex >= 0 ? (fields[networkIdIndex] ?? '') : '';
    const cemvSupportValue = cemvSupportIndex >= 0 ? (fields[cemvSupportIndex] ?? '') : '';
    const continuousPickupValue =
      continuousPickupIndex >= 0 ? (fields[continuousPickupIndex] ?? '') : '';
    const continuousDropOffValue =
      continuousDropOffIndex >= 0 ? (fields[continuousDropOffIndex] ?? '') : '';

    addFieldValue(identityAndNames.agencyId, agencyIdValue);
    addFieldValue(identityAndNames.routeShortName, shortNameValue);
    addFieldValue(identityAndNames.routeLongName, longNameValue);
    addFieldValue(identityAndNames.routeDesc, descValue);

    const hasShortName = isNonEmpty(shortNameValue);
    const hasLongName = isNonEmpty(longNameValue);
    if (hasShortName && hasLongName) {
      identityAndNames.both += 1;
    } else if (hasShortName) {
      identityAndNames.shortOnly += 1;
    } else if (hasLongName) {
      identityAndNames.longOnly += 1;
    } else {
      identityAndNames.neither += 1;
    }

    if (isNonEmpty(routeTypeValue)) {
      incrementRecordCount(routeTypes.counts, routeTypeValue);
      routeTypeValues.add(routeTypeValue);
      if (!(routeTypeValue in ROUTE_TYPE_LABELS)) {
        routeTypes.unknown += 1;
      }
    } else {
      routeTypes.unknown += 1;
    }

    addFieldValue(colorFields.routeColor, colorValue);
    addFieldValue(colorFields.routeTextColor, textColorValue);

    const hasRouteColor = isNonEmpty(colorValue);
    const hasRouteTextColor = isNonEmpty(textColorValue);
    if (hasRouteColor) {
      routeColorValues.push(colorValue);
    }
    if (hasRouteTextColor) {
      routeTextColorValues.push(textColorValue);
    }

    if (hasRouteColor && hasRouteTextColor) {
      colorFields.both += 1;
      if (colorValue === textColorValue) {
        colorFields.sameColorPairs += 1;
        incrementRecordCount(
          colorFields.sameColorPairCounts,
          formatColorPairValue(colorValue, textColorValue),
        );
      }
    } else if (hasRouteColor) {
      colorFields.colorOnly += 1;
    } else if (hasRouteTextColor) {
      colorFields.textOnly += 1;
    } else {
      colorFields.neither += 1;
    }

    const normalizedCemvSupport = cemvSupportValue.trim();
    if (normalizedCemvSupport === '' || normalizedCemvSupport === '0') {
      cemvSupport.unknown += 1;
    } else if (normalizedCemvSupport === '1') {
      cemvSupport.supported += 1;
      cemvSupport.known += 1;
    } else if (normalizedCemvSupport === '2') {
      cemvSupport.unsupported += 1;
      cemvSupport.known += 1;
    } else {
      cemvSupport.other += 1;
      cemvSupport.known += 1;
    }

    addContinuousValue(continuousServiceFields.pickup, continuousPickupValue);
    addContinuousValue(continuousServiceFields.dropOff, continuousDropOffValue);

    const pickupNonDefault =
      continuousPickupValue.trim() !== '' && continuousPickupValue.trim() !== '1';
    const dropOffNonDefault =
      continuousDropOffValue.trim() !== '' && continuousDropOffValue.trim() !== '1';
    if (pickupNonDefault) {
      continuousServiceFields.pickupNonDefault += 1;
    }
    if (dropOffNonDefault) {
      continuousServiceFields.dropOffNonDefault += 1;
    }
    if (pickupNonDefault && dropOffNonDefault) {
      continuousServiceFields.bothNonDefault += 1;
    }

    addFieldValue(optionalPresentationFields.routeSortOrder, routeSortOrderValue);
    addFieldValue(optionalPresentationFields.routeUrl, routeUrlValue);
    addFieldValue(optionalPresentationFields.networkId, networkIdValue);
  }

  routeTypes.distinctRouteTypes = routeTypeValues.size;
  colorFields.routeColorEmptyRate = toRate(colorFields.routeColor.empty, totalRoutes);
  colorFields.routeTextColorEmptyRate = toRate(colorFields.routeTextColor.empty, totalRoutes);
  colorFields.distinctRouteColors = countDistinctNonEmpty(routeColorValues);
  colorFields.distinctRouteTextColors = countDistinctNonEmpty(routeTextColorValues);
  cemvSupport.knownRate = toRate(cemvSupport.known, totalRoutes);

  return {
    sourceName: input.sourceName,
    prefix: input.prefix,
    nameEn: input.nameEn,
    routesPath: input.routesPath,
    totalRoutes,
    identityAndNames,
    routeTypes,
    colorFields,
    cemvSupport,
    continuousServiceFields,
    optionalPresentationFields,
  };
}

export function buildGtfsRoutesReport(
  results: GtfsRoutesSourceStats[],
  options: { analyzedAt?: Date } = {},
): GtfsRoutesAnalysisReport {
  const analyzedAt = options.analyzedAt ?? new Date();

  return {
    meta: {
      analyzedAt: analyzedAt.toISOString(),
      sourceCount: results.length,
    },
    totalRoutes: getTotalRoutes(results),
    sources: results,
  };
}

export function formatGtfsRoutesAnalysis(
  results: GtfsRoutesSourceStats[],
  options: { analyzedAt?: Date; sections?: GtfsRoutesSectionName[] } = {},
): string {
  if (results.length === 0) {
    return 'No GTFS routes.txt data found.';
  }

  const analyzedAt = options.analyzedAt ?? new Date();
  const sorted = [...results].sort((a, b) => b.totalRoutes - a.totalRoutes);
  const requestedSections =
    options.sections === undefined || options.sections.length === 0
      ? GTFS_ROUTES_SECTION_NAMES
      : options.sections;

  const renderedSections: string[] = [];
  for (const sectionName of requestedSections) {
    const section = GTFS_ROUTES_SECTIONS[sectionName];
    renderedSections.push(
      renderSection(section.title, section.description, section.render(sorted)),
    );
  }

  return [
    '# Athenai Transit — GTFS routes.txt analysis',
    '',
    `# Analyzed at: ${analyzedAt.toISOString()}`,
    '# Current output covers routes.txt current-state sections only.',
    '# No stop_times or other file joins are applied in this report.',
    '',
    formatOverallSummary(sorted),
    '',
    ...renderedSections.flatMap((section, index) => (index === 0 ? [section] : ['', section])),
  ].join('\n');
}
