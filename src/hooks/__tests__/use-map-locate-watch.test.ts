import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UserLocation } from '../../types/app/map';
import { useMapLocateWatch } from '../use-map-locate-watch';

const mockToUserLocation = vi.fn();

vi.mock('../../lib/map-locate', () => ({
  toUserLocation: (...args: unknown[]): unknown => mockToUserLocation(...args),
}));

const SAMPLE_POSITION = {
  coords: { latitude: 35.0, longitude: 139.0, accuracy: 10 },
} as GeolocationPosition;
const SAMPLE_LOCATION: UserLocation = { lat: 35.0, lng: 139.0, accuracy: 10 };

interface GeolocationStub {
  getCurrentPosition: ReturnType<typeof vi.fn>;
  watchPosition: ReturnType<typeof vi.fn>;
  clearWatch: ReturnType<typeof vi.fn>;
  triggerInitialSuccess: (pos: GeolocationPosition) => void;
  triggerInitialError: (error: GeolocationPositionError) => void;
  triggerWatchSuccess: (pos: GeolocationPosition) => void;
  triggerWatchError: (error: GeolocationPositionError) => void;
}

function stubGeolocation(): GeolocationStub {
  let initialSuccess: PositionCallback | undefined;
  let initialError: PositionErrorCallback | undefined;
  let watchSuccess: PositionCallback | undefined;
  let watchError: PositionErrorCallback | undefined;
  const getCurrentPosition = vi.fn(
    (onSuccess: PositionCallback, onErr?: PositionErrorCallback) => {
      initialSuccess = onSuccess;
      initialError = onErr;
    },
  );
  const watchPosition = vi.fn((onSuccess: PositionCallback, onErr?: PositionErrorCallback) => {
    watchSuccess = onSuccess;
    watchError = onErr;
    return 42;
  });
  const clearWatch = vi.fn();
  vi.stubGlobal('navigator', {
    geolocation: { getCurrentPosition, watchPosition, clearWatch },
  });
  return {
    getCurrentPosition,
    watchPosition,
    clearWatch,
    triggerInitialSuccess: (pos) => initialSuccess?.(pos),
    triggerInitialError: (error) => initialError?.(error),
    triggerWatchSuccess: (pos) => watchSuccess?.(pos),
    triggerWatchError: (error) => watchError?.(error),
  };
}

describe('useMapLocateWatch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockToUserLocation.mockReset();
  });

  it('does nothing while disabled', () => {
    const stub = stubGeolocation();
    const onLocated = vi.fn();
    renderHook(() => useMapLocateWatch({ enabled: false, onLocated }));

    expect(stub.getCurrentPosition).not.toHaveBeenCalled();
    expect(stub.watchPosition).not.toHaveBeenCalled();
  });

  it('fires an immediate getCurrentPosition and registers watchPosition when enabled', () => {
    const stub = stubGeolocation();
    const onLocated = vi.fn();
    mockToUserLocation.mockReturnValue(SAMPLE_LOCATION);

    renderHook(() => useMapLocateWatch({ enabled: true, onLocated }));

    expect(stub.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(stub.watchPosition).toHaveBeenCalledTimes(1);
  });

  it('forwards watch updates to onLocated through toUserLocation', () => {
    const stub = stubGeolocation();
    const onLocated = vi.fn();
    mockToUserLocation.mockReturnValue(SAMPLE_LOCATION);

    renderHook(() => useMapLocateWatch({ enabled: true, onLocated }));

    act(() => {
      stub.triggerWatchSuccess(SAMPLE_POSITION);
    });

    expect(mockToUserLocation).toHaveBeenCalledWith(SAMPLE_POSITION);
    expect(onLocated).toHaveBeenCalledWith(SAMPLE_LOCATION);
  });

  it('forwards watch errors to onError', () => {
    const stub = stubGeolocation();
    const onLocated = vi.fn();
    const onError = vi.fn();
    const err = { code: 1, message: 'denied', PERMISSION_DENIED: 1 } as GeolocationPositionError;

    renderHook(() => useMapLocateWatch({ enabled: true, onLocated, onError }));

    act(() => {
      stub.triggerWatchError(err);
    });

    expect(onError).toHaveBeenCalledWith(err);
    expect(onLocated).not.toHaveBeenCalled();
  });

  it('clears the watch when enabled flips to false', () => {
    const stub = stubGeolocation();
    const onLocated = vi.fn();

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useMapLocateWatch({ enabled, onLocated }),
      { initialProps: { enabled: true } },
    );

    expect(stub.watchPosition).toHaveBeenCalledTimes(1);
    expect(stub.clearWatch).not.toHaveBeenCalled();

    rerender({ enabled: false });

    expect(stub.clearWatch).toHaveBeenCalledWith(42);
  });

  it('does nothing when geolocation is unavailable', () => {
    vi.stubGlobal('navigator', {});
    const onLocated = vi.fn();

    expect(() => renderHook(() => useMapLocateWatch({ enabled: true, onLocated }))).not.toThrow();
    expect(onLocated).not.toHaveBeenCalled();
  });

  it('ignores a late-arriving initial fix that resolves after disable', () => {
    const stub = stubGeolocation();
    const onLocated = vi.fn();
    mockToUserLocation.mockReturnValue(SAMPLE_LOCATION);

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useMapLocateWatch({ enabled, onLocated }),
      { initialProps: { enabled: true } },
    );

    // User toggles tracking off before getCurrentPosition resolves.
    rerender({ enabled: false });
    expect(stub.clearWatch).toHaveBeenCalledWith(42);

    // The browser eventually responds to the long-since-discarded
    // one-shot request. The hook must swallow it: callbacks are
    // gated by the cancelled flag set in the cleanup.
    act(() => {
      stub.triggerInitialSuccess(SAMPLE_POSITION);
    });

    expect(onLocated).not.toHaveBeenCalled();
  });

  it('ignores a late-arriving initial error that resolves after disable', () => {
    const stub = stubGeolocation();
    const onLocated = vi.fn();
    const onError = vi.fn();

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useMapLocateWatch({ enabled, onLocated, onError }),
      { initialProps: { enabled: true } },
    );

    rerender({ enabled: false });

    const err = { code: 1, message: 'denied', PERMISSION_DENIED: 1 } as GeolocationPositionError;
    act(() => {
      stub.triggerInitialError(err);
    });

    expect(onError).not.toHaveBeenCalled();
  });
});
