/**
 * Target list for validation.
 *
 * Each entry is a prefix (output directory name) under
 * pipeline/workspace/_build/. Used by both v1 and v2 validators.
 *
 * Comment out entries to temporarily skip them.
 */
import { PREFIX_ALL_TARGETS } from './target-const';

const TARGETS = PREFIX_ALL_TARGETS;
export default TARGETS;
