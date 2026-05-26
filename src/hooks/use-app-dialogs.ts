import { type Dispatch, type SetStateAction, useCallback, useState } from 'react';

/**
 * Return shape of {@link useAppDialogs}.
 */
export interface UseAppDialogsReturn {
  infoDialogOpen: boolean;
  setInfoDialogOpen: Dispatch<SetStateAction<boolean>>;
  dataSourceSettingsDialogOpen: boolean;
  setDataSourceSettingsDialogOpen: Dispatch<SetStateAction<boolean>>;
  searchModalOpen: boolean;
  setSearchModalOpen: Dispatch<SetStateAction<boolean>>;
  shortcutHelpOpen: boolean;
  setShortcutHelpOpen: Dispatch<SetStateAction<boolean>>;
  openInfoDialog: () => void;
  openDataSourceSettingsDialog: () => void;
  openSearchModal: () => void;
  openShortcutHelp: () => void;
}

/**
 * Owns the open state for the four `App`-root primary modals:
 * info, data-source-settings, search, and shortcut-help.
 *
 * `InfoDialog` exposes a button that opens `DataSourceSettingsDialog`
 * via `onOpenDataSourceSettings`, so those two share a lifecycle.
 * `searchModalOpen` and `shortcutHelpOpen` are independent surfaces,
 * but they share the same shape (boolean open flag with named open
 * action) and feed `useKeyboardShortcuts.enabled` the same way, so
 * they live together for a single source of truth on primary modal
 * open state.
 *
 * Modals owned by their own domain hooks (timetable / trip-inspection)
 * intentionally stay outside this hook because they carry payload
 * (data / snapshot) rather than a simple open flag.
 *
 * Each open state exposes both a `Dispatch<SetStateAction<boolean>>`
 * setter (compatible with Radix `onOpenChange`) and a named action
 * such as `openInfoDialog` for callers that want intent-clear wiring.
 *
 * @returns Open state, setter, and named open action for each modal.
 */
export function useAppDialogs(): UseAppDialogsReturn {
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [dataSourceSettingsDialogOpen, setDataSourceSettingsDialogOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);

  const openInfoDialog = useCallback(() => {
    setInfoDialogOpen(true);
  }, []);

  const openDataSourceSettingsDialog = useCallback(() => {
    setDataSourceSettingsDialogOpen(true);
  }, []);

  const openSearchModal = useCallback(() => {
    setSearchModalOpen(true);
  }, []);

  const openShortcutHelp = useCallback(() => {
    setShortcutHelpOpen(true);
  }, []);

  return {
    infoDialogOpen,
    setInfoDialogOpen,
    dataSourceSettingsDialogOpen,
    setDataSourceSettingsDialogOpen,
    searchModalOpen,
    setSearchModalOpen,
    shortcutHelpOpen,
    setShortcutHelpOpen,
    openInfoDialog,
    openDataSourceSettingsDialog,
    openSearchModal,
    openShortcutHelp,
  };
}
