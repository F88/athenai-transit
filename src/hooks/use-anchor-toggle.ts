import { useCallback } from 'react';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';

import { resolveAgencyLang } from '@/config/transit-defaults';
import type { AnchorEntry } from '@/domain/portal/anchor';
import type { LangChain } from '@/domain/transit/i18n/resolve-lang-chain';
import { getStopDisplayNames } from '@/domain/transit/name-resolver/get-stop-display-names';
import { createStopReferenceSnapshot } from '@/domain/transit/stop-reference-snapshot';
import type { UseAnchorsReturn } from '@/hooks/use-anchors';
import { createLogger } from '@/lib/logger';
import type { TransitRepository } from '@/repositories/transit-repository';
import type { StopWithMeta } from '@/types/app/transit-composed';
import { routeTypesEmoji } from '@/utils/route-type-emoji';

const logger = createLogger('AnchorToggle');

/**
 * Arguments for {@link useAnchorToggle}.
 */
export interface UseAnchorToggleParams {
  /** Current anchor list. */
  anchors: AnchorEntry[];
  /** Predicate for current anchor membership. */
  hasAnchor: UseAnchorsReturn['hasAnchor'];
  /** Persist a new anchor. */
  addAnchor: UseAnchorsReturn['addAnchor'];
  /** Remove an existing anchor. */
  removeAnchor: UseAnchorsReturn['removeAnchor'];
  /** Active repository used for add-side metadata lookup. */
  repo: TransitRepository;
  /** Full-dataset lookup for persisted anchor stop ids. */
  lookupAnchorStopMeta: (stopId: string) => StopWithMeta | null;
  /** Preferred display language chain. */
  langChain: LangChain;
  /** Translation function for toast labels. */
  t: TFunction;
}

/**
 * Return value for {@link useAnchorToggle}.
 *
 * Unlike `useAnchors`, this surface is intentionally narrow: callers
 * get the user-facing toggle action, not raw CRUD methods.
 */
export interface UseAnchorToggleReturn {
  /** Toggle anchor state for the given stop id. */
  handleToggleAnchorByStopId: (stopId: string) => void;
}

/**
 * Build the add/remove anchor toggle callback used by App surfaces.
 *
 * Keeps anchor-specific metadata lookup, snapshot creation, and toast
 * orchestration out of `App` while preserving current behavior.
 *
 * Responsibility boundary:
 *
 * - `useAnchors` manages the anchor collection itself and talks to the
 *   persistence repository.
 * - `useAnchorToggle` composes `useAnchors` outputs with
 *   `TransitRepository`, language resolution, and toast side effects to
 *   implement the single user intent of toggling one stop's anchor
 *   state.
 *
 * This split is intentional so the lower-level anchor hook stays free
 * of App UI concerns, while `App` does not need to inline anchor add /
 * remove orchestration.
 *
 * @param params - See {@link UseAnchorToggleParams}.
 * @returns Anchor toggle callback.
 */
export function useAnchorToggle({
  anchors,
  hasAnchor,
  addAnchor,
  removeAnchor,
  repo,
  lookupAnchorStopMeta,
  langChain,
  t,
}: UseAnchorToggleParams): UseAnchorToggleReturn {
  const removeExistingAnchorByStopId = useCallback(
    async (stopId: string): Promise<void> => {
      const anchor = anchors.find((entry) => entry.snapshot.stopId === stopId);
      const meta = lookupAnchorStopMeta(stopId);
      const stopName = meta
        ? getStopDisplayNames(
            meta.stop,
            langChain,
            resolveAgencyLang(meta.agencies, meta.stop.agency_id),
          ).name ||
          anchor?.snapshot.name ||
          stopId
        : (anchor?.snapshot.name ?? stopId);

      logger.debug(`handleToggleAnchor: removing stopId=${stopId}`);

      const result = await removeAnchor(stopId);
      if (!result.success) {
        return;
      }

      const prefix = anchor ? `${routeTypesEmoji(anchor.snapshot.routeTypes)} ` : '';
      toast.warning(t('anchor.removed'), { description: `${prefix}${stopName}` });
    },
    [anchors, langChain, lookupAnchorStopMeta, removeAnchor, t],
  );

  const addNewAnchorByStopId = useCallback(
    async (stopId: string): Promise<void> => {
      const [metaResult, routeTypesResult] = await Promise.all([
        repo.getStopMetaById(stopId),
        repo.getRouteTypesForStop(stopId),
      ]);

      if (!metaResult.success) {
        logger.warn('handleToggleAnchorByStopId: stop metadata lookup failed', {
          stopId,
          error: metaResult.error,
        });
        return;
      }

      const meta = metaResult.data;
      const routeTypes = routeTypesResult.success ? routeTypesResult.data : [-1 as const];
      const displayName =
        getStopDisplayNames(
          meta.stop,
          langChain,
          resolveAgencyLang(meta.agencies, meta.stop.agency_id),
        ).name || meta.stop.stop_name;

      if (logger.isEnabled('debug')) {
        logger.debug(`handleToggleAnchorByStopId: adding stopId=${stopId}, name=${displayName}`);
      }

      const snapshot = createStopReferenceSnapshot(meta, routeTypes, langChain);
      const result = await addAnchor({ snapshot });
      if (!result.success) {
        return;
      }

      toast.success(t('anchor.added'), {
        description: `${routeTypesEmoji(routeTypes)} ${displayName}`,
      });
    },
    [addAnchor, langChain, repo, t],
  );

  const handleToggleAnchorByStopId = useCallback(
    (stopId: string) => {
      if (hasAnchor(stopId)) {
        void removeExistingAnchorByStopId(stopId);
        return;
      }

      void addNewAnchorByStopId(stopId);
    },
    [addNewAnchorByStopId, hasAnchor, removeExistingAnchorByStopId],
  );

  return { handleToggleAnchorByStopId };
}
