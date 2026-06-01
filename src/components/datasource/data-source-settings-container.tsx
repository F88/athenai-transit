import { useMemo } from 'react';
import settings from '../../config/data-source-settings';
import { computeDialogDisplay } from '../../domain/datasource/dialog-display';
import { getServiceDayKey } from '../../domain/transit/service-day';
import { useDataSourceGroupInfo } from '../../hooks/use-data-source-group-info';
import { useIsForcedSourcesMode } from '../../hooks/use-is-forced-sources-mode';
import { useSourceLoadStatus } from '../../hooks/use-source-load-status';
import { useUserDataSourceSettings } from '../../hooks/use-user-data-source-settings';
import { DataSourceSettingsDialog } from '../dialog/data-source-settings-dialog';

interface DataSourceSettingsContainerProps {
  open: boolean;
  /** The effective "now", used to classify each group's operating period. */
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

  // Key by the GTFS service day (03:00 boundary), matching how the app derives
  // "today" elsewhere. This keeps the operating-period classification correct
  // between 00:00-02:59, when the service day is still the previous calendar
  // day. The YYYYMMDD key changes once per day, so the value passed downstream
  // stays stable across the app clock updates.
  const referenceDateKey = useMemo(() => getServiceDayKey(referenceDateTime), [referenceDateTime]);

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
