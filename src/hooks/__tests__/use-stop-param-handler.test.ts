import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeRepo, makeStop, makeStopMeta } from '../../__tests__/helpers';
import * as queryParams from '../../lib/query-params';
import { useStopParamHandler } from '../use-stop-param-handler';

describe('useStopParamHandler', () => {
  beforeEach(() => {
    vi.spyOn(queryParams, 'getStopParam').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marks handled without calling repo when there is no ?stop= param', async () => {
    const getStopMetaById = vi.fn();
    const repo = makeRepo({ getStopMetaById });
    const navigateAndFocusStop = vi.fn();
    const recordStopMetaSelection = vi.fn();

    renderHook(() => useStopParamHandler({ repo, navigateAndFocusStop, recordStopMetaSelection }));

    // Flush microtasks so any deferred state would have run.
    await act(async () => {
      await Promise.resolve();
    });

    expect(getStopMetaById).not.toHaveBeenCalled();
    expect(navigateAndFocusStop).not.toHaveBeenCalled();
    expect(recordStopMetaSelection).not.toHaveBeenCalled();
  });

  it('navigates and records when ?stop= resolves successfully', async () => {
    vi.spyOn(queryParams, 'getStopParam').mockReturnValue('A');
    const stopMeta = makeStopMeta(makeStop('A', 35, 139));
    const getStopMetaById = vi.fn().mockResolvedValue({ success: true, data: stopMeta });
    const repo = makeRepo({ getStopMetaById });
    const navigateAndFocusStop = vi.fn();
    const recordStopMetaSelection = vi.fn();

    renderHook(() => useStopParamHandler({ repo, navigateAndFocusStop, recordStopMetaSelection }));

    await waitFor(() => {
      expect(navigateAndFocusStop).toHaveBeenCalledTimes(1);
    });
    expect(navigateAndFocusStop).toHaveBeenCalledWith('apply-stop-param', stopMeta.stop);
    expect(recordStopMetaSelection).toHaveBeenCalledTimes(1);
    expect(recordStopMetaSelection).toHaveBeenCalledWith(stopMeta);
  });

  it('marks handled without navigating when the stop is not found', async () => {
    vi.spyOn(queryParams, 'getStopParam').mockReturnValue('missing');
    const getStopMetaById = vi.fn().mockResolvedValue({ success: false, error: 'not found' });
    const repo = makeRepo({ getStopMetaById });
    const navigateAndFocusStop = vi.fn();
    const recordStopMetaSelection = vi.fn();

    renderHook(() => useStopParamHandler({ repo, navigateAndFocusStop, recordStopMetaSelection }));

    // Wait for repo promise + post-resolve handler to settle.
    await waitFor(() => {
      expect(getStopMetaById).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(navigateAndFocusStop).not.toHaveBeenCalled();
    expect(recordStopMetaSelection).not.toHaveBeenCalled();
  });

  it('does not re-fetch and uses latest callbacks when dep callbacks change mid-flight', async () => {
    vi.spyOn(queryParams, 'getStopParam').mockReturnValue('A');
    const stopMeta = makeStopMeta(makeStop('A', 35, 139));
    let resolveLookup: (value: { success: true; data: typeof stopMeta }) => void = () => {};
    const getStopMetaById = vi.fn(
      () =>
        new Promise<{ success: true; data: typeof stopMeta }>((resolve) => {
          resolveLookup = resolve;
        }),
    );
    const repo = makeRepo({ getStopMetaById });
    const initialNavigate = vi.fn();
    const initialRecord = vi.fn();

    const { rerender } = renderHook(
      ({ navigate, record }) =>
        useStopParamHandler({
          repo,
          navigateAndFocusStop: navigate,
          recordStopMetaSelection: record,
        }),
      {
        initialProps: { navigate: initialNavigate, record: initialRecord },
      },
    );

    expect(getStopMetaById).toHaveBeenCalledTimes(1);

    // Swap dep callbacks while the repository lookup is still pending.
    const nextNavigate = vi.fn();
    const nextRecord = vi.fn();
    rerender({ navigate: nextNavigate, record: nextRecord });

    expect(getStopMetaById).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveLookup({ success: true, data: stopMeta });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(nextNavigate).toHaveBeenCalledTimes(1);
    });

    expect(nextNavigate).toHaveBeenCalledWith('apply-stop-param', stopMeta.stop);
    expect(nextRecord).toHaveBeenCalledWith(stopMeta);
    expect(initialNavigate).not.toHaveBeenCalled();
    expect(initialRecord).not.toHaveBeenCalled();

    // Later callback churn is still ignored for fetching because the
    // hook has already started handling the URL param.
    const thirdNavigate = vi.fn();
    const thirdRecord = vi.fn();
    rerender({ navigate: thirdNavigate, record: thirdRecord });
    await act(async () => {
      await Promise.resolve();
    });

    expect(getStopMetaById).toHaveBeenCalledTimes(1);
    expect(thirdNavigate).not.toHaveBeenCalled();
    expect(thirdRecord).not.toHaveBeenCalled();
  });
});
