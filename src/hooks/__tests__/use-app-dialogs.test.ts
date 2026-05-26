import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useAppDialogs } from '../use-app-dialogs';

describe('useAppDialogs', () => {
  it('starts with all four modals closed', () => {
    const { result } = renderHook(() => useAppDialogs());

    expect(result.current.infoDialogOpen).toBe(false);
    expect(result.current.dataSourceSettingsDialogOpen).toBe(false);
    expect(result.current.searchModalOpen).toBe(false);
    expect(result.current.shortcutHelpOpen).toBe(false);
  });

  it('opens the info dialog via openInfoDialog', () => {
    const { result } = renderHook(() => useAppDialogs());

    act(() => {
      result.current.openInfoDialog();
    });

    expect(result.current.infoDialogOpen).toBe(true);
    expect(result.current.dataSourceSettingsDialogOpen).toBe(false);
  });

  it('opens the data source settings dialog via openDataSourceSettingsDialog', () => {
    const { result } = renderHook(() => useAppDialogs());

    act(() => {
      result.current.openDataSourceSettingsDialog();
    });

    expect(result.current.dataSourceSettingsDialogOpen).toBe(true);
    expect(result.current.infoDialogOpen).toBe(false);
  });

  it('closes the info dialog via setInfoDialogOpen(false)', () => {
    const { result } = renderHook(() => useAppDialogs());

    act(() => {
      result.current.openInfoDialog();
    });
    expect(result.current.infoDialogOpen).toBe(true);

    act(() => {
      result.current.setInfoDialogOpen(false);
    });
    expect(result.current.infoDialogOpen).toBe(false);
  });

  it('closes the data source settings dialog via setDataSourceSettingsDialogOpen(false)', () => {
    const { result } = renderHook(() => useAppDialogs());

    act(() => {
      result.current.openDataSourceSettingsDialog();
    });
    expect(result.current.dataSourceSettingsDialogOpen).toBe(true);

    act(() => {
      result.current.setDataSourceSettingsDialogOpen(false);
    });
    expect(result.current.dataSourceSettingsDialogOpen).toBe(false);
  });

  it('keeps all four modals independent', () => {
    const { result } = renderHook(() => useAppDialogs());

    act(() => {
      result.current.openInfoDialog();
      result.current.openDataSourceSettingsDialog();
      result.current.openSearchModal();
      result.current.openShortcutHelp();
    });
    expect(result.current.infoDialogOpen).toBe(true);
    expect(result.current.dataSourceSettingsDialogOpen).toBe(true);
    expect(result.current.searchModalOpen).toBe(true);
    expect(result.current.shortcutHelpOpen).toBe(true);

    act(() => {
      result.current.setInfoDialogOpen(false);
    });
    expect(result.current.infoDialogOpen).toBe(false);
    expect(result.current.dataSourceSettingsDialogOpen).toBe(true);
    expect(result.current.searchModalOpen).toBe(true);
    expect(result.current.shortcutHelpOpen).toBe(true);

    act(() => {
      result.current.setSearchModalOpen(false);
    });
    expect(result.current.searchModalOpen).toBe(false);
    expect(result.current.dataSourceSettingsDialogOpen).toBe(true);
    expect(result.current.shortcutHelpOpen).toBe(true);
  });

  it('returns stable references for all named open actions across renders', () => {
    const { result, rerender } = renderHook(() => useAppDialogs());
    const firstOpenInfo = result.current.openInfoDialog;
    const firstOpenDss = result.current.openDataSourceSettingsDialog;
    const firstOpenSearch = result.current.openSearchModal;
    const firstOpenShortcutHelp = result.current.openShortcutHelp;

    rerender();

    expect(result.current.openInfoDialog).toBe(firstOpenInfo);
    expect(result.current.openDataSourceSettingsDialog).toBe(firstOpenDss);
    expect(result.current.openSearchModal).toBe(firstOpenSearch);
    expect(result.current.openShortcutHelp).toBe(firstOpenShortcutHelp);
  });

  it('opens the info dialog via setInfoDialogOpen(true) (Radix onOpenChange path)', () => {
    const { result } = renderHook(() => useAppDialogs());

    act(() => {
      result.current.setInfoDialogOpen(true);
    });

    expect(result.current.infoDialogOpen).toBe(true);
  });

  it('opens the data source settings dialog via setDataSourceSettingsDialogOpen(true) (Radix onOpenChange path)', () => {
    const { result } = renderHook(() => useAppDialogs());

    act(() => {
      result.current.setDataSourceSettingsDialogOpen(true);
    });

    expect(result.current.dataSourceSettingsDialogOpen).toBe(true);
  });

  it('supports the updater form on setInfoDialogOpen', () => {
    const { result } = renderHook(() => useAppDialogs());

    act(() => {
      result.current.setInfoDialogOpen((prev) => !prev);
    });
    expect(result.current.infoDialogOpen).toBe(true);

    act(() => {
      result.current.setInfoDialogOpen((prev) => !prev);
    });
    expect(result.current.infoDialogOpen).toBe(false);
  });

  it('returns stable references for all setters across renders', () => {
    const { result, rerender } = renderHook(() => useAppDialogs());
    const firstSetInfo = result.current.setInfoDialogOpen;
    const firstSetDss = result.current.setDataSourceSettingsDialogOpen;
    const firstSetSearch = result.current.setSearchModalOpen;
    const firstSetShortcutHelp = result.current.setShortcutHelpOpen;

    rerender();

    expect(result.current.setInfoDialogOpen).toBe(firstSetInfo);
    expect(result.current.setDataSourceSettingsDialogOpen).toBe(firstSetDss);
    expect(result.current.setSearchModalOpen).toBe(firstSetSearch);
    expect(result.current.setShortcutHelpOpen).toBe(firstSetShortcutHelp);
  });

  it('opens the search modal via openSearchModal', () => {
    const { result } = renderHook(() => useAppDialogs());

    act(() => {
      result.current.openSearchModal();
    });

    expect(result.current.searchModalOpen).toBe(true);
    expect(result.current.shortcutHelpOpen).toBe(false);
  });

  it('opens the shortcut help dialog via openShortcutHelp', () => {
    const { result } = renderHook(() => useAppDialogs());

    act(() => {
      result.current.openShortcutHelp();
    });

    expect(result.current.shortcutHelpOpen).toBe(true);
    expect(result.current.searchModalOpen).toBe(false);
  });

  it('opens the search modal via setSearchModalOpen(true) (Radix onOpenChange path)', () => {
    const { result } = renderHook(() => useAppDialogs());

    act(() => {
      result.current.setSearchModalOpen(true);
    });

    expect(result.current.searchModalOpen).toBe(true);
  });

  it('opens the shortcut help dialog via setShortcutHelpOpen(true) (Radix onOpenChange path)', () => {
    const { result } = renderHook(() => useAppDialogs());

    act(() => {
      result.current.setShortcutHelpOpen(true);
    });

    expect(result.current.shortcutHelpOpen).toBe(true);
  });

  it('closes the search modal via setSearchModalOpen(false)', () => {
    const { result } = renderHook(() => useAppDialogs());

    act(() => {
      result.current.openSearchModal();
    });
    expect(result.current.searchModalOpen).toBe(true);

    act(() => {
      result.current.setSearchModalOpen(false);
    });
    expect(result.current.searchModalOpen).toBe(false);
  });

  it('closes the shortcut help dialog via setShortcutHelpOpen(false)', () => {
    const { result } = renderHook(() => useAppDialogs());

    act(() => {
      result.current.openShortcutHelp();
    });
    expect(result.current.shortcutHelpOpen).toBe(true);

    act(() => {
      result.current.setShortcutHelpOpen(false);
    });
    expect(result.current.shortcutHelpOpen).toBe(false);
  });
});
