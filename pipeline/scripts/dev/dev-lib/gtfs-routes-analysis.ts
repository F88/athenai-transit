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
  distinctRouteColors: number;
  distinctRouteTextColors: number;
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

export const GTFS_ROUTES_SECTION_NAMES = [
  'identity-and-names',
  'route-types',
  'color-fields',
  'cemv-support',
  'continuous-service-fields',
  'optional-presentation-fields',
] as const;

export type GtfsRoutesSectionName = (typeof GTFS_ROUTES_SECTION_NAMES)[number];

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

function formatFieldMarker(fieldPresent: boolean): string {
  return fieldPresent ? 'yes' : 'no';
}

function formatIdentityAndNamesSection(results: GtfsRoutesSourceStats[]): string {
  const totalRoutes = getTotalRoutes(results);
  const shortName = sumPresence(results, (result) => result.identityAndNames.routeShortName);
  const longName = sumPresence(results, (result) => result.identityAndNames.routeLongName);
  const routeDesc = sumPresence(results, (result) => result.identityAndNames.routeDesc);
  const agencyId = sumPresence(results, (result) => result.identityAndNames.agencyId);

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
    '## Identity and names',
    '',
    '### Totals',
    '',
    `routes=${totalRoutes}`,
    `route_short_name: nonEmpty=${shortName.nonEmpty}, empty=${shortName.empty}`,
    `route_long_name: nonEmpty=${longName.nonEmpty}, empty=${longName.empty}`,
    `route_desc: nonEmpty=${routeDesc.nonEmpty}, empty=${routeDesc.empty}`,
    `agency_id: nonEmpty=${agencyId.nonEmpty}, empty=${agencyId.empty}`,
    `name combinations: both=${sumNumber(results, (result) => result.identityAndNames.both)}, shortOnly=${sumNumber(results, (result) => result.identityAndNames.shortOnly)}, longOnly=${sumNumber(results, (result) => result.identityAndNames.longOnly)}, neither=${sumNumber(results, (result) => result.identityAndNames.neither)}`,
    '',
    '### Summary',
    '',
    summary,
  ].join('\n');
}

function formatRouteTypesSection(results: GtfsRoutesSourceStats[]): string {
  const combinedCounts = sumRecordCounts(results, (result) => result.routeTypes.counts);
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

  return [
    '## Route types',
    '',
    '### Totals',
    '',
    `routes=${getTotalRoutes(results)}`,
    `sourcesWithRouteTypeField=${countSourcesWithField(results, (result) => result.routeTypes.fieldPresent)}/${results.length}`,
    `unknownRouteType=${sumNumber(results, (result) => result.routeTypes.unknown)}`,
    `route_type values: ${formatRouteTypeSummary(combinedCounts)}`,
    '',
    '### Summary',
    '',
    summary,
  ].join('\n');
}

function formatColorFieldsSection(results: GtfsRoutesSourceStats[]): string {
  const routeColor = sumPresence(results, (result) => result.colorFields.routeColor);
  const routeTextColor = sumPresence(results, (result) => result.colorFields.routeTextColor);
  const summary = renderTable(
    [
      'source',
      'prefix',
      'routes',
      'colorField',
      'textField',
      'colorNonEmpty',
      'textNonEmpty',
      'both',
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
      String(result.colorFields.routeTextColor.nonEmpty),
      String(result.colorFields.both),
      String(result.colorFields.colorOnly),
      String(result.colorFields.textOnly),
      String(result.colorFields.neither),
      String(result.colorFields.distinctRouteColors),
      String(result.colorFields.distinctRouteTextColors),
    ]),
    3,
  );

  return [
    '## Color fields',
    '',
    '### Totals',
    '',
    `routes=${getTotalRoutes(results)}`,
    `route_color: nonEmpty=${routeColor.nonEmpty}, empty=${routeColor.empty}`,
    `route_text_color: nonEmpty=${routeTextColor.nonEmpty}, empty=${routeTextColor.empty}`,
    `pairings: both=${sumNumber(results, (result) => result.colorFields.both)}, colorOnly=${sumNumber(results, (result) => result.colorFields.colorOnly)}, textOnly=${sumNumber(results, (result) => result.colorFields.textOnly)}, neither=${sumNumber(results, (result) => result.colorFields.neither)}`,
    '',
    '### Summary',
    '',
    summary,
  ].join('\n');
}

