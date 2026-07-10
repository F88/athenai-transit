/**
 * Target list for GlobalInsightsBundle build.
 *
 * Each entry is a prefix whose DataBundle (data.json) will be loaded
 * and analyzed for cross-source spatial metrics. All prefixes are
 * processed in a single run (not per-source batch).
 */
import { PREFIX_ALL_TARGETS } from './target-const';

const TARGETS = PREFIX_ALL_TARGETS;
export default TARGETS;
