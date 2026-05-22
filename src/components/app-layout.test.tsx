import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppLayout } from './app-layout';
import type { LayoutProps } from './layout-props';

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
function makeLayoutProps(): LayoutProps {
  return {
    mapViewProps: { sentinel: 'mapViewProps' } as unknown as LayoutProps['mapViewProps'],
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
    mapOverlay: 'mapOverlay-sentinel',
  };
}

function renderAppLayout(props: LayoutProps) {
  render(
    <AppLayout
      mapViewProps={props.mapViewProps}
      bottomSheetProps={props.bottomSheetProps}
      globalFilter={props.globalFilter}
      nearbyStopsCounts={props.nearbyStopsCounts}
      filteredNearbyStopsCounts={props.filteredNearbyStopsCounts}
      mapOverlay={props.mapOverlay}
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

  it('forwards every LayoutProps field to MapBottomSheetLayout in simple mode', () => {
    mockUseLayoutMode.mockReturnValue('simple');
    const props = makeLayoutProps();
    renderAppLayout(props);
    expect(mockMapBottomSheetLayout.mock.lastCall?.[0]).toEqual(props);
  });

  it('forwards every LayoutProps field to MultiPaneLayout in multi-pane mode', () => {
    mockUseLayoutMode.mockReturnValue('multi-pane');
    const props = makeLayoutProps();
    renderAppLayout(props);
    expect(mockMultiPaneLayout.mock.lastCall?.[0]).toEqual(props);
  });
});
