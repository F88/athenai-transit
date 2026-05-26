import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useAppDialogs } from '../use-app-dialogs';

describe('useAppDialogs', () => {
  it('starts with both dialogs closed', () => {
    const { result } = renderHook(() => useAppDialogs());

    expect(result.current.infoDialogOpen).toBe(false);
    expect(result.current.dataSourceSettingsDialogOpen).toBe(false);
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

  it('keeps the two dialogs independent', () => {
    const { result } = renderHook(() => useAppDialogs());

    act(() => {
      result.current.openInfoDialog();
      result.current.openDataSourceSettingsDialog();
    });
    expect(result.current.infoDialogOpen).toBe(true);
    expect(result.current.dataSourceSettingsDialogOpen).toBe(true);

    act(() => {
      result.current.setInfoDialogOpen(false);
    });
    expect(result.current.infoDialogOpen).toBe(false);
    expect(result.current.dataSourceSettingsDialogOpen).toBe(true);
  });

  it('returns stable references for openInfoDialog and openDataSourceSettingsDialog across renders', () => {
    const { result, rerender } = renderHook(() => useAppDialogs());
    const firstOpenInfo = result.current.openInfoDialog;
    const firstOpenDss = result.current.openDataSourceSettingsDialog;

    rerender();

    expect(result.current.openInfoDialog).toBe(firstOpenInfo);
    expect(result.current.openDataSourceSettingsDialog).toBe(firstOpenDss);
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

  it('returns stable references for setInfoDialogOpen and setDataSourceSettingsDialogOpen across renders', () => {
    const { result, rerender } = renderHook(() => useAppDialogs());
    const firstSetInfo = result.current.setInfoDialogOpen;
    const firstSetDss = result.current.setDataSourceSettingsDialogOpen;

    rerender();

    expect(result.current.setInfoDialogOpen).toBe(firstSetInfo);
    expect(result.current.setDataSourceSettingsDialogOpen).toBe(firstSetDss);
  });
});
