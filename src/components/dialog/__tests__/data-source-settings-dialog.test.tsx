/**
 * Tests for data-source-settings-dialog.tsx.
 *
 * Mocks the four hooks the dialog consumes so the test focuses on the
 * dialog's own logic (Switch checked / disabled / visibility filter,
 * Alert variant selection, Reset button enable / disable).
 *
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataSourceSettingsDialog } from '../data-source-settings-dialog';
import settings from '../../../config/data-source-settings';
import { getDefaultEnabledIds } from '../../../domain/datasource/data-source-selection';
import type { SourceLoadState } from '../../../domain/datasource/source-load-state';
import type { SourceGroup } from '../../../types/app/source-group';

const mockComputeDialogDisplay = vi.hoisted(() => vi.fn());

// Mock react-i18next: identity translation so the test asserts against
// raw i18n keys, decoupling it from locale file content. If options are
// provided, append the first stringy value so interpolated aria-labels
// stay distinguishable across instances.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts) {
        const firstStringOpt = Object.values(opts).find((v): v is string => typeof v === 'string');
        if (firstStringOpt !== undefined) {
          return `${key} [${firstStringOpt}]`;
        }
      }
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

const mockUseSourceLoadStatus = vi.fn<() => SourceLoadState>();
vi.mock('../../../hooks/use-source-load-status', () => ({
  useSourceLoadStatus: () => mockUseSourceLoadStatus(),
}));

const mockUseIsForcedSourcesMode = vi.fn<() => boolean>();
vi.mock('../../../hooks/use-is-forced-sources-mode', () => ({
  useIsForcedSourcesMode: () => mockUseIsForcedSourcesMode(),
}));

const mockSetGroupEnabled = vi.fn<(id: string, enabled: boolean) => void>();
const mockSetGroupsEnabled = vi.fn<(ids: readonly string[], enabled: boolean) => void>();
const mockResetToDefaults = vi.fn<() => void>();
const mockUseUserDataSourceSettings = vi.fn<
  () => {
    enabledGroupIds: ReadonlySet<string>;
    setGroupEnabled: (id: string, enabled: boolean) => void;
    setGroupsEnabled: (ids: readonly string[], enabled: boolean) => void;
    resetToDefaults: () => void;
  }
>();
vi.mock('../../../hooks/use-user-data-source-settings', () => ({
  useUserDataSourceSettings: () => mockUseUserDataSourceSettings(),
}));

// Minimal TransitRepository stub: only `getDataSourceCatalog` and
// `getAllSourceMeta` are touched by the dialog (other repository
// methods are unused in this test). Defaults: catalog is `null` and
// source meta resolves to an empty collection — the dialog must remain
// functional when no catalog is available, and per-group size captions
// are simply hidden.
const mockGetDataSourceCatalog = vi.fn<() => null>(() => null);
const mockGetAllSourceMeta = vi.fn(() =>
  Promise.resolve({ success: true as const, data: [], truncated: false }),
);
vi.mock('../../../hooks/use-transit-repository', () => ({
  useTransitRepository: () => ({
    getDataSourceCatalog: mockGetDataSourceCatalog,
    getAllSourceMeta: mockGetAllSourceMeta,
  }),
}));

vi.mock('../../../domain/datasource/dialog-display', async () => {
  const actual = await vi.importActual<typeof import('../../../domain/datasource/dialog-display')>(
    '../../../domain/datasource/dialog-display',
  );
  return {
    ...actual,
    computeDialogDisplay: (
      ...args: Parameters<typeof actual.computeDialogDisplay>
    ): ReturnType<typeof actual.computeDialogDisplay> => {
      const impl = mockComputeDialogDisplay.getMockImplementation();
      if (impl) {
        return impl(...args) as ReturnType<typeof actual.computeDialogDisplay>;
      }
      return actual.computeDialogDisplay(...args);
    },
  };
});

const noopOnOpenChange = (): void => {
  // intentionally empty for tests that don't care about close
};

const emptyLoadStatus: SourceLoadState = new Map();

const defaultEnabledIds = getDefaultEnabledIds(settings);

beforeEach(() => {
  mockComputeDialogDisplay.mockReset();
  // Default: normal mode, no load status, user has defaults.
  mockUseSourceLoadStatus.mockReturnValue(emptyLoadStatus);
  mockUseIsForcedSourcesMode.mockReturnValue(false);
  mockUseUserDataSourceSettings.mockReturnValue({
    enabledGroupIds: defaultEnabledIds,
    setGroupEnabled: mockSetGroupEnabled,
    setGroupsEnabled: mockSetGroupsEnabled,
    resetToDefaults: mockResetToDefaults,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * Returns the FIRST `<li>` row containing a Switch with the given
 * group-name aria label. A group with multiple `routeTypes` (e.g.
 * `toko` with `[0,1,2,3]`) appears once per section — Switch state is
 * identical across them (it's a `groupId` lookup against the same
 * `enabledGroupIds` Set), so asserting on the first occurrence is
 * sufficient. Callers that need the "every occurrence" assertion use
 * {@link getAllSwitchesFor}.
 */