function formatCemvSupportSection(results: GtfsRoutesSourceStats[]): string {
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

  return [
    '## cEMV support',
    '',
    '### Totals',
    '',
    `routes=${getTotalRoutes(results)}`,
    `sourcesWithCemvField=${countSourcesWithField(results, (result) => result.cemvSupport.fieldPresent)}/${results.length}`,
    `known=${sumNumber(results, (result) => result.cemvSupport.known)}, unknown=${sumNumber(results, (result) => result.cemvSupport.unknown)}, supported=${sumNumber(results, (result) => result.cemvSupport.supported)}, unsupported=${sumNumber(results, (result) => result.cemvSupport.unsupported)}, other=${sumNumber(results, (result) => result.cemvSupport.other)}`,
    '',
    '### Summary',
    '',
    summary,
  ].join('\n');
}

function formatContinuousServiceFieldsSection(results: GtfsRoutesSourceStats[]): string {
  const pickupTotals = sumContinuousCounts(
    results,
    (result) => result.continuousServiceFields.pickup,
  );
  const dropOffTotals = sumContinuousCounts(
    results,
    (result) => result.continuousServiceFields.dropOff,
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

  return [
    '## Continuous service fields',
    '',
    '### Totals',
    '',
    `routes=${getTotalRoutes(results)}`,
    `sourcesWithPickupField=${countSourcesWithField(results, (result) => result.continuousServiceFields.pickupFieldPresent)}/${results.length}`,
    `sourcesWithDropOffField=${countSourcesWithField(results, (result) => result.continuousServiceFields.dropOffFieldPresent)}/${results.length}`,
    `pickup values: ${formatContinuousSummary(pickupTotals)}`,
    `drop_off values: ${formatContinuousSummary(dropOffTotals)}`,
    `non-default usage: pickup=${sumNumber(results, (result) => result.continuousServiceFields.pickupNonDefault)}, drop_off=${sumNumber(results, (result) => result.continuousServiceFields.dropOffNonDefault)}, both=${sumNumber(results, (result) => result.continuousServiceFields.bothNonDefault)}`,
    '',
    '### Summary',
    '',
    summary,
  ].join('\n');
}

function formatOptionalPresentationFieldsSection(results: GtfsRoutesSourceStats[]): string {
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

  return [
    '## Optional presentation / operational fields',
    '',
    '### Totals',
    '',
    `routes=${getTotalRoutes(results)}`,
    `route_sort_order: nonEmpty=${routeSortOrder.nonEmpty}, empty=${routeSortOrder.empty}`,
    `route_url: nonEmpty=${routeUrl.nonEmpty}, empty=${routeUrl.empty}`,
    `network_id: nonEmpty=${networkId.nonEmpty}, empty=${networkId.empty}`,
    '',
    '### Summary',
    '',
    summary,
  ].join('\n');
}

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
        distinctRouteColors: 0,
        distinctRouteTextColors: 0,
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
    distinctRouteColors: 0,
    distinctRouteTextColors: 0,
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
    if (sectionName === 'identity-and-names') {
      renderedSections.push(formatIdentityAndNamesSection(sorted));
      continue;
    }
    if (sectionName === 'route-types') {
      renderedSections.push(formatRouteTypesSection(sorted));
      continue;
    }
    if (sectionName === 'color-fields') {
      renderedSections.push(formatColorFieldsSection(sorted));
      continue;
    }
    if (sectionName === 'cemv-support') {
      renderedSections.push(formatCemvSupportSection(sorted));
      continue;
    }
    if (sectionName === 'continuous-service-fields') {
      renderedSections.push(formatContinuousServiceFieldsSection(sorted));
      continue;
    }
    if (sectionName === 'optional-presentation-fields') {
      renderedSections.push(formatOptionalPresentationFieldsSection(sorted));
    }
  }

  return [
    '# Athenai Transit — GTFS routes.txt analysis',
    '',
    `# Analyzed at: ${analyzedAt.toISOString()}`,
    '# Current output covers routes.txt current-state sections only.',
    '# No stop_times or other file joins are applied in this report.',
    '',
    ...renderedSections.flatMap((section, index) => (index === 0 ? [section] : ['', section])),
  ].join('\n');
}
