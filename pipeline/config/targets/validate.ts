/**
 * Target list for validation.
 *
 * Each entry is a prefix (output directory name) under
 * pipeline/workspace/_build/. Used by both v1 and v2 validators.
 *
 * Comment out entries to temporarily skip them.
 */
import { PREFIX_ALL_TARGETS } from './target-const';

const PREFIX_TARGETS = [
  //
  ...PREFIX_ALL_TARGETS /* Regular targets */,
  // ...PREFIX_ODCPT2026_TARGETS /* Open Data Challenge for Public Transportation 2026 */,
];

export default PREFIX_TARGETS;
