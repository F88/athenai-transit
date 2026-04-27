import { describe, expect, it } from 'vitest';
import { computeScrolledStopIndex, getSelectedRowScrollTop } from '../trip-stop-scroll';

function makeRow(indexAttr: number | string | null): HTMLDivElement {
  const div = document.createElement('div');
  if (indexAttr !== null) {
    div.setAttribute('data-trip-stop-index', String(indexAttr));
  }
  return div;
}

interface LayoutOverrides {
  rect?: { top: number; height: number };
  scrollHeight?: number;
  clientHeight?: number;
  scrollTop?: number;
}

/**
 * Override layout-related properties on a JSDOM element. JSDOM does not
 * implement layout, so the helpers under test cannot read meaningful
 * `scrollHeight` / `clientHeight` / `getBoundingClientRect()` without
 * these overrides.
 */
function setLayout(el: HTMLElement, overrides: LayoutOverrides): void {
  if (overrides.scrollHeight !== undefined) {
    Object.defineProperty(el, 'scrollHeight', {
      configurable: true,
      value: overrides.scrollHeight,
    });
  }
  if (overrides.clientHeight !== undefined) {
    Object.defineProperty(el, 'clientHeight', {
      configurable: true,
      value: overrides.clientHeight,
    });
  }
  if (overrides.scrollTop !== undefined) {
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      writable: true,
      value: overrides.scrollTop,
    });
  }
  if (overrides.rect) {
    const { top, height } = overrides.rect;
    el.getBoundingClientRect = () =>
      ({
        top,
        height,
        left: 0,
        right: 0,
        bottom: top + height,
        width: 0,
        x: 0,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect;
  }
}

describe('getSelectedRowScrollTop', () => {
  it('centres the row in the viewport when it fits', () => {
    // Container at viewport top, height 400. Row at offsetTop 200, height 100.
    // Centring: scrollTop = 200 - (400 - 100) / 2 = 50.
    const container = document.createElement('div');
    setLayout(container, { rect: { top: 0, height: 400 }, clientHeight: 400, scrollTop: 0 });
    const row = document.createElement('div');
    setLayout(row, { rect: { top: 200, height: 100 }, clientHeight: 100 });

    expect(getSelectedRowScrollTop(container, row)).toBe(50);
  });

  it('clamps negative results to 0', () => {
    // Row already near the top: centring would require negative scrollTop.
    const container = document.createElement('div');
    setLayout(container, { rect: { top: 0, height: 400 }, clientHeight: 400, scrollTop: 0 });
    const row = document.createElement('div');
    setLayout(row, { rect: { top: 0, height: 100 }, clientHeight: 100 });

    expect(getSelectedRowScrollTop(container, row)).toBe(0);
  });

  it('anchors to the top with edge padding when the row is taller than the viewport', () => {
    // Row taller than (clientHeight - 24) triggers the top-anchor branch.
    // rowTopWithinContainer = 200; result = max(0, 200 - 12) = 188.
    const container = document.createElement('div');
    setLayout(container, { rect: { top: 0, height: 400 }, clientHeight: 400, scrollTop: 0 });
    const row = document.createElement('div');
    setLayout(row, { rect: { top: 200, height: 500 }, clientHeight: 500 });

    expect(getSelectedRowScrollTop(container, row)).toBe(188);
  });

  it('accounts for the container current scrollTop', () => {
    // Row currently sits 100px below the visible container top, but the
    // container is already scrolled by 300. Absolute row top is 100 + 300 = 400.
    // Centring: 400 - (400 - 100) / 2 = 250.
    const container = document.createElement('div');
    setLayout(container, { rect: { top: 0, height: 400 }, clientHeight: 400, scrollTop: 300 });
    const row = document.createElement('div');
    setLayout(row, { rect: { top: 100, height: 100 }, clientHeight: 100 });

    expect(getSelectedRowScrollTop(container, row)).toBe(250);
  });
});

describe('computeScrolledStopIndex', () => {
  /**
   * Build a scrollable container with N rows of equal height, all
   * carrying the data-trip-stop-index attribute. The container is at
   * viewport top so each row's `getBoundingClientRect().top` equals
   * its offset within the scrollable content minus `scrollTop`.
   */
  function buildScrollHarness(rowCount: number, rowHeight: number, clientHeight: number) {
    const scrollHeight = rowCount * rowHeight;
    const container = document.createElement('div');
    setLayout(container, {
      rect: { top: 0, height: clientHeight },
      clientHeight,
      scrollHeight,
    });

    const rows: HTMLDivElement[] = [];
    for (let i = 0; i < rowCount; i++) {
      const row = makeRow(i);
      rows.push(row);
      container.appendChild(row);
    }

    function setScrollTop(value: number) {
      setLayout(container, { scrollTop: value });
      for (let i = 0; i < rows.length; i++) {
        // Visible-position top = offsetTop - scrollTop (offsetTop = i * rowHeight).
        setLayout(rows[i], {
          rect: { top: i * rowHeight - value, height: rowHeight },
          clientHeight: rowHeight,
        });
      }
    }

    return { container, rows, scrollHeight, setScrollTop };
  }

  it('returns null when the container is not scrollable', () => {
    const { container, setScrollTop } = buildScrollHarness(5, 100, 600);
    setScrollTop(0); // scrollHeight=500 < clientHeight=600 → maxScroll = -100 ≤ 0
    expect(computeScrolledStopIndex(container)).toBeNull();
  });

  it('returns null when the container has no rows', () => {
    const container = document.createElement('div');
    setLayout(container, {
      rect: { top: 0, height: 200 },
      clientHeight: 200,
      scrollHeight: 1000,
      scrollTop: 0,
    });

    expect(computeScrolledStopIndex(container)).toBeNull();
  });

  it('returns the first stop at scrollTop=0', () => {
    const { container, setScrollTop } = buildScrollHarness(5, 200, 400);
    setScrollTop(0);

    expect(computeScrolledStopIndex(container)).toBe(0);
  });

  it('returns the last stop at scrollTop=max', () => {
    const { container, setScrollTop } = buildScrollHarness(5, 200, 400);
    // scrollHeight=1000, clientHeight=400, maxScroll=600
    setScrollTop(600);

    expect(computeScrolledStopIndex(container)).toBe(4);
  });

  it('returns a middle stop at scrollTop=max/2', () => {
    const { container, setScrollTop } = buildScrollHarness(5, 200, 400);
    // ratio=0.5, anchorY=500, row centers=100,300,500,700,900 → row 2.
    setScrollTop(300);

    expect(computeScrolledStopIndex(container)).toBe(2);
  });

  it('walks through every row as scrollTop sweeps end-to-end', () => {
    const { container, setScrollTop } = buildScrollHarness(5, 200, 400);
    const scrollTopValues = [0, 150, 300, 450, 600];
    const seen = scrollTopValues.map((scrollTop) => {
      setScrollTop(scrollTop);
      return computeScrolledStopIndex(container);
    });

    expect(seen).toEqual([0, 1, 2, 3, 4]);
  });

  it('clamps ratios above 1 (overscroll) to the last row', () => {
    const { container, setScrollTop } = buildScrollHarness(5, 200, 400);
    setScrollTop(99999); // wildly out of range

    expect(computeScrolledStopIndex(container)).toBe(4);
  });

  it('skips rows whose attribute cannot be parsed as a finite number', () => {
    const { container, rows, setScrollTop } = buildScrollHarness(5, 200, 400);
    rows[2].setAttribute('data-trip-stop-index', 'not-a-number');
    setScrollTop(300);

    // Anchor falls on the broken row. With it skipped, the next-closest
    // valid row by center distance is index 1 (center 300, distance 200)
    // or index 3 (center 700, distance 200). The first match wins, so 1.
    expect(computeScrolledStopIndex(container)).toBe(1);
  });
});
