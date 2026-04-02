/**
 * Toggle a single value in a number array.
 * Removes the value if present, appends it if absent.
 *
 * @param list - Current array of values.
 * @param value - Value to toggle.
 * @returns New array with the value toggled.
 */
export function toggleInList(list: number[], value: number): number[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
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
  const hasAll = group.every((entry) => list.includes(entry));
  return hasAll
    ? list.filter((entry) => !group.includes(entry))
    : [...new Set([...list, ...group])];
}
