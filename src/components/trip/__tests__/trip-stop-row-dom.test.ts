import { describe, expect, it } from 'vitest';
import {
  findTripStopRow,
  getTripStopIndexFromRow,
  getTripStopRows,
  tripStopRowDataAttrs,
} from '../trip-stop-row-dom';

function makeRow(indexAttr: number | string | null): HTMLDivElement {
  const div = document.createElement('div');
  if (indexAttr !== null) {
    div.setAttribute('data-trip-stop-index', String(indexAttr));
  }
  return div;
}

function makeContainer(children: HTMLElement[]): HTMLDivElement {
  const container = document.createElement('div');
  for (const child of children) {
    container.appendChild(child);
  }
  return container;
}

describe('tripStopRowDataAttrs', () => {
  it('returns the data attribute object with a numeric value', () => {
    expect(tripStopRowDataAttrs(0)).toEqual({ 'data-trip-stop-index': 0 });
    expect(tripStopRowDataAttrs(5)).toEqual({ 'data-trip-stop-index': 5 });
    expect(tripStopRowDataAttrs(99)).toEqual({ 'data-trip-stop-index': 99 });
  });

  it('preserves negative values without throwing', () => {
    expect(tripStopRowDataAttrs(-1)).toEqual({ 'data-trip-stop-index': -1 });
  });

  it('round-trips through findTripStopRow when spread on a row element', () => {
    const row = document.createElement('div');
    Object.assign(row, {});
    const attrs = tripStopRowDataAttrs(7);
    for (const [name, value] of Object.entries(attrs)) {
      row.setAttribute(name, String(value));
    }
    const container = makeContainer([row]);

    expect(findTripStopRow(container, 7)).toBe(row);
  });
});

describe('findTripStopRow', () => {
  it('returns the row whose attribute matches the given index', () => {
    const r0 = makeRow(0);
    const r1 = makeRow(1);
    const r2 = makeRow(2);
    const container = makeContainer([r0, r1, r2]);

    expect(findTripStopRow(container, 0)).toBe(r0);
    expect(findTripStopRow(container, 1)).toBe(r1);
    expect(findTripStopRow(container, 2)).toBe(r2);
  });

  it('returns null when no row matches the index', () => {
    const container = makeContainer([makeRow(0), makeRow(1)]);

    expect(findTripStopRow(container, 99)).toBeNull();
  });

  it('returns null when the container has no children', () => {
    const container = makeContainer([]);

    expect(findTripStopRow(container, 0)).toBeNull();
  });

  it('ignores siblings without the data attribute', () => {
    const row = makeRow(3);
    const unrelated = document.createElement('span');
    const container = makeContainer([unrelated, row]);

    expect(findTripStopRow(container, 3)).toBe(row);
  });

  it('finds rows for negative indices', () => {
    const row = makeRow(-1);
    const container = makeContainer([row]);

    expect(findTripStopRow(container, -1)).toBe(row);
  });

  it('returns the first match when duplicates exist', () => {
    const a = makeRow(5);
    const b = makeRow(5);
    const container = makeContainer([a, b]);

    expect(findTripStopRow(container, 5)).toBe(a);
  });
});

describe('getTripStopRows', () => {
  it('returns every element carrying the data attribute, in document order', () => {
    const r0 = makeRow(2);
    const r1 = makeRow(0);
    const r2 = makeRow(1);
    const container = makeContainer([r0, r1, r2]);

    const rows = getTripStopRows(container);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toBe(r0);
    expect(rows[1]).toBe(r1);
    expect(rows[2]).toBe(r2);
  });

  it('returns an empty NodeList when no rows are present', () => {
    const container = makeContainer([]);

    const rows = getTripStopRows(container);

    expect(rows).toHaveLength(0);
  });

  it('skips elements without the data attribute', () => {
    const row = makeRow(0);
    const irrelevant = document.createElement('span');
    const container = makeContainer([row, irrelevant]);

    const rows = getTripStopRows(container);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toBe(row);
  });

  it('returns a static NodeList that is iterable', () => {
    const r0 = makeRow(0);
    const r1 = makeRow(1);
    const container = makeContainer([r0, r1]);

    const collected: HTMLElement[] = [];
    for (const row of getTripStopRows(container)) {
      collected.push(row);
    }

    expect(collected).toEqual([r0, r1]);
  });
});

describe('getTripStopIndexFromRow', () => {
  it('returns the parsed number when the attribute is a valid integer', () => {
    expect(getTripStopIndexFromRow(makeRow(0))).toBe(0);
    expect(getTripStopIndexFromRow(makeRow(5))).toBe(5);
    expect(getTripStopIndexFromRow(makeRow(99))).toBe(99);
  });

  it('parses negative values', () => {
    expect(getTripStopIndexFromRow(makeRow(-1))).toBe(-1);
  });

  it('returns null when the attribute is absent', () => {
    expect(getTripStopIndexFromRow(makeRow(null))).toBeNull();
  });

  it('returns null when the attribute value is non-numeric', () => {
    expect(getTripStopIndexFromRow(makeRow('not-a-number'))).toBeNull();
    expect(getTripStopIndexFromRow(makeRow('abc'))).toBeNull();
  });

  it('returns null for NaN and Infinity literals', () => {
    expect(getTripStopIndexFromRow(makeRow('NaN'))).toBeNull();
    expect(getTripStopIndexFromRow(makeRow('Infinity'))).toBeNull();
    expect(getTripStopIndexFromRow(makeRow('-Infinity'))).toBeNull();
  });

  it('parses fractional numbers as-is (no rounding)', () => {
    // Documents existing behavior: Number('1.5') is 1.5, isFinite(1.5) is true.
    // Production setters always pass integers, but the helper does not enforce it.
    expect(getTripStopIndexFromRow(makeRow('1.5'))).toBe(1.5);
  });

  it('treats empty string as 0 (Number("") === 0)', () => {
    // Documents the JS coercion. Production code never sets an empty string.
    expect(getTripStopIndexFromRow(makeRow(''))).toBe(0);
  });
});
