import { describe, expect, it } from 'vitest';

import { hasVerticallyScrolledAncestor } from '../scrolled-ancestor';

/**
 * Builds a boundary > scroller > inner chain. jsdom has no layout, so
 * `scrollTop` is assigned directly to model a scrolled container.
 */
function buildChain(scrollTop: number): { boundary: Element; scroller: Element; inner: Element } {
  const boundary = document.createElement('div');
  const scroller = document.createElement('div');
  const inner = document.createElement('div');
  boundary.appendChild(scroller);
  scroller.appendChild(inner);
  scroller.scrollTop = scrollTop;
  return { boundary, scroller, inner };
}

describe('hasVerticallyScrolledAncestor', () => {
  it('returns true when an ancestor between start and boundary is scrolled', () => {
    const { boundary, inner } = buildChain(120);
    expect(hasVerticallyScrolledAncestor(inner, boundary)).toBe(true);
  });

  it('returns true when start itself is the scrolled element', () => {
    const { boundary, scroller } = buildChain(120);
    expect(hasVerticallyScrolledAncestor(scroller, boundary)).toBe(true);
  });

  it('returns false when every consulted element is at the top', () => {
    const { boundary, inner } = buildChain(0);
    expect(hasVerticallyScrolledAncestor(inner, boundary)).toBe(false);
  });

  it('returns false at exactly 1px (threshold is exclusive)', () => {
    const { boundary, inner } = buildChain(1);
    expect(hasVerticallyScrolledAncestor(inner, boundary)).toBe(false);
  });

  it('returns true just above the threshold (2px)', () => {
    const { boundary, inner } = buildChain(2);
    expect(hasVerticallyScrolledAncestor(inner, boundary)).toBe(true);
  });

  it('stops at the boundary and ignores scrolled elements above it', () => {
    const outerScrolled = document.createElement('div');
    const { boundary, inner } = buildChain(0);
    outerScrolled.appendChild(boundary);
    outerScrolled.scrollTop = 300;
    expect(hasVerticallyScrolledAncestor(inner, boundary)).toBe(false);
  });

  it('returns true when the boundary itself is the scrolled element', () => {
    const { boundary, inner } = buildChain(0);
    boundary.scrollTop = 50;
    expect(hasVerticallyScrolledAncestor(inner, boundary)).toBe(true);
  });

  it('returns false for a null start', () => {
    const boundary = document.createElement('div');
    expect(hasVerticallyScrolledAncestor(null, boundary)).toBe(false);
  });

  it('returns false when start is detached from the boundary tree', () => {
    const boundary = document.createElement('div');
    const detached = document.createElement('div');
    expect(hasVerticallyScrolledAncestor(detached, boundary)).toBe(false);
  });
});
