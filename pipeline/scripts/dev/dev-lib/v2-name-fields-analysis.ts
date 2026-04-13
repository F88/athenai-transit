import type { DataBundle } from '../../../../src/types/data/transit-v2-json';

type FieldCounter = (bundle: DataBundle) => FieldCount;

interface FieldTarget {
  field: string;
  count: FieldCounter;
}

export interface FieldCount {
  field: string;
  nonEmpty: number;
  empty: number;
}

export interface SourceAnalysis {
  source: string;
  bundlePath: string;
  fieldCounts: FieldCount[];
}

export interface SourceAnalysisJson {
  source: string;
  bundlePath: string;
  fieldCounts: FieldCount[];
}

export interface NameFieldAnalysisReport {
  meta: {
    publicV2Dir: string;
    generatedV2Dir: string;
    sourceCount: number;
  };
  sources: SourceAnalysisJson[];
}

export interface FieldCountRow extends FieldCount {
  source: string;
}

const FIELD_TARGETS: FieldTarget[] = [
  {
    field: 'routes.s',
    count: (bundle) => countScalarValues('routes.s', bundle.routes.data, (route) => route.s),
  },
  {
    field: 'routes.l',
    count: (bundle) => countScalarValues('routes.l', bundle.routes.data, (route) => route.l),
  },
  {
    field: 'agency.n',
    count: (bundle) => countScalarValues('agency.n', bundle.agency.data, (agency) => agency.n),
  },
  {
    field: 'agency.sn',
    count: () => createMissingFieldCount('agency.sn'),
  },
  {
    field: 'translations.agency_names',
    count: (bundle) =>
      countTranslationMap('translations.agency_names', bundle.translations.data.agency_names),
  },
  {
    field: 'translations.agency_short_names',
    count: () => createMissingFieldCount('translations.agency_short_names'),
  },
  {
    field: 'tripPatterns.h',
    count: (bundle) =>
      countScalarValues(
        'tripPatterns.h',
        Object.entries(bundle.tripPatterns.data),
        ([, pattern]) => pattern.h,
      ),
  },
  {
    field: 'translations.trip_headsigns',
    count: (bundle) =>
      countTranslationMap('translations.trip_headsigns', bundle.translations.data.trip_headsigns),
  },
  {
    field: 'translations.stop_headsigns',
    count: (bundle) =>
      countTranslationMap('translations.stop_headsigns', bundle.translations.data.stop_headsigns),
  },
  {
    field: 'stops.n',
    count: (bundle) => countScalarValues('stops.n', bundle.stops.data, (stop) => stop.n),
  },
  {
    field: 'translations.stop_names',
    count: (bundle) =>
      countTranslationMap('translations.stop_names', bundle.translations.data.stop_names),
  },
  {
    field: 'translations.route_long_names',
    count: (bundle) =>
      countTranslationMap(
        'translations.route_long_names',
        bundle.translations.data.route_long_names,
      ),
  },
  {
    field: 'translations.route_short_names',
    count: (bundle) =>
      countTranslationMap(
        'translations.route_short_names',
        bundle.translations.data.route_short_names,
      ),
  },
  {
    field: 'trips.trip_short_name',
    count: () => createMissingFieldCount('trips.trip_short_name'),
  },
  {
    field: 'stop_times.stop_headsign',
    count: () => createMissingFieldCount('stop_times.stop_headsign'),
  },
  {
    field: 'stops.tts_stop_name',
    count: () => createMissingFieldCount('stops.tts_stop_name'),
  },
  {
    field: 'agency_jp.agency_official_name',
    count: () => createMissingFieldCount('agency_jp.agency_official_name'),
  },
  {
    field: 'trips.jp_trip_desc',
    count: () => createMissingFieldCount('trips.jp_trip_desc'),
  },
  {
    field: 'trips.jp_trip_desc_symbol',
    count: () => createMissingFieldCount('trips.jp_trip_desc_symbol'),
  },
];

function createMissingFieldCount(field: string): FieldCount {
  return {
    field,
    nonEmpty: 0,
    empty: 0,
  };
}

function countScalarValues<T>(
  field: string,
  records: T[],
  getValue: (record: T) => string | undefined,
): FieldCount {
  let nonEmpty = 0;

  for (const record of records) {
    if ((getValue(record) ?? '').trim() !== '') {
      nonEmpty += 1;
    }
  }

  return {
    field,
    nonEmpty,
    empty: records.length - nonEmpty,
  };
}

function countTranslationMap(
  field: string,
  valueMap: Record<string, Record<string, string>> | undefined,
): FieldCount {
  const entries = Object.values(valueMap ?? {});
  let nonEmpty = 0;

  for (const translations of entries) {
    const hasValue = Object.values(translations).some((value) => value.trim() !== '');
    if (hasValue) {
      nonEmpty += 1;
    }
  }

  return {
    field,
    nonEmpty,
    empty: entries.length - nonEmpty,
  };
}

export function analyzeFieldCounts(bundle: DataBundle): FieldCount[] {
  return FIELD_TARGETS.map((target) => target.count(bundle));
}

export function analyzeDataBundleSource(
  source: string,
  bundlePath: string,
  bundle: DataBundle,
): SourceAnalysis {
  return {
    source,
    bundlePath,
    fieldCounts: analyzeFieldCounts(bundle),
  };
}

export function buildAnalysisReport(
  results: SourceAnalysis[],
  publicV2Dir: string,
  generatedV2Dir: string,
): NameFieldAnalysisReport {
  return {
    meta: {
      publicV2Dir,
      generatedV2Dir,
      sourceCount: results.length,
    },
    sources: results.map((result) => ({
      source: result.source,
      bundlePath: result.bundlePath,
      fieldCounts: result.fieldCounts,
    })),
  };
}

export function buildFieldCountRows(results: SourceAnalysis[]): FieldCountRow[] {
  return results.flatMap((result) =>
    result.fieldCounts.map((fieldCount) => ({
      source: result.source,
      ...fieldCount,
    })),
  );
}

export function formatFieldCountsTsv(results: SourceAnalysis[]): string {
  const lines = ['source\tfield\tnonEmpty\tempty'];

  for (const row of buildFieldCountRows(results)) {
    lines.push([row.source, row.field, String(row.nonEmpty), String(row.empty)].join('\t'));
  }

  return lines.join('\n');
}

export function formatSourceAnalysis(result: SourceAnalysis): string {
  const lines = [`=== ${result.source} ===`, `bundle: ${result.bundlePath}`];

  for (const fieldCount of result.fieldCounts) {
    lines.push(`${fieldCount.field}: nonEmpty=${fieldCount.nonEmpty}, empty=${fieldCount.empty}`);
  }

  return lines.join('\n');
}
