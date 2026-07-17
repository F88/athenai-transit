/**
 * Target list for batch GTFS downloads.
 *
 * Each entry is a source-name (filename without .ts extension)
 * from pipeline/config/resources/gtfs/.
 *
 * Comment out entries to temporarily skip them.
 */

import { CONFIG_GTFS_ALL_TARGETS } from './target-const';

const TARGETS = [
  //
  ...CONFIG_GTFS_ALL_TARGETS /* Regular targets */,
  // ...CONFIG_ODCPT2026_TARGETS /* Open Data Challenge for Public Transportation 2026 */,
];

export default TARGETS;
