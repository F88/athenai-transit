/**
 * Tests for geo-utils.ts (Haversine distance).
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import { haversineKm } from '../geo-utils';

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm(35.6812, 139.7671, 35.6812, 139.7671)).toBe(0);
  });

  it('computes Tokyo Station → Shinjuku Station (~6.4 km)', () => {
    // Tokyo Station: 35.6812, 139.7671
    // Shinjuku Station: 35.6896, 139.7006
    const d = haversineKm(35.6812, 139.7671, 35.6896, 139.7006);
    expect(d).toBeCloseTo(6.4, 0); // within ~0.5 km
  });

  it('computes Tokyo → Osaka (~400 km)', () => {
    // Tokyo Station: 35.6812, 139.7671
    // Osaka Station: 34.7024, 135.4959
    const d = haversineKm(35.6812, 139.7671, 34.7024, 135.4959);
    expect(d).toBeCloseTo(400, -1); // within ~10 km
  });

  it('is symmetric (a→b equals b→a)', () => {
    const ab = haversineKm(35.6812, 139.7671, 35.6896, 139.7006);
    const ba = haversineKm(35.6896, 139.7006, 35.6812, 139.7671);
    expect(ab).toBe(ba);
  });

  it('handles antipodal points (~20000 km)', () => {
    // North pole to south pole
    const d = haversineKm(90, 0, -90, 0);
    expect(d).toBeCloseTo(20015, -1); // half the Earth's circumference
  });

  it('handles equator crossing', () => {
    const d = haversineKm(1, 0, -1, 0);
    // 2 degrees of latitude ≈ 222 km
    expect(d).toBeCloseTo(222, 0);
  });

  it('handles meridian crossing', () => {
    const d = haversineKm(0, -1, 0, 1);
    // 2 degrees of longitude at equator ≈ 222 km
    expect(d).toBeCloseTo(222, 0);
  });

  it('returns a very small distance for nearby points', () => {
    // ~100 meters apart
    const d = haversineKm(35.6812, 139.7671, 35.6821, 139.7671);
    expect(d).toBeGreaterThan(0.05);
    expect(d).toBeLessThan(0.15);
  });
});
