import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeRepo } from '../../__tests__/helpers';
import { getServiceDay } from '../../domain/transit/service-day';
import { useTripInspection } from '../use-trip-inspection';

const mockWarn = vi.fn();

vi.mock('../../lib/logger', () => ({
  createLogger: () => ({
    isEnabled: vi.fn().mockReturnValue(false),
    verbose: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: (...args: unknown[]) => {
      mockWarn(...args);
    },
    error: vi.fn(),
  }),
}));

describe('useTripInspection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockWarn.mockReset();
  });

  it('logs no-service-on-this-day when stopId lookup returns an empty result for the service day', async () => {
    const now = new Date('2026-05-02T14:59:36+09:00');
    const serviceDate = getServiceDay(now);
    const repo = makeRepo({
      getTripInspectionTargets: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        meta: { emptyReason: 'no-service-on-this-day' },
      }),
    });

    const { result } = renderHook(() => useTripInspection(repo));

    let status: Awaited<ReturnType<typeof result.current.openTripInspectionFromStopId>>;
    await act(async () => {
      status = await result.current.openTripInspectionFromStopId({
        stopId: 'sbbus:20023-15',
        now,
        serviceDate,
      });
    });

    expect(status!).toEqual({
      status: 'no-data',
      reason: 'no-service-on-this-day',
    });
    expect(mockWarn).toHaveBeenCalledWith(
      'openTripInspectionFromStopId: empty trip inspection target result',
      expect.objectContaining({
        stopId: 'sbbus:20023-15',
        emptyReason: 'no-service-on-this-day',
        note: 'The stop has trip-inspection data, but no services on the selected service day.',
      }),
    );
  });

  it('logs no-stop-data when stopId lookup returns no trip-inspection stop data', async () => {
    const now = new Date('2026-05-02T14:59:36+09:00');
    const serviceDate = getServiceDay(now);
    const repo = makeRepo({
      getTripInspectionTargets: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        meta: { emptyReason: 'no-stop-data' },
      }),
    });

    const { result } = renderHook(() => useTripInspection(repo));

    let status: Awaited<ReturnType<typeof result.current.openTripInspectionFromStopId>>;
    await act(async () => {
      status = await result.current.openTripInspectionFromStopId({
        stopId: 'missing_stop',
        now,
        serviceDate,
      });
    });

    expect(status!).toEqual({
      status: 'no-data',
      reason: 'no-stop-data',
    });
    expect(mockWarn).toHaveBeenCalledWith(
      'openTripInspectionFromStopId: empty trip inspection target result',
      expect.objectContaining({
        stopId: 'missing_stop',
        emptyReason: 'no-stop-data',
        note: 'The stop has no trip-inspection stop data.',
      }),
    );
  });
});
