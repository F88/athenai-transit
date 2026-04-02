import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import type L from 'leaflet';
import type { UserLocation } from '../../types/app/map';
import { useMapLocate } from '../use-map-locate';

const mockApplyLocateAction = vi.fn();
const mockResolveLocateAction = vi.fn();
const mockToUserLocation = vi.fn();

vi.mock('../../lib/map-locate', () => ({
  applyLocateAction: (...args: unknown[]) => mockApplyLocateAction(...args),
  resolveLocateAction: (...args: unknown[]) => mockResolveLocateAction(...args),
  toUserLocation: (...args: unknown[]) => mockToUserLocation(...args),
}));

describe('useMapLocate', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockApplyLocateAction.mockReset();
    mockResolveLocateAction.mockReset();
    mockToUserLocation.mockReset();
  });

  it('resolves geolocation, applies the action, and resets locating', () => {
    const map = {} as L.Map;
    const onLocated = vi.fn();
    const loc: UserLocation = { lat: 35.0, lng: 139.0, accuracy: 10 };
    const action = { kind: 'move', distanceToLocation: 100 } as const;
    const pos = { coords: { latitude: 35.0, longitude: 139.0, accuracy: 10 } } as GeolocationPosition;
    let success: PositionCallback | undefined;

    mockToUserLocation.mockReturnValue(loc);
    mockResolveLocateAction.mockReturnValue(action);

    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn((onSuccess: PositionCallback) => {
          success = onSuccess;
        }),
      },
    });

    const { result } = renderHook(() => useMapLocate(map, onLocated));

    act(() => {
      result.current.handleLocate();
    });

    expect(result.current.locating).toBe(true);

    act(() => {
      success?.(pos);
    });

    expect(mockToUserLocation).toHaveBeenCalledWith(pos);
    expect(mockResolveLocateAction).toHaveBeenCalledWith(map, loc);
    expect(mockApplyLocateAction).toHaveBeenCalledWith(map, loc, action);
    expect(onLocated).toHaveBeenCalledWith(loc);
    expect(result.current.locating).toBe(false);
  });

  it('resets locating when geolocation fails', () => {
    const map = {} as L.Map;
    const onLocated = vi.fn();
    let failure: PositionErrorCallback | undefined;

    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn(
          (_onSuccess: PositionCallback, onError?: PositionErrorCallback) => {
            failure = onError;
          },
        ),
      },
    });

    const { result } = renderHook(() => useMapLocate(map, onLocated));

    act(() => {
      result.current.handleLocate();
    });

    expect(result.current.locating).toBe(true);

    act(() => {
      failure?.({ code: 1, message: 'denied', PERMISSION_DENIED: 1 } as GeolocationPositionError);
    });

    expect(onLocated).not.toHaveBeenCalled();
    expect(result.current.locating).toBe(false);
  });

  it('does nothing when geolocation is unavailable', () => {
    const map = {} as L.Map;
    const onLocated = vi.fn();

    vi.stubGlobal('navigator', {});

    const { result } = renderHook(() => useMapLocate(map, onLocated));

    act(() => {
      result.current.handleLocate();
    });

    expect(result.current.locating).toBe(false);
    expect(onLocated).not.toHaveBeenCalled();
  });
});
