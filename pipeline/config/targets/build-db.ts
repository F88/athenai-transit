/**
 * Target list for batch GTFS DB builds.
 *
 * Each entry is a source-name (filename without .ts extension)
 * from pipeline/config/resources/gtfs/.
 *
 * Comment out entries to temporarily skip them.
 */
import { CONFIG_GTFS_ALL_TARGETS } from './target-const';

const TARGETS = CONFIG_GTFS_ALL_TARGETS;
export default TARGETS;
