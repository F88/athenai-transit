/**
 * Tests for geo-utils.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import { getDistanceKm } from '../geo-utils';

describe('getDistanceKm', () => {
  it('returns 0 for identical points', () => {
    const a = { lat: 35.0, lng: 139.0 };
    const b = { stop_lat: 35.0, stop_lon: 139.0 };
    expect(getDistanceKm(a, b)).toBe(0);
  });

  it('returns kilometers for short urban distances', () => {
    const tokyo = { lat: 35.6812, lng: 139.7671 };
    const shinjuku = { stop_lat: 35.6896, stop_lon: 139.7006 };
    const distanceKm = getDistanceKm(tokyo, shinjuku);

    expect(distanceKm).toBeGreaterThan(5.5);
    expect(distanceKm).toBeLessThan(7.5);
  });

  it('stays consistent with getDistanceM on intercontinental distances', () => {
    const tokyo = { lat: 35.681236, lng: 139.767125 };
    const berlin = { stop_lat: 52.52, stop_lon: 13.405 };
    const distanceKm = getDistanceKm(tokyo, berlin);

    expect(distanceKm).toBeGreaterThan(8_800);
    expect(distanceKm).toBeLessThan(9_100);
    expect(distanceKm).toBeGreaterThan(8_800);
    expect(distanceKm).toBeLessThan(9_100);
  });

  it('is symmetric (a→b equals b→a)', () => {
    const a = { lat: 35.6812, lng: 139.7671 };
    const b = { stop_lat: 35.6895, stop_lon: 139.6917 };
    const ab = getDistanceKm(a, b);
    const ba = getDistanceKm(
      { lat: b.stop_lat, lng: b.stop_lon },
      { stop_lat: a.lat, stop_lon: a.lng },
    );
    expect(ab).toBeCloseTo(ba, 10);
  });

  it('matches the expected dateline-crossing distance in kilometers', () => {
    const westOfDateline = { lat: 0, lng: 179 };
    const eastAcrossDateline = { stop_lat: 0, stop_lon: -179 };
    const d = getDistanceKm(westOfDateline, eastAcrossDateline);
    expect(d).toBeGreaterThan(220);
    expect(d).toBeLessThan(223);
  });

  it('matches getDistanceM conversion for a simple 1 degree latitude delta', () => {
    const a = { lat: 0, lng: 0 };
    const b = { stop_lat: 1, stop_lon: 0 };
    expect(getDistanceKm(a, b)).toBeGreaterThan(111);
    expect(getDistanceKm(a, b)).toBeLessThan(112);
  });
});