function findGroupRow(groupName: string): HTMLElement {
  const switchEl = screen.getAllByRole('switch', {
    name: `dataSourceSettings.toggle.aria [${groupName}]`,
  })[0];
  if (!switchEl) {
    throw new Error(`row container not found for ${groupName}`);
  }
  // Walk up to the <li> container so the test can scope queries.
  let el: HTMLElement | null = switchEl;
  while (el && el.tagName !== 'LI') {
    el = el.parentElement;
  }
  if (!el) {
    throw new Error(`<li> not found for ${groupName}`);
  }
  return el;
}

function getAllSwitchesFor(groupName: string): HTMLElement[] {
  return screen.getAllByRole('switch', {
    name: `dataSourceSettings.toggle.aria [${groupName}]`,
  });
}

describe('DataSourceSettingsDialog — normal mode', () => {
  it('shows the development notice Alert, not the forced-mode Alert', () => {
    render(<DataSourceSettingsDialog open onOpenChange={noopOnOpenChange} />);
    expect(screen.getByText('dataSourceSettings.developmentNotice.title')).toBeInTheDocument();
    expect(screen.queryByText('dataSourceSettings.forcedMode.title')).not.toBeInTheDocument();
  });

  it('renders an other section for groups whose routeTypes are outside ROUTE_TYPE_PRIORITY', () => {
    const customGroup: SourceGroup = {
      id: 'other-test',
      prefixes: ['other-test-prefix'],
      routeTypes: [999 as never],
      systemEnabledByDefault: true,
      userEnabledByDefault: true,
      name: { name: 'Other Test', names: { en: 'Other Test' } },
      countries: ['JP'],
    };
    mockComputeDialogDisplay.mockReturnValue({
      visibleGroups: [customGroup],
      effectiveEnabledIds: new Set(['other-test']),
    });
    render(<DataSourceSettingsDialog open onOpenChange={noopOnOpenChange} />);
    expect(screen.getByText('dataSourceSettings.section.other')).toBeInTheDocument();
  });

  it('enables the Reset to defaults button', () => {
    render(<DataSourceSettingsDialog open onOpenChange={noopOnOpenChange} />);
    const resetButton = screen.getByRole('button', {
      name: 'dataSourceSettings.resetToDefaults',
    });
    expect(resetButton).not.toBeDisabled();
  });

  it('enables the Restart button', () => {
    render(<DataSourceSettingsDialog open onOpenChange={noopOnOpenChange} />);
    const restartButton = screen.getByRole('button', {
      name: 'dataSourceSettings.restart.aria',
    });
    expect(restartButton).not.toBeDisabled();
  });

  it('clicking Restart calls `window.location.reload`', () => {
    // jsdom defines `location.reload` as non-configurable, so we replace
    // the whole `location` global (preserving the other fields the
    // component might read like `href`) via `vi.stubGlobal`.
    const reloadSpy = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload: reloadSpy });

    try {
      render(<DataSourceSettingsDialog open onOpenChange={noopOnOpenChange} />);
      const restartButton = screen.getByRole('button', {
        name: 'dataSourceSettings.restart.aria',
      });
      fireEvent.click(restartButton);
      expect(reloadSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('renders a Switch checked = enabledGroupIds.has(groupId)', () => {
    // Pick a default-enabled group (Toei Bus) and one that's NOT in the
    // user's selection (Odakyu Bus is systemEnabledByDefault: false so
    // it would not be in defaults — keep enabledGroupIds as defaults and
    // assert based on that).
    mockUseUserDataSourceSettings.mockReturnValue({
      enabledGroupIds: new Set(['toei-bus']),
      setGroupEnabled: mockSetGroupEnabled,
      setGroupsEnabled: mockSetGroupsEnabled,
      resetToDefaults: mockResetToDefaults,
    });
    render(<DataSourceSettingsDialog open onOpenChange={noopOnOpenChange} />);
    const toeiBusRow = findGroupRow('Toei Bus');
    const toeiBusSwitch = within(toeiBusRow).getByRole('switch');
    expect(toeiBusSwitch).toHaveAttribute('aria-checked', 'true');
    // toei-train is NOT in the user-enabled set, so its Switch is OFF.
    const toeiTrainRow = findGroupRow('Toei Train');
    const toeiTrainSwitch = within(toeiTrainRow).getByRole('switch');
    expect(toeiTrainSwitch).toHaveAttribute('aria-checked', 'false');
  });

  it('clicking a Switch calls setGroupEnabled with the matching group id', () => {
    render(<DataSourceSettingsDialog open onOpenChange={noopOnOpenChange} />);
    const toeiBusRow = findGroupRow('Toei Bus');
    const toeiBusSwitch = within(toeiBusRow).getByRole('switch');
    // Initial state is `checked` (toei-bus is in defaults), so clicking
    // it toggles to false.
    fireEvent.click(toeiBusSwitch);
    expect(mockSetGroupEnabled).toHaveBeenCalledWith('toei-bus', false);
  });

  it('clicking Reset to defaults calls resetToDefaults', () => {
    render(<DataSourceSettingsDialog open onOpenChange={noopOnOpenChange} />);
    const resetButton = screen.getByRole('button', {
      name: 'dataSourceSettings.resetToDefaults',
    });
    fireEvent.click(resetButton);
    expect(mockResetToDefaults).toHaveBeenCalledTimes(1);
  });

  it('clicking the "All on" bulk button calls setGroupsEnabled with the section group ids and true', () => {
    render(<DataSourceSettingsDialog open onOpenChange={noopOnOpenChange} />);
    // There is one "All on" button per section; pick any one of the Bus
    // section's by aria-label.
    const enableAllBus = screen.getByRole('button', {
      name: 'dataSourceSettings.bulkAction.enableAll.aria [dataSourceSettings.section.3]',
    });
    fireEvent.click(enableAllBus);
    expect(mockSetGroupsEnabled).toHaveBeenCalledTimes(1);
    const [ids, enabled] = mockSetGroupsEnabled.mock.calls[0];
    expect(enabled).toBe(true);
    // Every bus row's groupId must be in the passed array (Toei Bus,
    // Kanto Bus, etc. — at least toei-bus and toko-bus-coverage).
    expect(ids).toContain('toei-bus');
    expect(ids).toContain('kanto-bus');
  });

  it('clicking the "All off" bulk button calls setGroupsEnabled with the section group ids and false', () => {
    render(<DataSourceSettingsDialog open onOpenChange={noopOnOpenChange} />);
    const disableAllBus = screen.getByRole('button', {
      name: 'dataSourceSettings.bulkAction.disableAll.aria [dataSourceSettings.section.3]',
    });
    fireEvent.click(disableAllBus);
    expect(mockSetGroupsEnabled).toHaveBeenCalledTimes(1);
    const [ids, enabled] = mockSetGroupsEnabled.mock.calls[0];
    expect(enabled).toBe(false);
    expect(ids).toContain('toei-bus');
  });

  it('honours group-vs-prefix semantics (overlap does NOT carry through to Switch state)', () => {
    // toei-bus and toko both contain `minkuru`. If the user has enabled
    // toei-bus but not toko, toko's Switch must be OFF — Switch state is
    // a group-id lookup, not a prefix lookup.
    mockUseUserDataSourceSettings.mockReturnValue({
      enabledGroupIds: new Set(['toei-bus']),
      setGroupEnabled: mockSetGroupEnabled,
      setGroupsEnabled: mockSetGroupsEnabled,
      resetToDefaults: mockResetToDefaults,
    });
    render(<DataSourceSettingsDialog open onOpenChange={noopOnOpenChange} />);
    const tokoRow = findGroupRow('Toei Transport');
    const tokoSwitch = within(tokoRow).getByRole('switch');
    expect(tokoSwitch).toHaveAttribute('aria-checked', 'false');
  });

  it('renders the partial loaded/total fraction for partially loaded groups', () => {
    mockUseSourceLoadStatus.mockReturnValue(
      new Map([
        ['minkuru', { status: 'loaded' }],
        ['toaran', { status: 'failed', error: new Error('network down') }],
      ]),
    );
    render(<DataSourceSettingsDialog open onOpenChange={noopOnOpenChange} />);
    expect(screen.getAllByText('dataSourceSettings.partial.fraction').length).toBeGreaterThan(0);
  });

  it('renders failed prefix messages for failed or partial groups', () => {
    mockUseSourceLoadStatus.mockReturnValue(
      new Map([['toaran', { status: 'failed', error: new Error('network down') }]]),
    );
    render(<DataSourceSettingsDialog open onOpenChange={noopOnOpenChange} />);
    expect(screen.getAllByText(/toaran/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/network down/).length).toBeGreaterThan(0);
  });
});

describe('DataSourceSettingsDialog — forced-sources mode', () => {
  beforeEach(() => {
    mockUseIsForcedSourcesMode.mockReturnValue(true);
    // Simulate `?sources=minkuru` having loaded the `minkuru` prefix.
    // Forced mode visibility filter shows only groups with any attempted
    // prefix — that means toei-bus AND toko (both share minkuru) become
    // visible; toei-train (toaran) does NOT.
    mockUseSourceLoadStatus.mockReturnValue(
      new Map<string, { status: 'loaded' }>([['minkuru', { status: 'loaded' }]]),
    );
  });

  it('shows the forced-mode Alert, not the development notice', () => {
    render(<DataSourceSettingsDialog open onOpenChange={noopOnOpenChange} />);
    expect(screen.getByText('dataSourceSettings.forcedMode.title')).toBeInTheDocument();
    expect(
      screen.queryByText('dataSourceSettings.developmentNotice.title'),
    ).not.toBeInTheDocument();
  });

  it('narrows visibility to groups with attempted prefixes', () => {
    render(<DataSourceSettingsDialog open onOpenChange={noopOnOpenChange} />);
    // toei-bus (1 section) and toko (4 sections — `routeTypes: [0,1,2,3]`)
    // share minkuru → both visible
    expect(getAllSwitchesFor('Toei Bus').length).toBeGreaterThan(0);
    expect(getAllSwitchesFor('Toei Transport').length).toBeGreaterThan(0);
    // toei-train (toaran only) → not loaded → not visible in forced mode
    expect(
      screen.queryAllByRole('switch', {
        name: 'dataSourceSettings.toggle.aria [Toei Train]',
      }),
    ).toHaveLength(0);
  });

  it('forces every visible Switch to checked=true regardless of user setting', () => {
    // Set user to NOT include either toei-bus or toko — forced override
    // wins.
    mockUseUserDataSourceSettings.mockReturnValue({
      enabledGroupIds: new Set(),
      setGroupEnabled: mockSetGroupEnabled,
      setGroupsEnabled: mockSetGroupsEnabled,
      resetToDefaults: mockResetToDefaults,
    });
    render(<DataSourceSettingsDialog open onOpenChange={noopOnOpenChange} />);
    for (const sw of getAllSwitchesFor('Toei Bus')) {
      expect(sw).toHaveAttribute('aria-checked', 'true');
    }
    for (const sw of getAllSwitchesFor('Toei Transport')) {
      expect(sw).toHaveAttribute('aria-checked', 'true');
    }
  });

  it('disables every visible Switch', () => {
    render(<DataSourceSettingsDialog open onOpenChange={noopOnOpenChange} />);
    for (const sw of getAllSwitchesFor('Toei Bus')) {
      expect(sw).toBeDisabled();
    }
    for (const sw of getAllSwitchesFor('Toei Transport')) {
      expect(sw).toBeDisabled();
    }
  });

  it('disables the Reset to defaults button', () => {
    render(<DataSourceSettingsDialog open onOpenChange={noopOnOpenChange} />);
    const resetButton = screen.getByRole('button', {
      name: 'dataSourceSettings.resetToDefaults',
    });
    expect(resetButton).toBeDisabled();
  });

  it('disables the Restart button', () => {
    render(<DataSourceSettingsDialog open onOpenChange={noopOnOpenChange} />);
    const restartButton = screen.getByRole('button', {
      name: 'dataSourceSettings.restart.aria',
    });
    expect(restartButton).toBeDisabled();
  });

  it('disables every bulk-action button', () => {
    render(<DataSourceSettingsDialog open onOpenChange={noopOnOpenChange} />);
    // Bus section is the one that gets shown in forced mode for this
    // setup (minkuru loaded). Both bulk buttons in that section must be
    // disabled.
    const enableAllBus = screen.getByRole('button', {
      name: 'dataSourceSettings.bulkAction.enableAll.aria [dataSourceSettings.section.3]',
    });
    const disableAllBus = screen.getByRole('button', {
      name: 'dataSourceSettings.bulkAction.disableAll.aria [dataSourceSettings.section.3]',
    });
    expect(enableAllBus).toBeDisabled();
    expect(disableAllBus).toBeDisabled();
  });
});
