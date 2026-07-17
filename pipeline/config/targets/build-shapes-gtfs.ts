/**
 * Target list for batch GTFS route shape builds.
 *
 * Each entry is a source-name (filename without .ts extension)
 * from pipeline/config/resources/gtfs/.
 *
 * The build script always writes a shapes.json for every listed source:
 * real geometry when shapes.txt is present, otherwise an empty bundle
 * ({ shapes: { v: 2, data: {} } }). Emitting an empty bundle turns the
 * app's per-source shapes.json request into a cacheable 200 JSON instead
 * of a 404 / SPA index.html miss (see Issue #329).
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
