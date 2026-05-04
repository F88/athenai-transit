import { afterEach, describe, expect, it, vi } from 'vitest';
import type L from 'leaflet';
import type { UserLocation } from '../../types/app/map';
import {
  toUserLocation,
  resolveLocateAction,
  applyLocateAction,
  type MoveLocateAction,
} from '../map-locate';

const mockSmoothMoveTo = vi.fn();

vi.mock('../leaflet-helpers', () => ({
  smoothMoveTo: (...args: unknown[]): unknown => mockSmoothMoveTo(...args),
}));

function createMockMap(center: { lat: number; lng: number }): L.Map {
  return {
    getCenter: () => center,
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
    const map = createMockMap({ lat: 35.69, lng: 139.7671 });
    const action = resolveLocateAction(map, loc);

    expect(action.kind).toBe('move');
  });

  it('should return "near" when center is essentially at the location', () => {
    const map = createMockMap({ lat: 35.6812, lng: 139.7671 });
    const action = resolveLocateAction(map, loc);

    expect(action.kind).toBe('near');
  });

  it('should return "near" when center is just inside the threshold', () => {
    // ~5 m offset (under the 10 m threshold)
    const map = createMockMap({ lat: 35.6812 + 5 / 111_000, lng: 139.7671 });
    const action = resolveLocateAction(map, loc);

    expect(action.kind).toBe('near');
  });
});

describe('applyLocateAction', () => {
  const loc: UserLocation = { lat: 35.6812, lng: 139.7671, accuracy: 10 };

  function createMockMapWithSetZoom(): L.Map & { setZoom: ReturnType<typeof vi.fn> } {
    return {
      setZoom: vi.fn(),
    } as unknown as L.Map & { setZoom: ReturnType<typeof vi.fn> };
  }

  afterEach(() => {
    mockSmoothMoveTo.mockReset();
  });

  it('should call smoothMoveTo for the move action', () => {
    const map = createMockMapWithSetZoom();
    const action: MoveLocateAction = { kind: 'move', distanceToLocation: 500 };

    applyLocateAction(map, loc, action);

    expect(mockSmoothMoveTo).toHaveBeenCalledWith(map, [loc.lat, loc.lng], 16);
    expect(map.setZoom).not.toHaveBeenCalled();
  });
});
