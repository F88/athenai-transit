import { describe, expect, it } from 'vitest';
import type L from 'leaflet';
import type { UserLocation } from '../../types/app/map';
import { toUserLocation, resolveLocateAction } from '../map-locate';

function createMockMap(center: { lat: number; lng: number }, zoom: number, maxZoom: number): L.Map {
  return {
    getCenter: () => center,
    getZoom: () => zoom,
    getMaxZoom: () => maxZoom,
    distance: (_latlng: unknown, other: [number, number]) => {
      // Simple Euclidean approximation in meters (1 degree ≈ 111,000 m)
      const dlat = (center.lat - other[0]) * 111_000;
      const dlng = (center.lng - other[1]) * 111_000;
      return Math.sqrt(dlat * dlat + dlng * dlng);
    },
  } as unknown as L.Map;
}

describe('toUserLocation', () => {
  it('should convert GeolocationPosition to UserLocation', () => {
    const pos = {
      coords: { latitude: 35.6812, longitude: 139.7671, accuracy: 15 },
    } as GeolocationPosition;

    const result = toUserLocation(pos);

    expect(result).toEqual({ lat: 35.6812, lng: 139.7671, accuracy: 15 });
  });
});

describe('resolveLocateAction', () => {
  const loc: UserLocation = { lat: 35.6812, lng: 139.7671, accuracy: 10 };

  it('should return "move" when center is far from location', () => {
    // Center at ~1 km away
    const map = createMockMap({ lat: 35.69, lng: 139.7671 }, 14, 18);
    const action = resolveLocateAction(map, loc);

    expect(action.kind).toBe('move');
  });

  it('should return "zoom-in" when center is near and can zoom further', () => {
    // Center at the same position
    const map = createMockMap({ lat: 35.6812, lng: 139.7671 }, 14, 18);
    const action = resolveLocateAction(map, loc);

    expect(action.kind).toBe('zoom-in');
    if (action.kind === 'zoom-in') {
      expect(action.currentZoom).toBe(14);
      expect(action.nextZoom).toBe(15);
    }
  });

  it('should return "noop" when center is near and at max zoom', () => {
    const map = createMockMap({ lat: 35.6812, lng: 139.7671 }, 18, 18);
    const action = resolveLocateAction(map, loc);

    expect(action.kind).toBe('noop');
  });
});
