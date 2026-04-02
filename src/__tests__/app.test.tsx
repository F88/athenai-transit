import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../app';
import type { UseAnchorsReturn } from '../hooks/use-anchors';

const { mockToastError, mockUseAnchors, mockGetRouteShapes, mockClearAnchorError } = vi.hoisted(
  () => ({
    mockToastError: vi.fn(),
    mockUseAnchors: vi.fn<(...args: unknown[]) => UseAnchorsReturn>(),
    mockGetRouteShapes: vi.fn(),
    mockClearAnchorError: vi.fn(),
  }),
);

vi.mock('sonner', () => ({
  toast: {
    error: mockToastError,
  },
}));

vi.mock('../components/ui/sonner', () => ({
  Toaster: () => null,
}));

vi.mock('../hooks/use-transit-repository', () => ({
  useTransitRepository: () => ({
    getRouteShapes: mockGetRouteShapes,
  }),
}));

vi.mock('../hooks/use-user-settings', () => ({
  useUserSettings: () => ({
    settings: {
      perfMode: 'normal',
      renderMode: 'auto',
      tileIndex: 0,
      infoLevel: 'normal',
      visibleStopTypes: [3],
      visibleRouteShapes: [3],
      theme: 'light',
      doubleTapDrag: false,
    },
    updateSetting: vi.fn(),
    updateSettings: vi.fn(),
  }),
}));

vi.mock('../hooks/use-date-time', () => ({
  useDateTime: () => ({
    dateTime: new Date('2026-03-28T12:00:00Z'),
    isCustomTime: false,
    resetToNow: vi.fn(),
    setCustomTime: vi.fn(),
  }),
}));

vi.mock('../hooks/use-nearby-departures', () => ({
  useNearbyDepartures: () => ({
    nearbyDepartures: [],
    isNearbyLoading: false,
  }),
}));

vi.mock('../hooks/use-selection', () => ({
  useSelection: () => ({
    selectedStopId: null,
    selectionInfo: null,
    focusPosition: null,
    selectStop: vi.fn(),
    selectStopById: vi.fn(),
    deselectStop: vi.fn(),
    selectRouteShape: vi.fn(),
    focusStop: vi.fn(),
    clearFocus: vi.fn(),
  }),
}));

vi.mock('../hooks/use-stop-history', () => ({
  useStopHistory: () => ({
    history: [],
    pushStop: vi.fn(),
  }),
}));

vi.mock('../hooks/use-route-stops', () => ({
  useRouteStops: () => [],
}));

vi.mock('../hooks/use-anchors', () => ({
  useAnchors: (...args: unknown[]) => mockUseAnchors(...args),
}));

vi.mock('../lib/query-params', () => ({
  getStopParam: () => null,
}));

vi.mock('../components/map/map-view', () => ({
  MapView: () => null,
}));

vi.mock('../components/bottom-sheet', () => ({
  BottomSheet: () => null,
}));

vi.mock('../components/time-controls', () => ({
  TimeControls: () => null,
}));

vi.mock('../components/dialog/timetable-modal', () => ({
  TimetableModal: () => null,
}));

vi.mock('../components/dialog/stop-search-modal', () => ({
  StopSearchModal: () => null,
}));

vi.mock('../components/dialog/info-dialog', () => ({
  InfoDialog: () => null,
}));

describe('App anchor error toast', () => {
  beforeEach(() => {
    mockToastError.mockReset();
    mockUseAnchors.mockReset();
    mockGetRouteShapes.mockReset();
    mockClearAnchorError.mockReset();

    mockGetRouteShapes.mockResolvedValue({ success: true, data: [] });
  });

  it('does not show toast when lastError is null', async () => {
    mockUseAnchors.mockReturnValue({
      anchors: [],
      lastError: null,
      clearError: mockClearAnchorError,
      addStop: vi.fn(),
      removeStop: vi.fn(),
      updateStop: vi.fn(),
      batchUpdateStops: vi.fn(),
      isStopAnchor: vi.fn(() => false),
    });

    render(<App />);

    // Give effects time to run
    await waitFor(() => {
      expect(mockToastError).not.toHaveBeenCalled();
      expect(mockClearAnchorError).not.toHaveBeenCalled();
    });
  });

  it('shows toast and clears anchor error when useAnchors returns lastError', async () => {
    mockUseAnchors.mockReturnValue({
      anchors: [],
      lastError: 'Duplicate stop: A',
      clearError: mockClearAnchorError,
      addStop: vi.fn(),
      removeStop: vi.fn(),
      updateStop: vi.fn(),
      batchUpdateStops: vi.fn(),
      isStopAnchor: vi.fn(() => false),
    });

    render(<App />);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('アンカー更新に失敗しました', {
        description: 'Duplicate stop: A',
        duration: 4500,
      });
      expect(mockClearAnchorError).toHaveBeenCalledTimes(1);
    });
  });
});
