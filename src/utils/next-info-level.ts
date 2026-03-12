import type { InfoLevel } from '../types/app/settings';

const ORDER: InfoLevel[] = ['simple', 'normal', 'detailed', 'verbose'];

/**
 * Cycle info level: simple → normal → detailed → verbose → simple.
 *
 * @param current - Current info level.
 * @returns Next info level in the cycle.
 */
export function nextInfoLevel(current: InfoLevel): InfoLevel {
  const idx = ORDER.indexOf(current);
  return ORDER[(idx + 1) % ORDER.length];
}
