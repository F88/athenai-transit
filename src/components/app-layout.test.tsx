import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppLayout } from './app-layout';
import type { LayoutProps } from './layout-props';
import { DEFAULT_VIEW_ID } from '../domain/transit/stop-time-views';

/**
 * Props App passes to AppLayout: every {@link LayoutProps} field except the
 * shared StopBrowser state, which AppLayout owns and injects itself.
 */
type AppLayoutInputProps = Omit<LayoutProps, 'stopBrowserState' | 'onStopBrowserStateChange'>;

const { mockUseLayoutMode, mockMapBottomSheetLayout, mockMultiPaneLayout } = vi.hoisted(() => ({
  mockUseLayoutMode: vi.fn(),
  mockMapBottomSheetLayout: vi.fn(),
  mockMultiPaneLayout: vi.fn(),
}));

vi.mock('../hooks/use-layout-mode', () => ({
  useLayoutMode: mockUseLayoutMode,
}));

// Stub both layout implementations so this suite tests AppLayout in
// isolation: which layout is selected, and that every prop is forwarded.
vi.mock('./map-bottom-sheet-layout', () => ({
  MapBottomSheetLayout: (props: unknown) => {
    mockMapBottomSheetLayout(props);
    return null;
  },
}));

vi.mock('./multi-pane-layout', () => ({
  MultiPaneLayout: (props: unknown) => {
    mockMultiPaneLayout(props);
    return null;
  },
}));

/**
 * Distinct sentinel values per field so a forwarding regression — a
 * dropped, renamed, or swapped prop — fails the prop-equality assertion.
 */
function makeLayoutProps(): AppLayoutInputProps {
  return {
    bottomSheetProps: {
      sentinel: 'bottomSheetProps',
    } as unknown as LayoutProps['bottomSheetProps'],
    globalFilter: { sentinel: 'globalFilter' } as unknown as LayoutProps['globalFilter'],
    nearbyStopsCounts: {
      sentinel: 'nearbyStopsCounts',
    } as unknown as LayoutProps['nearbyStopsCounts'],
    filteredNearbyStopsCounts: {
      sentinel: 'filteredNearbyStopsCounts',
    } as unknown as LayoutProps['filteredNearbyStopsCounts'],
  };
}

/**
 * The shared StopBrowser state AppLayout injects: the initial value from its
 * own `useState`, plus the updater (asserted as any function).
 */
const expectedInjectedStopBrowserState = {
  stopBrowserState: {
    viewId: DEFAULT_VIEW_ID,
    hiddenRouteTypes: new Set(),
    hiddenAgencyIds: new Set(),
  },
  onStopBrowserStateChange: expect.any(Function),
};

function renderAppLayout(props: AppLayoutInputProps) {
  render(
    <AppLayout
      bottomSheetProps={props.bottomSheetProps}
      globalFilter={props.globalFilter}
      nearbyStopsCounts={props.nearbyStopsCounts}
      filteredNearbyStopsCounts={props.filteredNearbyStopsCounts}
    />,
  );
}

describe('AppLayout', () => {
  beforeEach(() => {
    mockUseLayoutMode.mockReset();
    mockMapBottomSheetLayout.mockReset();
    mockMultiPaneLayout.mockReset();
  });

  it('renders MapBottomSheetLayout (and not MultiPaneLayout) in simple mode', () => {
    mockUseLayoutMode.mockReturnValue('simple');
    renderAppLayout(makeLayoutProps());
    expect(mockMapBottomSheetLayout).toHaveBeenCalledTimes(1);
    expect(mockMultiPaneLayout).not.toHaveBeenCalled();
  });

  it('renders MultiPaneLayout (and not MapBottomSheetLayout) in multi-pane mode', () => {
    mockUseLayoutMode.mockReturnValue('multi-pane');
    renderAppLayout(makeLayoutProps());
    expect(mockMultiPaneLayout).toHaveBeenCalledTimes(1);
    expect(mockMapBottomSheetLayout).not.toHaveBeenCalled();
  });

  it('forwards received props and injects shared StopBrowser state to MapBottomSheetLayout in simple mode', () => {
    mockUseLayoutMode.mockReturnValue('simple');
    const props = makeLayoutProps();
    renderAppLayout(props);
    expect(mockMapBottomSheetLayout.mock.lastCall?.[0]).toEqual({
      ...props,
      ...expectedInjectedStopBrowserState,
    });
  });

  it('forwards received props and injects shared StopBrowser state to MultiPaneLayout in multi-pane mode', () => {
    mockUseLayoutMode.mockReturnValue('multi-pane');
    const props = makeLayoutProps();
    renderAppLayout(props);
    expect(mockMultiPaneLayout.mock.lastCall?.[0]).toEqual({
      ...props,
      ...expectedInjectedStopBrowserState,
    });
  });
});
