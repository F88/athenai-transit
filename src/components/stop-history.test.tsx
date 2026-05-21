import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeRoute, makeStopMeta } from '../__tests__/helpers';
import type { StopHistoryEntry } from '../domain/transit/stop-history';
import { StopHistory } from './stop-history';

let handleValueChange: ((value: string) => void) | undefined;

vi.mock('./ui/select', () => ({
  Select: ({
    children,
    onValueChange,
  }: {
    children: ReactNode;
    onValueChange?: (value: string) => void;
  }) => {
    handleValueChange = onValueChange;
    return <div>{children}</div>;
  },
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('./stop/stop-dropdown-item', () => ({
  StopDropdownItem: ({ stopId }: { stopId: string }) => (
    <button type="button" onClick={() => handleValueChange?.(stopId)}>
      {stopId}
    </button>
  ),
}));

function makeHistoryEntry(overrides?: Partial<StopHistoryEntry>): StopHistoryEntry {
  return {
    snapshot: {
      stopId: 'A',
      name: 'Snapshot A',
      lat: 35,
      lon: 139,
      routeTypes: [3],
      agencyIds: [],
    },
    selectedAt: 1000,
    ...overrides,
  };
}

describe('StopHistory', () => {
  it('renders nothing when history is empty', () => {
    const { container } = render(
      <StopHistory
        history={[]}
        selectedStopId={null}
        infoLevel="normal"
        dataLang={['ja']}
        lookupStopMeta={() => null}
        onSelect={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('shows the selected entry with latest display name and route-type emoji when metadata is available', () => {
    const meta = makeStopMeta('A');
    meta.stop.stop_name = 'Stop A';
    meta.stop.stop_names = { en: 'Latest A' };
    meta.routes = [makeRoute('r1', 1), makeRoute('r2', 3)];

    render(
      <StopHistory
        history={[makeHistoryEntry()]}
        selectedStopId="A"
        infoLevel="normal"
        dataLang={['en']}
        lookupStopMeta={() => meta}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('Latest A')).toBeInTheDocument();
    expect(screen.getByText('🚇🚌')).toBeInTheDocument();
  });

  it('shows the selected entry from the persisted snapshot when metadata is unavailable', () => {
    render(
      <StopHistory
        history={[makeHistoryEntry()]}
        selectedStopId="A"
        infoLevel="normal"
        dataLang={['en']}
        lookupStopMeta={() => null}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('Snapshot A')).toBeInTheDocument();
    expect(screen.getByText('🚌')).toBeInTheDocument();
  });

  it('emits the selected history entry when current repository stop metadata is available', () => {
    const onSelect = vi.fn();
    const meta = makeStopMeta('A');

    render(
      <StopHistory
        history={[makeHistoryEntry()]}
        selectedStopId={null}
        infoLevel="normal"
        dataLang={['ja']}
        lookupStopMeta={() => meta}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'A' }));

    expect(onSelect).toHaveBeenCalledWith(makeHistoryEntry());
  });

  it('emits the selected history entry when current metadata is unavailable', () => {
    const onSelect = vi.fn();

    render(
      <StopHistory
        history={[makeHistoryEntry()]}
        selectedStopId={null}
        infoLevel="normal"
        dataLang={['ja']}
        lookupStopMeta={() => null}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'A' }));

    expect(onSelect).toHaveBeenCalledWith(makeHistoryEntry());
  });
});
