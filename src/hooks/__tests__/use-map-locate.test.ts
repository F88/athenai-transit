import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import type L from 'leaflet';
import type { UserLocation } from '../../types/app/map';
import { useMapLocate } from '../use-map-locate';

const mockApplyLocateAction = vi.fn();
const mockResolveLocateAction = vi.fn();
const mockToUserLocation = vi.fn();

vi.mock('../../lib/map-locate', () => ({
  applyLocateAction: (...args: unknown[]): unknown => mockApplyLocateAction(...args),
  resolveLocateAction: (...args: unknown[]): unknown => mockResolveLocateAction(...args),
  toUserLocation: (...args: unknown[]): unknown => mockToUserLocation(...args),
}));

describe('useMapLocate', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockApplyLocateAction.mockReset();
    mockResolveLocateAction.mockReset();
    mockToUserLocation.mockReset();
  });

  it('applies the move action when the location resolves far from center', () => {
    const map = {} as L.Map;
    const onLocated = vi.fn();
    const loc: UserLocation = { lat: 35.0, lng: 139.0, accuracy: 10 };
    const action = { kind: 'move', distanceToLocation: 100 } as const;
    const pos = {
      coords: { latitude: 35.0, longitude: 139.0, accuracy: 10 },
    } as GeolocationPosition;
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

  it('invokes onNearMapCenter without applying a map action when the result is near', () => {
    const map = {} as L.Map;
    const onLocated = vi.fn();
    const onNearMapCenter = vi.fn();
    const loc: UserLocation = { lat: 35.0, lng: 139.0, accuracy: 10 };
    const action = { kind: 'near', distanceToLocation: 5 } as const;
    const pos = {
      coords: { latitude: 35.0, longitude: 139.0, accuracy: 10 },
    } as GeolocationPosition;
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

    const { result } = renderHook(() => useMapLocate(map, onLocated, { onNearMapCenter }));

    act(() => {
      result.current.handleLocate();
    });

    act(() => {
      success?.(pos);
    });

    expect(mockApplyLocateAction).not.toHaveBeenCalled();
    expect(onNearMapCenter).toHaveBeenCalledTimes(1);
    expect(onLocated).toHaveBeenCalledWith(loc);
    expect(result.current.locating).toBe(false);
  });

  it('does nothing visible when near and no onNearMapCenter is provided', () => {
    const map = {} as L.Map;
    const onLocated = vi.fn();
    const loc: UserLocation = { lat: 35.0, lng: 139.0, accuracy: 10 };
    const action = { kind: 'near', distanceToLocation: 5 } as const;
    const pos = {
      coords: { latitude: 35.0, longitude: 139.0, accuracy: 10 },
    } as GeolocationPosition;
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

    act(() => {
      success?.(pos);
    });

    expect(mockApplyLocateAction).not.toHaveBeenCalled();
    expect(onLocated).toHaveBeenCalledWith(loc);
  });

  it('forwards geolocation errors to onError and resets locating', () => {
    const map = {} as L.Map;
    const onLocated = vi.fn();
    const onError = vi.fn();
    let failure: PositionErrorCallback | undefined;

    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn((_onSuccess: PositionCallback, onErr?: PositionErrorCallback) => {
          failure = onErr;
        }),
      },
    });

    const { result } = renderHook(() => useMapLocate(map, onLocated, { onError }));

    act(() => {
      result.current.handleLocate();
    });

    expect(result.current.locating).toBe(true);

    const error = { code: 1, message: 'denied', PERMISSION_DENIED: 1 } as GeolocationPositionError;
    act(() => {
      failure?.(error);
    });

    expect(onLocated).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(error);
    expect(result.current.locating).toBe(false);
  });

  it('synthesizes a POSITION_UNAVAILABLE error when navigator.geolocation is missing', () => {
    // Insecure contexts and unsupported browsers leave
    // `navigator.geolocation` undefined. The hook used to silently
    // return, which made the locate button look broken. It now
    // fires `onError` with a code-2 synthetic event so the caller's
    // toast/log path runs uniformly.
    const map = {} as L.Map;
    const onLocated = vi.fn();
    const onError = vi.fn();

    vi.stubGlobal('navigator', {});

    const { result } = renderHook(() => useMapLocate(map, onLocated, { onError }));

    act(() => {
      result.current.handleLocate();
    });

    expect(result.current.locating).toBe(false);
    expect(onLocated).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    const synthesizedError = onError.mock.calls[0]?.[0] as GeolocationPositionError;
    expect(synthesizedError.code).toBe(2);
    expect(synthesizedError.message).toContain('not available');
  });

  it('does not throw when navigator.geolocation is missing and no onError is provided', () => {
    const map = {} as L.Map;
    const onLocated = vi.fn();

    vi.stubGlobal('navigator', {});

    const { result } = renderHook(() => useMapLocate(map, onLocated));

    expect(() => {
      act(() => {
        result.current.handleLocate();
      });
    }).not.toThrow();
    expect(result.current.locating).toBe(false);
    expect(onLocated).not.toHaveBeenCalled();
  });
});
