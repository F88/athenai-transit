/**
 * Target list for GlobalInsightsBundle build.
 *
 * Each entry is a prefix whose DataBundle (data.json) will be loaded
 * and analyzed for cross-source spatial metrics. All prefixes are
 * processed in a single run (not per-source batch).
 */
import { PREFIX_ALL_TARGETS } from './target-const';

const PREFIX_TARGETS = [
  //
  ...PREFIX_ALL_TARGETS /* Regular targets */,
  // ...PREFIX_ODCPT2026_TARGETS /* Open Data Challenge for Public Transportation 2026 */,
];

export default PREFIX_TARGETS;
