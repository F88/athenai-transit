/**
 * Tests for stop-search-dialog.tsx.
 *
 * Focuses on the dialog's observable state contract: search query drives
 * the visible result set, and closing the dialog clears that query so it
 * does not leak into the next open session.
 *
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { buildSearchIndexEntry } from '@/domain/transit/stop-search-index';
import type { UseListKeyboardNavigationReturn } from '@/hooks/use-list-keyboard-navigation';
import type { UseStopSearchIndexReturn } from '@/hooks/use-stop-search-index';
import type { TransitRepository } from '@/repositories/transit-repository';
import type { AppRouteTypeValue, Stop } from '@/types/app/transit';
import type { StopWithMeta } from '@/types/app/transit-composed';

import { StopSearchDialog } from '../stop-search-dialog';

const {
  useStopSearchIndexMock,
  useStopSearchMetaMock,
  useListKeyboardNavigationMock,
  onSelectStopMock,
} = vi.hoisted(() => ({
  useStopSearchIndexMock:
    vi.fn<(repo: TransitRepository, open: boolean) => UseStopSearchIndexReturn>(),
  useStopSearchMetaMock:
    vi.fn<(repo: TransitRepository, stops: readonly Stop[]) => ReadonlyMap<string, StopWithMeta>>(),
  useListKeyboardNavigationMock: vi.fn<(...args: unknown[]) => UseListKeyboardNavigationReturn>(),
  onSelectStopMock: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: React.ReactNode;
  }) =>
    open ? (
      <div>
        <button type="button" aria-label="close dialog" onClick={() => onOpenChange?.(false)}>
          close
        </button>
        {children}
      </div>
    ) : null,
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/hooks/use-stop-search-index', () => ({
  useStopSearchIndex: useStopSearchIndexMock,
}));

vi.mock('@/hooks/use-stop-search-meta', () => ({
  useStopSearchMeta: useStopSearchMetaMock,
}));

vi.mock('@/hooks/use-list-keyboard-navigation', () => ({
  useListKeyboardNavigation: useListKeyboardNavigationMock,
}));

vi.mock('@/components/search/stop-search-result-item', () => ({
  StopSearchResultItem: ({ stop, onSelect }: { stop: Stop; onSelect: (stop: Stop) => void }) => (
    <button type="button" onClick={() => onSelect(stop)}>
      {stop.stop_name}
    </button>
  ),
}));

function makeStop(stopId: string, stopName: string): Stop {
  return {
    stop_id: stopId,
    stop_name: stopName,
    stop_names: {
      ja: stopName,
      en: stopName,
    },
    stop_lat: 35,
    stop_lon: 139,
    location_type: 0,
    agency_id: 'agency',
  };
}

const stopA = makeStop('stop-a', 'Shibuya');
const stopB = makeStop('stop-b', 'Shinagawa');

const defaultSearchIndex = [buildSearchIndexEntry(stopA), buildSearchIndexEntry(stopB)];
const defaultRouteTypeMap = new Map<string, AppRouteTypeValue[]>([
  ['stop-a', [3]],
  ['stop-b', [2]],
]);

function StopSearchDialogHarness() {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        reopen dialog
      </button>
      <StopSearchDialog
        repo={{} as TransitRepository}
        infoLevel="normal"
        dataLang={['ja']}
        mapCenter={null}
        onSelectStop={onSelectStopMock}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}

beforeEach(() => {
  onSelectStopMock.mockReset();
  useStopSearchIndexMock.mockImplementation((_repo: TransitRepository, open: boolean) => ({
    searchIndex: open ? defaultSearchIndex : [],
    routeTypeMap: defaultRouteTypeMap,
  }));
  useStopSearchMetaMock.mockReturnValue(new Map());
  useListKeyboardNavigationMock.mockReturnValue({
    selectedIndex: -1,
    handleInputKeyDown: vi.fn(),
    registerItemRef: () => vi.fn(),
  });
});

describe('StopSearchDialog', () => {
  it('filters visible results from the current query and shows no-results for misses', async () => {
    render(
      <StopSearchDialog
        repo={{} as TransitRepository}
        infoLevel="normal"
        dataLang={['ja']}
        mapCenter={null}
        onSelectStop={onSelectStopMock}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'shibu' } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Shibuya' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Shinagawa' })).not.toBeInTheDocument();
    });

    fireEvent.change(input, { target: { value: 'zzz' } });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Shibuya' })).not.toBeInTheDocument();
      expect(screen.getByText('search.noResults')).toBeInTheDocument();
    });
  });

  it('clears the query when the dialog closes so reopen starts fresh', async () => {
    render(<StopSearchDialogHarness />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'shibu' } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Shibuya' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'close dialog' }));

    await waitFor(() => {
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'reopen dialog' }));

    const reopenedInput = await screen.findByRole('textbox');
    expect(reopenedInput).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Shibuya' })).not.toBeInTheDocument();
    expect(screen.queryByText('search.noResults')).not.toBeInTheDocument();
  });
});
