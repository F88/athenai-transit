#!/usr/bin/env -S npx tsx

/**
 * Analyze name-related fields in generated V2 data bundles.
 *
 * Step 1 reads generated V2 bundles only and aggregates counts for a fixed
 * inventory of name-related investigation targets.
 *
 * Usage:
 *   npx tsx pipeline/scripts/dev/analyze-v2-name-fields.ts              # all sources
 *   npx tsx pipeline/scripts/dev/analyze-v2-name-fields.ts --json       # all sources as JSON
 *   npx tsx pipeline/scripts/dev/analyze-v2-name-fields.ts --field-counts-tsv
 *   npx tsx pipeline/scripts/dev/analyze-v2-name-fields.ts <source>     # single source
 *   npx tsx pipeline/scripts/dev/analyze-v2-name-fields.ts <source> --json
 *   npx tsx pipeline/scripts/dev/analyze-v2-name-fields.ts --list       # list sources
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { DataBundle } from '../../../src/types/data/transit-v2-json';
import type { NameFieldAnalysisReport, SourceAnalysis } from './dev-lib/v2-name-fields-analysis';
import * as nameFieldAnalysisModule from './dev-lib/v2-name-fields-analysis';
import { PIPELINE_ROOT, V2_OUTPUT_DIR } from '../../src/lib/paths';
import { runMain } from '../../src/lib/pipeline/pipeline-utils';

const PUBLIC_V2_DIR = join(PIPELINE_ROOT, '..', 'public', 'data-v2');

interface NameFieldAnalysisApi {
  analyzeDataBundleSource: (
    source: string,
    bundlePath: string,
    bundle: DataBundle,
  ) => SourceAnalysis;
  buildAnalysisReport: (
    results: SourceAnalysis[],
    publicV2Dir: string,
    generatedV2Dir: string,
  ) => NameFieldAnalysisReport;
  formatFieldCountsTsv: (results: SourceAnalysis[]) => string;
  formatSourceAnalysis: (result: SourceAnalysis) => string;
}

const nameFieldAnalysis = nameFieldAnalysisModule as NameFieldAnalysisApi;

type CliMode =
  | { kind: 'help' }
  | { kind: 'list' }
  | { kind: 'field-counts-tsv' }
  | { kind: 'all'; json: boolean }
  | { kind: 'source'; name: string; json: boolean };

function listSourceNames(): string[] {
  const dirs = readdirSync(PUBLIC_V2_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'global')
    .map((entry) => entry.name)
    .sort();

  return dirs.filter((name) => existsSync(join(PUBLIC_V2_DIR, name, 'data.json')));
}

function readBundle(source: string): DataBundle {
  const bundlePath = join(PUBLIC_V2_DIR, source, 'data.json');
  if (!existsSync(bundlePath)) {
    throw new Error(`Bundle not found: ${bundlePath}`);
  }

  return JSON.parse(readFileSync(bundlePath, 'utf-8')) as DataBundle;
}

function analyzeSource(source: string): SourceAnalysis {
  return nameFieldAnalysis.analyzeDataBundleSource(
    source,
    join(PUBLIC_V2_DIR, source, 'data.json'),
    readBundle(source),
  );
}

function parseArgs(args: string[]): CliMode {
  if (args.length === 0) {
    return { kind: 'all', json: false };
  }

  const json = args.includes('--json');
  const filtered = args.filter((arg) => arg !== '--json');

  if (filtered.length === 0) {
    return { kind: 'all', json };
  }

  if (filtered.length === 1 && (filtered[0] === '--help' || filtered[0] === '-h')) {
    return { kind: 'help' };
  }

  if (filtered.length === 1 && filtered[0] === '--list') {
    return json ? { kind: 'help' } : { kind: 'list' };
  }

  if (filtered.length === 1 && filtered[0] === '--field-counts-tsv') {
    return json ? { kind: 'help' } : { kind: 'field-counts-tsv' };
  }

  if (filtered.length === 1 && !filtered[0].startsWith('-')) {
    return { kind: 'source', name: filtered[0], json };
  }

  return { kind: 'help' };
}

function printJsonReport(results: SourceAnalysis[]): void {
  const report = nameFieldAnalysis.buildAnalysisReport(results, PUBLIC_V2_DIR, V2_OUTPUT_DIR);
  console.log(JSON.stringify(report, null, 2));
}

function main(): void {
  const names = listSourceNames();

  const mode = parseArgs(process.argv.slice(2));

  if (mode.kind === 'help') {
    console.log('Usage: analyze-v2-name-fields.ts [source-name] [--json]');
    console.log('  No args           Analyze all public/data-v2 sources');
    console.log('  <source>          Analyze a single source');
    console.log('  --json            Output machine-readable JSON report');
    console.log('  --field-counts-tsv Output field counts as TSV by source');
    console.log('  --list            List available sources');
    return;
  }

  if (mode.kind === 'list') {
    for (const name of names) {
      console.log(name);
    }
    return;
  }

  if (mode.kind === 'field-counts-tsv') {
    const results = names.map(analyzeSource);
    console.log(nameFieldAnalysis.formatFieldCountsTsv(results));
    return;
  }

  if (mode.kind === 'source') {
    const results = [analyzeSource(mode.name)];
    if (mode.json) {
      printJsonReport(results);
      return;
    }

    console.log(nameFieldAnalysis.formatSourceAnalysis(results[0]));
    return;
  }

  const results = names.map(analyzeSource);
  if (mode.json) {
    printJsonReport(results);
    return;
  }

  for (const [index, result] of results.entries()) {
    if (index > 0) {
      console.log('');
    }
    console.log(nameFieldAnalysis.formatSourceAnalysis(result));
  }
}

runMain(main);
