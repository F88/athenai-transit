/**
 * Scroll-position math for trip stop rows.
 *
 * Translates between scroll position and pattern stop index. Both
 * helpers are pure functions of DOM layout state — they read
 * `scrollTop`, `scrollHeight`, `clientHeight`, and per-row
 * `getBoundingClientRect()`, but never mutate state. Built on top of
 * the row-finding primitives in trip-stop-row-dom.ts.
 */

import { getTripStopIndexFromRow, getTripStopRows } from './trip-stop-row-dom';

/**
 * Return the `scrollTop` value the container needs so the given row is
 * vertically centred in the viewport. When the row is taller than the
 * viewport, anchor it to the top with a small edge padding instead.
 * Used to centre the selected stop on dialog open / Prev-Next switch.
 */
export function getSelectedRowScrollTop(container: HTMLElement, selectedRow: HTMLElement): number {
  const edgePadding = 12;
  const containerRect = container.getBoundingClientRect();
  const rowRect = selectedRow.getBoundingClientRect();
  const rowTopWithinContainer = rowRect.top - containerRect.top + container.scrollTop;

  if (selectedRow.clientHeight >= container.clientHeight - edgePadding * 2) {
    return Math.max(0, rowTopWithinContainer - edgePadding);
  }

  return Math.max(
    0,
    rowTopWithinContainer - (container.clientHeight - selectedRow.clientHeight) / 2,
  );
}

/**
 * Compute the pattern `stopIndex` whose row best represents the current
 * scroll position. Uses a "moving trigger line" anchored at
 * `ratio * scrollHeight`, where `ratio = scrollTop / maxScroll`. The
 * anchor sweeps the entire scrollable content as the user scrolls
 * end-to-end, so every row gets a turn at being current regardless of
 * how variable the row heights are. Falls back to the closest row by
 * center distance to absorb gaps between rows. Returns `null` when the
 * container is not scrollable or has no rows yet (the caller should
 * keep the previously focused stop in that case).
 */
export function computeScrolledStopIndex(container: HTMLElement): number | null {
  const maxScroll = container.scrollHeight - container.clientHeight;
  if (maxScroll <= 0) {
    return null;
  }

  const rows = getTripStopRows(container);
  if (rows.length === 0) {
    return null;
  }

  const ratio = Math.min(1, Math.max(0, container.scrollTop / maxScroll));
  const anchorY = ratio * container.scrollHeight;
  const containerTop = container.getBoundingClientRect().top;

  let bestIndex: number | null = null;
  let bestDistance = Infinity;

  for (const row of rows) {
    const stopIndex = getTripStopIndexFromRow(row);
    if (stopIndex === null) {
      continue;
    }

    const rect = row.getBoundingClientRect();
    const rowTopInContainer = rect.top - containerTop + container.scrollTop;
    const rowCenterY = rowTopInContainer + rect.height / 2;
    const distance = Math.abs(rowCenterY - anchorY);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = stopIndex;
    }
  }

  return bestIndex;
}
