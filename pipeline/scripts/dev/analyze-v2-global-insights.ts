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
 *   npx tsx pipeline/scripts/dev/analyze-v2-global-insights.ts --list-sections
 *   npx tsx pipeline/scripts/dev/analyze-v2-global-insights.ts --section summary
 *   npx tsx pipeline/scripts/dev/analyze-v2-global-insights.ts --help
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { GlobalInsightsBundle } from '../../../src/types/data/transit-v2-json';
import {
  analyzeGlobalInsightsBundle,
  formatGlobalInsightsAnalysis,
  V2_GLOBAL_INSIGHTS_SECTION_NAMES,
  type V2GlobalInsightsSectionName,
} from './dev-lib/v2-global-insights-analysis';
import { parseArgsForSectionsOnly } from './dev-lib/parse-args';
import { PIPELINE_ROOT } from '../../src/lib/paths';
import { runMain } from '../../src/lib/pipeline/pipeline-utils';

const PUBLIC_V2_DIR = join(PIPELINE_ROOT, '..', 'public', 'data-v2');
const GLOBAL_INSIGHTS_PATH = join(PUBLIC_V2_DIR, 'global', 'insights.json');

function isV2GlobalInsightsSectionName(value: string): value is V2GlobalInsightsSectionName {
  return (V2_GLOBAL_INSIGHTS_SECTION_NAMES as readonly string[]).includes(value);
}

function printHelp(): void {
  console.log('Usage: analyze-v2-global-insights.ts [--section <name> ...]');
  console.log('  No args    Analyze public/data-v2/global/insights.json');
  console.log('  --list-sections  List available section names');
  console.log('  --section <name> Limit output to the selected section (repeatable)');
  console.log('  --help     Show this help');
}

function main(): void {
  const mode = parseArgsForSectionsOnly(process.argv.slice(2));

  if (mode.kind === 'help') {
    printHelp();
    return;
  }

  const invalidSections = mode.sections.filter(
    (section) => !isV2GlobalInsightsSectionName(section),
  );
  if (invalidSections.length > 0) {
    console.error(`Unknown section name: ${invalidSections.join(', ')}`);
    console.error('Run with --list-sections to see available section names.');
    process.exitCode = 1;
    return;
  }

  if (mode.kind === 'list') {
    for (const sectionName of V2_GLOBAL_INSIGHTS_SECTION_NAMES) {
      console.log(sectionName);
    }
    return;
  }

  const sections = mode.sections as V2GlobalInsightsSectionName[];

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
  console.log(formatGlobalInsightsAnalysis(stats, { sections }));
}

runMain(main);
