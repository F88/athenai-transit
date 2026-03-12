import { useMemo } from 'react';
import type { InfoLevel } from '../types/app/settings';
import { createInfoLevel } from '../utils/create-info-level';
import type { InfoLevelFlags } from '../utils/create-info-level';

/**
 * Hook that returns pre-computed info level flags for the given level.
 *
 * Thin wrapper around {@link createInfoLevel} that memoizes the result.
 *
 * @param infoLevel - The active info level from user settings.
 * @returns Memoized boolean flags for each threshold.
 */
export function useInfoLevel(infoLevel: InfoLevel): InfoLevelFlags {
  return useMemo(() => createInfoLevel(infoLevel), [infoLevel]);
}
