import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { MultiPaneLayout } from './multi-pane-layout';
import type { LayoutProps } from './layout-props';

const { mockUseMultiPaneOrientation } = vi.hoisted(() => ({
  mockUseMultiPaneOrientation: vi.fn(),
}));

vi.mock('../hooks/use-multi-pane-orientation', () => ({
  useMultiPaneOrientation: mockUseMultiPaneOrientation,
}));

// Stub the resizable primitives and pane contents so the test can read
// the split orientation and pane order without react-resizable-panels.
vi.mock('./ui/resizable', () => ({
  ResizablePanelGroup: ({
    orientation,
    children,
  }: {
    orientation: string;
    children: ReactNode;
  }) => (
    <div data-testid="panel-group" data-orientation={orientation}>
      {children}
    </div>
  ),
  ResizablePanel: ({ children }: { children: ReactNode }) => (
    <div data-testid="resizable-panel">{children}</div>
  ),
  ResizableHandle: () => <div data-testid="resize-handle" />,
}));

vi.mock('./map/map-view', () => ({
  MapView: () => <div data-testid="map-view" />,
}));

vi.mock('./stop-panel', () => ({
  StopPanel: () => <div data-testid="stop-panel" />,
}));

function makeLayoutProps(): LayoutProps {
  return {
    mapViewProps: {} as unknown as LayoutProps['mapViewProps'],
    bottomSheetProps: {} as unknown as LayoutProps['bottomSheetProps'],
    globalFilter: {} as unknown as LayoutProps['globalFilter'],
    nearbyStopsCounts: {} as unknown as LayoutProps['nearbyStopsCounts'],
    filteredNearbyStopsCounts: {} as unknown as LayoutProps['filteredNearbyStopsCounts'],
    mapOverlay: <div data-testid="map-overlay" />,
  };
}

function renderMultiPaneLayout() {
  const props = makeLayoutProps();
  render(
    <MultiPaneLayout
      mapViewProps={props.mapViewProps}
      bottomSheetProps={props.bottomSheetProps}
      globalFilter={props.globalFilter}
      nearbyStopsCounts={props.nearbyStopsCounts}
      filteredNearbyStopsCounts={props.filteredNearbyStopsCounts}
      mapOverlay={props.mapOverlay}
    />,
  );
}

/** `true` when the stop panel renders before the map view in the DOM. */
function stopPanelRendersBeforeMap(): boolean {
  const panel = screen.getByTestId('stop-panel');
  const map = screen.getByTestId('map-view');
  return Boolean(panel.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe('MultiPaneLayout', () => {
  beforeEach(() => {
    mockUseMultiPaneOrientation.mockReset();
  });

  it('renders a horizontal split with the panel before the map in landscape', () => {
    mockUseMultiPaneOrientation.mockReturnValue('horizontal');
    renderMultiPaneLayout();

    expect(screen.getByTestId('panel-group')).toHaveAttribute('data-orientation', 'horizontal');
    expect(screen.getByTestId('stop-panel')).toBeInTheDocument();
    expect(screen.getByTestId('map-view')).toBeInTheDocument();
    expect(screen.getByTestId('map-overlay')).toBeInTheDocument();
    // Horizontal split: panel on the left, map on the right.
    expect(stopPanelRendersBeforeMap()).toBe(true);
  });

  it('renders a vertical split with the map before the panel in portrait', () => {
    mockUseMultiPaneOrientation.mockReturnValue('vertical');
    renderMultiPaneLayout();

    expect(screen.getByTestId('panel-group')).toHaveAttribute('data-orientation', 'vertical');
    expect(screen.getByTestId('map-overlay')).toBeInTheDocument();
    // Vertical split: map on top, stop panel on the bottom.
    expect(stopPanelRendersBeforeMap()).toBe(false);
  });
});
