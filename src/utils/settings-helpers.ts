/**
 * Pure helper functions for settings toggle logic.
 *
 * Extracted from App.tsx so toggle logic can be unit-tested independently.
 */

import type { PerfMode, RenderMode } from '../types/app/settings';

/**
 * Toggle a single value in a number array.
 * Removes the value if present, appends it if absent.
 *
 * @param list - Current array of values.
 * @param value - Value to toggle.
 * @returns New array with the value toggled.
 */
export function toggleInList(list: number[], value: number): number[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * Toggle a group of values in a number array.
 * If all group values are present, removes them all; otherwise adds any missing ones.
 *
 * @param list - Current array of values.
 * @param group - Group of values to toggle together.
 * @returns New array with the group toggled.
 */
export function toggleGroupInList(list: number[], group: number[]): number[] {
  const hasAll = group.every((v) => list.includes(v));
  return hasAll ? list.filter((v) => !group.includes(v)) : [...new Set([...list, ...group])];
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
  const cycle: PerfMode[] = ['normal', 'lite', 'full'];
  const idx = cycle.indexOf(current);
  return cycle[(idx + 1) % cycle.length];
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
