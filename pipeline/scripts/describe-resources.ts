#!/usr/bin/env -S npx tsx

/**
 * Describe all resource definitions in a human-readable format.
 *
 * Usage:
 *   npx tsx pipeline/scripts/describe-resources.ts              # summary (default)
 *   npx tsx pipeline/scripts/describe-resources.ts --summary     # summary table
 *   npx tsx pipeline/scripts/describe-resources.ts --verbose     # detailed view
 *   npx tsx pipeline/scripts/describe-resources.ts --format tsv  # tab-separated values
 */

import { loadAllGtfsSources } from '../lib/load-gtfs-sources';
import { loadAllOdptJsonSources } from '../lib/load-odpt-json-sources';

import type { GtfsSourceDefinition } from '../types/gtfs-resource';
import type { OdptJsonSourceDefinition } from '../types/odpt-json-resource';
import type { BaseResource, PipelineConfig } from '../types/resource-common';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

type OutputMode = 'summary' | 'verbose' | 'tsv';

function parseMode(): OutputMode {
  const arg = process.argv[2];
  if (!arg || arg === '--summary') {
    return 'summary';
  }
  if (arg === '--verbose') {
    return 'verbose';
  }
  if (arg === '--format') {
    const fmt = process.argv[3];
    if (fmt === 'tsv') {
      return 'tsv';
    }
    console.error(`Unknown format: ${fmt}`);
    process.exit(1);
  }
  console.log(
    'Usage: npx tsx pipeline/scripts/describe-resources.ts [--summary | --verbose | --format tsv]',
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Summary mode
// ---------------------------------------------------------------------------

function printSummaryGtfs(sources: GtfsSourceDefinition[]): void {
  console.log(`\nGTFS Sources (${sources.length}):\n`);

  const rows = sources.map((s) => ({
    name: `${s.pipeline.outDir}`,
    prefix: s.pipeline.prefix,
    nameJa: s.resource.nameJa,
    nameEn: s.resource.nameEn,
    format: formatDataFormat(s.resource),
    auth: s.resource.authentication.required ? 'yes' : 'no',
    routes: s.resource.routeTypes.join(', '),
  }));

  const colW = {
    name: Math.max(...rows.map((r) => r.name.length), 4),
    prefix: Math.max(...rows.map((r) => r.prefix.length), 6),
    label: Math.max(...rows.map((r) => `${r.nameJa} (${r.nameEn})`.length), 4),
    format: Math.max(...rows.map((r) => r.format.length), 6),
    routes: Math.max(...rows.map((r) => r.routes.length), 6),
  };

  for (const r of rows) {
    const label = `${r.nameJa} (${r.nameEn})`;
    console.log(
      `  ${r.name.padEnd(colW.name)}  ${r.prefix.padEnd(colW.prefix)}  ${label.padEnd(colW.label)}  ${r.format.padEnd(colW.format)}  auth:${r.auth}  [${r.routes}]`,
    );
  }
}

function printSummaryOdptJson(sources: OdptJsonSourceDefinition[]): void {
  console.log(`\nODPT JSON Sources (${sources.length}):\n`);

  const rows = sources.map((s) => ({
    name: deriveOdptJsonName(s),
    prefix: s.pipeline.prefix,
    nameJa: s.resource.nameJa,
    nameEn: s.resource.nameEn,
    odptType: s.resource.odptType,
    auth: s.resource.authentication.required ? 'yes' : 'no',
  }));

  const colW = {
    name: Math.max(...rows.map((r) => r.name.length), 4),
    prefix: Math.max(...rows.map((r) => r.prefix.length), 6),
    label: Math.max(...rows.map((r) => `${r.nameJa} (${r.nameEn})`.length), 4),
    odptType: Math.max(...rows.map((r) => r.odptType.length), 8),
  };

  for (const r of rows) {
    const label = `${r.nameJa} (${r.nameEn})`;
    console.log(
      `  ${r.name.padEnd(colW.name)}  ${r.prefix.padEnd(colW.prefix)}  ${label.padEnd(colW.label)}  ${r.odptType.padEnd(colW.odptType)}  auth:${r.auth}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Verbose mode
// ---------------------------------------------------------------------------

function printVerboseGtfs(sources: GtfsSourceDefinition[]): void {
  console.log(`\nGTFS Sources (${sources.length}):`);

  for (const s of sources) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  ${s.pipeline.outDir}`);
    console.log(`${'─'.repeat(60)}`);
    printCommonFields(s.resource, s.pipeline);
    console.log(`  Route types:    ${s.resource.routeTypes.join(', ')}`);
    console.log(`  Download URL:   ${s.resource.downloadUrl}`);
  }
}

function printVerboseOdptJson(sources: OdptJsonSourceDefinition[]): void {
  console.log(`\nODPT JSON Sources (${sources.length}):`);

  for (const s of sources) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  ${deriveOdptJsonName(s)}`);
    console.log(`${'─'.repeat(60)}`);
    printCommonFields(s.resource, s.pipeline);
    console.log(`  ODPT type:      ${s.resource.odptType}`);
    console.log(`  Endpoint URL:   ${s.resource.endpointUrl}`);
  }
}

function printCommonFields(resource: BaseResource, pipeline: PipelineConfig): void {
  console.log(`  Name:           ${resource.nameJa} (${resource.nameEn})`);
  console.log(`  Prefix:         ${pipeline.prefix}`);
  console.log(`  Out dir:        ${pipeline.outDir}`);
  console.log(`  Format:         ${formatDataFormat(resource)}`);
  console.log(
    `  Provider:       ${resource.provider.name.ja.long} (${resource.provider.name.en.long})`,
  );
  if (resource.provider.url) {
    console.log(`  Provider URL:   ${resource.provider.url}`);
  }
  console.log(`  License:        ${resource.license.name}`);
  console.log(`  Auth required:  ${resource.authentication.required ? 'yes' : 'no'}`);
  if (resource.catalog.type === 'odpt') {
    console.log(`  Catalog:        ODPT (${resource.catalog.url})`);
  } else if (resource.catalog.type === 'municipal' && resource.catalog.url) {
    console.log(`  Catalog:        Municipal (${resource.catalog.url})`);
  }
}

// ---------------------------------------------------------------------------
// TSV mode
// ---------------------------------------------------------------------------

function printTsv(
  gtfsSources: GtfsSourceDefinition[],
  odptJsonSources: OdptJsonSourceDefinition[],
): void {
  const header = [
    'type',
    'outDir',
    'prefix',
    'nameJa',
    'nameEn',
    'format',
    'routeTypes',
    'odptType',
    'auth',
    'provider',
  ];
  console.log(header.join('\t'));

  for (const s of gtfsSources) {
    const row = [
      'gtfs',
      s.pipeline.outDir,
      s.pipeline.prefix,
      s.resource.nameJa,
      s.resource.nameEn,
      formatDataFormat(s.resource),
      s.resource.routeTypes.join(', '),
      '',
      s.resource.authentication.required ? 'yes' : 'no',
      s.resource.provider.name.ja.long,
    ];
    console.log(row.join('\t'));
  }

  for (const s of odptJsonSources) {
    const row = [
      'odpt-json',
      s.pipeline.outDir,
      s.pipeline.prefix,
      s.resource.nameJa,
      s.resource.nameEn,
      formatDataFormat(s.resource),
      '',
      s.resource.odptType,
      s.resource.authentication.required ? 'yes' : 'no',
      s.resource.provider.name.ja.long,
    ];
    console.log(row.join('\t'));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDataFormat(resource: BaseResource): string {
  const df = resource.dataFormat;
  if (df.type === 'GTFS/GTFS-JP') {
    return df.jpVersion ? `GTFS-JP ${df.jpVersion}` : 'GTFS-JP';
  }
  return df.type;
}

function deriveOdptJsonName(s: OdptJsonSourceDefinition): string {
  return `${s.pipeline.outDir}/${s.resource.odptType.replace('odpt:', '')}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const mode = parseMode();
  const gtfsSources = await loadAllGtfsSources();
  const odptJsonSources = await loadAllOdptJsonSources();

  if (mode === 'tsv') {
    printTsv(gtfsSources, odptJsonSources);
    return;
  }

  const total = gtfsSources.length + odptJsonSources.length;
  console.log(`=== Resource Definitions (${total} total) ===`);

  if (mode === 'summary') {
    printSummaryGtfs(gtfsSources);
    printSummaryOdptJson(odptJsonSources);
  } else {
    printVerboseGtfs(gtfsSources);
    printVerboseOdptJson(odptJsonSources);
  }

  console.log('');
}

main().catch((err) => {
  console.error('\nFATAL:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
