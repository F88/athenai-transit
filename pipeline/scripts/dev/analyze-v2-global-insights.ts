#!/usr/bin/env -S npx tsx

/**
 * Analyze the v2 GlobalInsightsBundle (`public/data-v2/global/insights.json`).
 *
 * Prints a per-source breakdown of the `stopGeo` section with basic
 * coverage of optional fields (`wp`, `cn`) and a distribution of the
 * `nr` (nearest different-route distance) metric.
 *
 * Usage:
 *   npx tsx pipeline/scripts/dev/analyze-v2-global-insights.ts
 *   npx tsx pipeline/scripts/dev/analyze-v2-global-insights.ts --help
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { GlobalInsightsBundle } from '../../../src/types/data/transit-v2-json';
import {
  analyzeGlobalInsightsBundle,
  formatGlobalInsightsAnalysis,
} from './dev-lib/v2-global-insights-analysis';
import { PIPELINE_ROOT } from '../../src/lib/paths';
import { runMain } from '../../src/lib/pipeline/pipeline-utils';

const PUBLIC_V2_DIR = join(PIPELINE_ROOT, '..', 'public', 'data-v2');
const GLOBAL_INSIGHTS_PATH = join(PUBLIC_V2_DIR, 'global', 'insights.json');

type CliMode = { kind: 'help' } | { kind: 'run' };

function parseArgs(args: string[]): CliMode {
  if (args.length === 0) {
    return { kind: 'run' };
  }
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    return { kind: 'help' };
  }
  return { kind: 'help' };
}

function printHelp(): void {
  console.log('Usage: analyze-v2-global-insights.ts');
  console.log('  No args    Analyze public/data-v2/global/insights.json');
  console.log('  --help     Show this help');
}

function main(): void {
  const mode = parseArgs(process.argv.slice(2));

  if (mode.kind === 'help') {
    printHelp();
    return;
  }

  if (!existsSync(GLOBAL_INSIGHTS_PATH)) {
    console.error(`Global insights bundle not found: ${GLOBAL_INSIGHTS_PATH}`);
    console.error('Run the pipeline to build it first.');
    process.exitCode = 1;
    return;
  }

  const bundle = JSON.parse(readFileSync(GLOBAL_INSIGHTS_PATH, 'utf-8')) as GlobalInsightsBundle;
  if (bundle.kind !== 'global-insights') {
    console.error(`Unexpected bundle kind: ${String(bundle.kind)}`);
    process.exitCode = 1;
    return;
  }

  const stats = analyzeGlobalInsightsBundle(bundle);
  console.log(formatGlobalInsightsAnalysis(stats));
}

runMain(main);
