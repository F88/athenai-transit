import { useCallback, useState } from 'react';
import settings from '../config/data-source-settings';
import { getDefaultEnabledIds } from '../domain/datasource/data-source-selection';
import {
  clearStoredEnabledGroupIds,
  loadEnabledGroupIdsFromStorage,
  saveEnabledGroupIdsToStorage,
} from '../domain/datasource/data-source-selection-storage';

/**
 * Return type for {@link useUserDataSourceSettings}.
 */
export interface UseUserDataSourceSettingsReturn {
  /**
   * Currently enabled source group IDs from the user preference.
   *
   * When the user has no explicit preference recorded, this returns
   * the config defaults (the set of groups where
   * `userEnabledByDefault === true`). After any explicit interaction
   * (`setGroupEnabled` / `resetToDefaults`) it reflects the live state.
   */
  enabledGroupIds: ReadonlySet<string>;
  /**
   * Toggle a single group's enabled state.
   *
   * Updates the in-memory state and persists synchronously to
   * `localStorage`. An empty resulting Set is persisted as `'[]'`
   * (user-explicit empty); to clear the preference entirely, use
   * {@link UseUserDataSourceSettingsReturn.resetToDefaults} instead.
   */
  setGroupEnabled: (groupId: string, enabled: boolean) => void;
  /**
   * Toggle multiple groups' enabled state in a single atomic update.
   *
   * One state transition and one persistence write are emitted no matter
   * how many group IDs are passed. Used for bulk actions like
   * "enable all" / "disable all" within a section. Behaves like
   * {@link UseUserDataSourceSettingsReturn.setGroupEnabled} called for
   * each id, except the React state and the `localStorage` write are
   * coalesced.
   */
  setGroupsEnabled: (groupIds: readonly string[], enabled: boolean) => void;
  /**
   * Clear the persisted user preference and restore the in-memory state
   * to the config defaults (`userEnabledByDefault === true` groups).
   */
  resetToDefaults: () => void;
}

/**
 * Hook for managing the user's data-source selection preference.
 *
 * The hook owns React state and the `localStorage` write path; the
 * boot-time reader lives in `main.tsx` (which calls the same
 * storage utility before React mounts). Within a session, mutations
 * via {@link UseUserDataSourceSettingsReturn.setGroupEnabled} persist
 * immediately to `localStorage` but **do not** affect what is already
 * loaded — the load layer reads `localStorage` only at boot, so user
 * toggles take effect on next reload (this is intentional for Phase 1;
 * the dialog surfaces a "development in progress" notice).
 *
 * **Multi-instance state**: this hook follows the `useUserSettings` /
 * `useStopHistory` pattern of file-private `useState`. Calling it
 * from multiple components yields independent state instances that do
 * not sync until the next remount. Phase 1's only consumer is the
 * Data Source Settings dialog, so this is not yet a problem. If a
 * future phase adds another consumer, context-ify the hook then.
 *
 * **Cross-tab sync**: the hook does not listen for `storage` events,
 * so a toggle in tab A is not propagated to tab B's hook state until
 * tab B reloads. This matches the existing pattern; address only if
 * a future phase needs cross-tab consistency.
 *
 * @returns The current preference and mutation callbacks.
 */
export function useUserDataSourceSettings(): UseUserDataSourceSettingsReturn {
  const [enabledGroupIds, setEnabledGroupIds] = useState<ReadonlySet<string>>(
    () => loadEnabledGroupIdsFromStorage() ?? getDefaultEnabledIds(settings),
  );

  const setGroupEnabled = useCallback((groupId: string, enabled: boolean): void => {
    setEnabledGroupIds((prev) => {
      const next = new Set(prev);
      if (enabled) {
        next.add(groupId);
      } else {
        next.delete(groupId);
      }
      saveEnabledGroupIdsToStorage(next);
      return next;
    });
  }, []);

  const setGroupsEnabled = useCallback((groupIds: readonly string[], enabled: boolean): void => {
    setEnabledGroupIds((prev) => {
      const next = new Set(prev);
      if (enabled) {
        for (const id of groupIds) {
          next.add(id);
        }
      } else {
        for (const id of groupIds) {
          next.delete(id);
        }
      }
      saveEnabledGroupIdsToStorage(next);
      return next;
    });
  }, []);

  const resetToDefaults = useCallback((): void => {
    clearStoredEnabledGroupIds();
    setEnabledGroupIds(getDefaultEnabledIds(settings));
  }, []);

  return { enabledGroupIds, setGroupEnabled, setGroupsEnabled, resetToDefaults };
}
