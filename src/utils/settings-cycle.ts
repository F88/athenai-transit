import type { InfoLevel, PerfMode, RenderMode } from '../types/app/settings';
import { DEFAULT_LANG, SUPPORTED_LANG_CODES } from '../config/supported-langs';

const INFO_LEVEL_ORDER: InfoLevel[] = ['simple', 'normal', 'detailed', 'verbose'];
const PERF_MODE_ORDER: PerfMode[] = ['normal', 'lite', 'full'];

/**
 * Cycle display language through {@link SUPPORTED_LANG_CODES}.
 *
 * If `current` is not in the list, returns {@link DEFAULT_LANG}.
 *
 * @param current - Current language.
 * @returns Next language.
 */
export function nextLang(current: string): string {
  const index = SUPPORTED_LANG_CODES.indexOf(current);
  if (index === -1) {
    return DEFAULT_LANG;
  }
  return SUPPORTED_LANG_CODES[(index + 1) % SUPPORTED_LANG_CODES.length];
}

/**
 * Cycle info level: simple → normal → detailed → verbose → simple.
 *
 * @param current - Current info level.
 * @returns Next info level.
 */
export function nextInfoLevel(current: InfoLevel): InfoLevel {
  const index = INFO_LEVEL_ORDER.indexOf(current);
  return INFO_LEVEL_ORDER[(index + 1) % INFO_LEVEL_ORDER.length];
}

/**
 * Cycle render mode: auto → lightweight → standard → auto.
 *
 * @param current - Current render mode.
 * @returns Next render mode in the cycle.
 */
export function nextRenderMode(current: RenderMode): RenderMode {
  switch (current) {
    case 'auto':
      return 'lightweight';
    case 'lightweight':
      return 'standard';
    case 'standard':
      return 'auto';
  }
}

/**
 * Cycle perf mode: normal → lite → full → normal.
 *
 * @param current - Current perf mode.
 * @returns Next perf mode in the cycle.
 */
export function nextPerfMode(current: PerfMode): PerfMode {
  const index = PERF_MODE_ORDER.indexOf(current);
  return PERF_MODE_ORDER[(index + 1) % PERF_MODE_ORDER.length];
}

/**
 * Cycle tile index: 0 → 1 → … → (count-1) → null → 0.
 *
 * @param current - Current tile index, or null for no tiles.
 * @param count - Total number of available tile sources.
 * @returns Next tile index in the cycle.
 */
export function nextTileIndex(current: number | null, count: number): number | null {
  const next = current === null ? 0 : current + 1;
  return next >= count ? null : next;
}
