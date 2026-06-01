import { useMemo } from 'react';
import settings from '../../config/data-source-settings';
import { computeDialogDisplay } from '../../domain/datasource/dialog-display';
import { formatDateKey } from '../../domain/transit/calendar-utils';
import { useDataSourceGroupInfo } from '../../hooks/use-data-source-group-info';
import { useIsForcedSourcesMode } from '../../hooks/use-is-forced-sources-mode';
import { useSourceLoadStatus } from '../../hooks/use-source-load-status';
import { useUserDataSourceSettings } from '../../hooks/use-user-data-source-settings';
import { DataSourceSettingsDialog } from '../dialog/data-source-settings-dialog';

interface DataSourceSettingsContainerProps {
  open: boolean;
  /**
   * The app-wide effective "now", owned by `App`'s single `useDateTime`
   * instance and forwarded here (mirroring how `TripInspectionContainer`
   * receives `relativeTimeNow`). The container reduces it to a `YYYYMMDD` key
   * whose value is stable across the 15s tick, which keeps the period
   * classification (and its effect) from changing each tick. It does NOT, on
   * its own, stop the container/dialog from re-rendering on the tick -- they
   * are unmemoized, so the tick still re-renders this subtree. Cutting those
   * re-renders off is a separate memoization step (see Issue 265).
   */
  referenceDateTime: Date;
  onOpenChange: (open: boolean) => void;
}

/**
 * Owns the data-source settings dialog's stateful hooks
 * (`useSourceLoadStatus`, `useIsForcedSourcesMode`,
 * `useUserDataSourceSettings`, `useDataSourceGroupInfo`) and the
 * dialog-display derivation, then renders the presentational
 * {@link DataSourceSettingsDialog}.
 *
 * The effective clock is not owned here: `App` stays its single source of
 * truth and passes it in as `referenceDateTime` (see that prop for how it is
 * used).
 */
export function DataSourceSettingsContainer({
  open,
  referenceDateTime,
  onOpenChange,
}: DataSourceSettingsContainerProps) {
  const loadStatusByPrefix = useSourceLoadStatus();
  const isForcedSourcesMode = useIsForcedSourcesMode();
  const { enabledGroupIds, setGroupEnabled, setGroupsEnabled, resetToDefaults } =
    useUserDataSourceSettings();

  // Normalize the two operating modes (forced / normal) into one shape so
  // the view never branches on `isForcedSourcesMode`. Returns the visible
  // groups + the Set used for both per-row Switch state and per-section
  // enabled counts.
  const { visibleGroups, effectiveEnabledIds } = computeDialogDisplay(
    settings,
    loadStatusByPrefix,
    isForcedSourcesMode,
    enabledGroupIds,
  );

  const groupInfoById = useDataSourceGroupInfo(visibleGroups);

  // A YYYYMMDD key changes once per day, so the *value* passed downstream is
  // stable across the app's 15s tick even though `referenceDateTime` is a new
  // object each tick. This suppresses the period-status effect re-firing; it
  // does not stop the unmemoized container/dialog from re-rendering on the tick.
  const referenceDateKey = useMemo(() => formatDateKey(referenceDateTime), [referenceDateTime]);

  return (
    <DataSourceSettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      loadStatusByPrefix={loadStatusByPrefix}
      visibleGroups={visibleGroups}
      effectiveEnabledIds={effectiveEnabledIds}
      isForcedSourcesMode={isForcedSourcesMode}
      groupInfoById={groupInfoById}
      referenceDateKey={referenceDateKey}
      setGroupEnabled={setGroupEnabled}
      setGroupsEnabled={setGroupsEnabled}
      resetToDefaults={resetToDefaults}
    />
  );
}
