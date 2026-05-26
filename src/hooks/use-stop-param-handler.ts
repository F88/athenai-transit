import { useEffect, useRef } from 'react';

import { createLogger } from '../lib/logger';
import { getStopParam } from '../lib/query-params';
import type { TransitRepository } from '../repositories/transit-repository';
import type { AutoLocateOffReason } from '../types/app/auto-locate';
import type { Stop } from '../types/app/transit';
import type { StopWithMeta } from '../types/app/transit-composed';

const logger = createLogger('StopParamHandler');

/**
 * Arguments for {@link useStopParamHandler}.
 */
export interface UseStopParamHandlerParams {
  /** Active transit repository, used to resolve the `?stop=<id>` value. */
  repo: TransitRepository;
  /** Caller-supplied focus + pan-to-stop side effect. */
  navigateAndFocusStop: (reason: AutoLocateOffReason, stop: Stop) => void;
  /** Caller-supplied history record side effect for the resolved stop. */
  recordStopMetaSelection: (stopMeta: StopWithMeta) => void;
}

/**
 * Apply the `?stop=<id>` URL query parameter once per app session:
 * resolve the stop_id against the repository, pan / focus the map to
 * it, and record the resolved snapshot in history.
 *
 * The internal `started` ref guarantees the repository lookup starts
 * at most once per `useStopParamHandler` lifetime. The caller
 * callbacks are kept in a ref so callback identity churn during the
 * async lookup neither starts duplicate fetches nor forces the
 * continuation to use stale callbacks.
 *
 * No-param path: the ref is marked started immediately so subsequent
 * re-renders are no-ops.
 *
 * Not-found path: a warn is logged (`'StopParamHandler'` namespace,
 * separate from the App-level logger so the source is unambiguous);
 * the map is not panned and no history entry is recorded.
 *
 * @param params - See {@link UseStopParamHandlerParams}.
 */
export function useStopParamHandler({
  repo,
  navigateAndFocusStop,
  recordStopMetaSelection,
}: UseStopParamHandlerParams): void {
  const started = useRef(false);
  const callbacksRef = useRef({ navigateAndFocusStop, recordStopMetaSelection });

  useEffect(() => {
    callbacksRef.current = { navigateAndFocusStop, recordStopMetaSelection };
  }, [navigateAndFocusStop, recordStopMetaSelection]);

  useEffect(() => {
    if (started.current) {
      return;
    }

    const stopId = getStopParam();
    started.current = true;

    if (!stopId) {
      return;
    }

    void repo.getStopMetaById(stopId).then((result) => {
      if (!result.success) {
        logger.warn(`?stop=${stopId}: not found`);
        return;
      }

      const { navigateAndFocusStop: navigate, recordStopMetaSelection: record } =
        callbacksRef.current;
      navigate('apply-stop-param', result.data.stop);
      record(result.data);
    });
  }, [repo]);
}
