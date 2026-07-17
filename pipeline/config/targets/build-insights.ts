/**
 * Target list for batch InsightsBundle builds.
 *
 * Each entry is a prefix (output directory name) that has a
 * DataBundle (data.json). The insights builder reads calendar
 * data from data.json to produce insights.json. Prefixes without
 * data.json will cause the batch child process to exit non-zero.
 *
 * Comment out entries to temporarily skip them.
 */
import { PREFIX_ALL_TARGETS } from './target-const';

const TARGETS = [
  //
  ...PREFIX_ALL_TARGETS /* Regular targets */,
  // ...PREFIX_ODCPT2026_TARGETS /* Open Data Challenge for Public Transportation 2026 */,
];

export default TARGETS;
