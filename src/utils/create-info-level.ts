import type { InfoLevel } from '../types/app/settings';

const LEVEL_ORDER: InfoLevel[] = ['simple', 'normal', 'detailed', 'verbose'];

/** Pre-computed boolean flags for each info verbosity threshold. */
export interface InfoLevelFlags {
  /** True when the current level is "simple" or above (always true for valid levels). */
  isSimpleEnabled: boolean;
  /** True when the current level is "normal" or above. */
  isNormalEnabled: boolean;
  /** True when the current level is "detailed" or above. */
  isDetailedEnabled: boolean;
  /** True when the current level is "verbose". */
  isVerboseEnabled: boolean;
}

/**
 * Creates boolean flags indicating which info thresholds the given level meets.
 *
 * Works like a logger: each flag is true when the current level reaches or
 * exceeds that threshold.
 *
 * @param current - The active info level from user settings.
 * @returns Pre-computed flags for each threshold.
 *
 * @example
 * ```ts
 * const info = createInfoLevel("detailed");
 * info.isNormalEnabled;    // true
 * info.isDetailedEnabled;  // true
 * info.isVerboseEnabled;   // false
 * ```
 */
export function createInfoLevel(current: InfoLevel): InfoLevelFlags {
  const idx = LEVEL_ORDER.indexOf(current);
  return {
    isSimpleEnabled: idx >= 0,
    isNormalEnabled: idx >= 1,
    isDetailedEnabled: idx >= 2,
    isVerboseEnabled: idx >= 3,
  };
}
