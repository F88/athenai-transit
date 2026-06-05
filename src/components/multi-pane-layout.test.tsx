import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { MultiPaneLayout } from './multi-pane-layout';
import type { LayoutProps } from './layout-props';
import { MapSlotProvider } from '../contexts/map-slot-provider';

const { mockUseMultiPaneOrientation } = vi.hoisted(() => ({
  mockUseMultiPaneOrientation: vi.fn(),
}));

vi.mock('../hooks/use-multi-pane-orientation', () => ({
  useMultiPaneOrientation: mockUseMultiPaneOrientation,
}));

// Stub the resizable primitives and pane contents so the test can read
// the split orientation, pane order, and the map placeholder shape
// without react-resizable-panels. The map pane is intentionally empty
// in the production component — the hoisted MapView shows through it.
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
  ResizablePanel: ({
    id,
    className,
    children,
  }: {
    id?: string;
    className?: string;
    children?: ReactNode;
  }) => (
    <div data-testid={id ? `resizable-panel-${id}` : 'resizable-panel'} data-classname={className}>
      {children}
    </div>
  ),
  ResizableHandle: () => <div data-testid="resize-handle" />,
}));

vi.mock('./stop-panel', () => ({
  StopPanel: () => <div data-testid="stop-panel" />,
}));

function makeLayoutProps(): LayoutProps {
  return {
    bottomSheetProps: {} as unknown as LayoutProps['bottomSheetProps'],
    globalFilter: {} as unknown as LayoutProps['globalFilter'],
    nearbyStopsCounts: {} as unknown as LayoutProps['nearbyStopsCounts'],
    filteredNearbyStopsCounts: {} as unknown as LayoutProps['filteredNearbyStopsCounts'],
    stopBrowserState: {} as unknown as LayoutProps['stopBrowserState'],
    onStopBrowserStateChange: () => {},
  };
}

function renderMultiPaneLayout() {
  const props = makeLayoutProps();
  // `MultiPaneLayout` registers its map placeholder slot via
  // `useSetMapSlotElement`, which requires `MapSlotProvider` upstream.
  render(
    <MapSlotProvider>
      <MultiPaneLayout
        bottomSheetProps={props.bottomSheetProps}
        globalFilter={props.globalFilter}
        nearbyStopsCounts={props.nearbyStopsCounts}
        filteredNearbyStopsCounts={props.filteredNearbyStopsCounts}
        stopBrowserState={props.stopBrowserState}
        onStopBrowserStateChange={props.onStopBrowserStateChange}
      />
    </MapSlotProvider>,
  );
}

/** `true` when the stop panel renders before the map placeholder in the DOM. */
function stopPanelRendersBeforeMapPlaceholder(): boolean {
  const panel = screen.getByTestId('stop-panel');
  const mapPlaceholder = screen.getByTestId('resizable-panel-multi-pane-map-pane');
  return Boolean(panel.compareDocumentPosition(mapPlaceholder) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe('MultiPaneLayout', () => {
  beforeEach(() => {
    mockUseMultiPaneOrientation.mockReset();
  });

  it('renders a horizontal split with the stop panel before the map placeholder in landscape', () => {
    mockUseMultiPaneOrientation.mockReturnValue('horizontal');
    renderMultiPaneLayout();

    expect(screen.getByTestId('panel-group')).toHaveAttribute('data-orientation', 'horizontal');
    expect(screen.getByTestId('stop-panel')).toBeInTheDocument();
    expect(screen.getByTestId('resizable-panel-multi-pane-map-pane')).toBeInTheDocument();
    // Horizontal split: stop panel on the left, visible map on the right.
    // The hoisted MapView shows through the empty placeholder pane.
    expect(stopPanelRendersBeforeMapPlaceholder()).toBe(true);
  });

  it('renders a vertical split with the map placeholder before the panel in portrait', () => {
    mockUseMultiPaneOrientation.mockReturnValue('vertical');
    renderMultiPaneLayout();

    expect(screen.getByTestId('panel-group')).toHaveAttribute('data-orientation', 'vertical');
    expect(screen.getByTestId('resizable-panel-multi-pane-map-pane')).toBeInTheDocument();
    // Vertical split: visible map on top, stop panel on the bottom.
    expect(stopPanelRendersBeforeMapPlaceholder()).toBe(false);
  });

  it('renders the map pane as a pointer-events-none placeholder containing only the slot div', () => {
    mockUseMultiPaneOrientation.mockReturnValue('horizontal');
    renderMultiPaneLayout();

    const mapPlaceholder = screen.getByTestId('resizable-panel-multi-pane-map-pane');
    // The map pane forwards pointer events to the hoisted MapView
    // behind it; its only visible content is the slot div that
    // `MapViewContainer` measures to position the map.
    expect(mapPlaceholder.textContent).toBe('');
    expect(mapPlaceholder.getAttribute('data-classname')).toContain('pointer-events-none');
    // The slot div is the only child of the pane and fills it so the
    // observed bbox equals the visible map area.
    const slot = mapPlaceholder.firstElementChild as HTMLElement | null;
    expect(slot).not.toBeNull();
    expect(slot?.className).toContain('h-full');
    expect(slot?.className).toContain('w-full');
  });
});
