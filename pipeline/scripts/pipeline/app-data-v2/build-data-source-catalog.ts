#!/usr/bin/env -S npx tsx

/**
 * Build v2 DataSourceCatalogBundle from targeted sources.
 *
 * This is a placeholder implementation that only writes an empty but
 * schema-valid catalog bundle. It establishes the CLI shape, output path,
 * and atomic-write behavior before the real summary extraction is added.
 *
 * Input:  target list file (`--targets <file>`)
 * Output: pipeline/workspace/_build/data-v2/global/data-source-catalog.json
 *
 * Usage:
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/build-data-source-catalog.ts --targets <file>
 *   npx tsx pipeline/scripts/pipeline/app-data-v2/build-data-source-catalog.ts --help
 */

import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DataSourceCatalogBundle } from '@contracts/data/transit-v2-catalog-json';

import { V2_OUTPUT_DIR } from '../../../src/lib/paths';
import { writeDataSourceCatalogBundle } from '../../../src/lib/pipeline/app-data-v2/bundle-writer';
import { loadTargetFile, parseCliArg, runMain } from '../../../src/lib/pipeline/pipeline-utils';

const OUTPUT_DIR = V2_OUTPUT_DIR;
const GLOBAL_DIR = join(OUTPUT_DIR, 'global');

function printUsage(): void {
  console.log(
    'Usage: npx tsx pipeline/scripts/pipeline/app-data-v2/build-data-source-catalog.ts --targets <file>',
  );
  console.log(
    '       npx tsx pipeline/scripts/pipeline/app-data-v2/build-data-source-catalog.ts --help',
  );
  console.log('');
  console.log('Options:');
  console.log('  --targets <file>  Target list file (.ts) specifying source names to include');
  console.log('  --help            Show this help message');
}

async function main(): Promise<void> {
  const arg = parseCliArg({ allowList: false, allowSourceName: false });

  if (arg.kind === 'help') {
    printUsage();
    return;
  }

  if (arg.kind !== 'targets') {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const targetSourceNames = await loadTargetFile(arg.path);

  console.log('=== data-source-catalog [START] ===\n');
  console.log(`  Targets: ${targetSourceNames.length} sources (${targetSourceNames.join(', ')})`);
  console.log(`  Output:  ${GLOBAL_DIR}/data-source-catalog.json`);
  console.log('');

  const t0 = performance.now();

  try {
    const bundle: DataSourceCatalogBundle = {
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
        data: {},
      },
      globalInsights: {
        v: 1,
        data: {
          file: {
            sizeBytes: 0,
          },
          counts: {
            stopGeo: 0,
          },
        },
      },
    };

    writeDataSourceCatalogBundle(GLOBAL_DIR, bundle);

    console.log('  Placeholder implementation wrote an empty catalog bundle.');
    console.log(`  Written: ${GLOBAL_DIR}/data-source-catalog.json`);
  } catch (err) {
    console.error(`\nFATAL: ${err instanceof Error ? err.message : String(err)}`);
    if (err instanceof Error && err.cause instanceof Error) {
      console.error(`  Cause: ${err.cause.message}`);
    }
    process.exitCode = 1;
  } finally {
    const durationMs = performance.now() - t0;
    const code = process.exitCode ?? 0;
    const label = code === 0 ? 'ok' : 'error';
    console.log(`\nDuration: ${(durationMs / 1000).toFixed(1)}s`);
    console.log(`Exit code: ${code} (${label})\n=== data-source-catalog [END] ===`);
  }
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  runMain(main);
}
