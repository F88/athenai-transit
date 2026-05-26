import { type Dispatch, type SetStateAction, useCallback, useState } from 'react';

/**
 * Return shape of {@link useAppDialogs}.
 */
export interface UseAppDialogsReturn {
  infoDialogOpen: boolean;
  setInfoDialogOpen: Dispatch<SetStateAction<boolean>>;
  dataSourceSettingsDialogOpen: boolean;
  setDataSourceSettingsDialogOpen: Dispatch<SetStateAction<boolean>>;
  openInfoDialog: () => void;
  openDataSourceSettingsDialog: () => void;
}

/**
 * Owns the open state for the `App`-root info / data-source-settings dialog
 * pair.
 *
 * These two dialogs share an opening flow: `InfoDialog` exposes a button
 * that opens `DataSourceSettingsDialog` via `onOpenDataSourceSettings`,
 * so their state lives together. Other primary modals (search /
 * shortcut-help / timetable / trip-inspection) intentionally stay
 * outside this hook; they are tracked separately because each has its
 * own opening trigger and lifecycle.
 *
 * @returns Open state, setter, and named open action for each dialog.
 */
export function useAppDialogs(): UseAppDialogsReturn {
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [dataSourceSettingsDialogOpen, setDataSourceSettingsDialogOpen] = useState(false);

  const openInfoDialog = useCallback(() => {
    setInfoDialogOpen(true);
  }, []);

  const openDataSourceSettingsDialog = useCallback(() => {
    setDataSourceSettingsDialogOpen(true);
  }, []);

  return {
    infoDialogOpen,
    setInfoDialogOpen,
    dataSourceSettingsDialogOpen,
    setDataSourceSettingsDialogOpen,
    openInfoDialog,
    openDataSourceSettingsDialog,
  };
}
