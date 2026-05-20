import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BootstrapApp from '../bootstrap-app';
import type { AppBootstrapState, BootstrapProgressLogEntry } from '../hooks/use-app-bootstrap';
import type { RepositoryLoadProgressSummary } from '../repositories/athenai-repository';
import type { TransitRepository } from '../repositories/transit-repository';

const mockUseAppBootstrap = vi.hoisted(() => vi.fn<() => AppBootstrapState>());
const mockTransitRepositoryProvider = vi.hoisted(() => vi.fn());
const mockSourceLoadStateProvider = vi.hoisted(() => vi.fn());
const mockGetBootstrapParam = vi.hoisted(() => vi.fn<() => 'hold' | null>(() => null));

vi.mock('../hooks/use-app-bootstrap', () => ({
  useAppBootstrap: () => mockUseAppBootstrap(),
}));

vi.mock('../app', () => ({
  default: () => <div>app-mounted</div>,
}));

vi.mock('../contexts/transit-repository-provider', () => ({
  TransitRepositoryProvider: ({
    repository,
    children,
  }: {
    repository: unknown;
    children: ReactNode;
  }) => {
    mockTransitRepositoryProvider(repository);
    return <>{children}</>;
  },
}));

vi.mock('../contexts/source-load-state-provider', () => ({
  SourceLoadStateProvider: ({
    initialLoadResult,
    sourcesParam,
    children,
  }: {
    initialLoadResult: unknown;
    sourcesParam: string | null;
    children: ReactNode;
  }) => {
    mockSourceLoadStateProvider({ initialLoadResult, sourcesParam });
    return <>{children}</>;
  },
}));

vi.mock('../lib/query-params', () => ({
  getBootstrapParam: () => mockGetBootstrapParam(),
  getSourcesParam: () => 'alpha,beta',
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        'bootstrap.loading.title': 'Preparing app',
        'bootstrap.loading.message': 'This will only take a moment.',
        'bootstrap.loading.progressLabel': 'Loading data',
        'bootstrap.loading.progressFailed': 'failed',
        'bootstrap.ready.title': 'Ready',
        'bootstrap.ready.message': 'Ready',
        'bootstrap.action.showApp': 'Show app',
        'bootstrap.action.reload': 'Reload',
        'bootstrap.logViewer.title': 'Load log',
        'bootstrap.notice.loadFailuresTitle': 'Data load issues',
        'bootstrap.tips.dataSources': 'You can change data in settings.',
        'bootstrap.tips.selection': 'Choose the data you need or are interested in.',
        'bootstrap.tips.performance': 'Large data can affect app performance.',
        'bootstrap.error.title': 'Could not start Athenai',
        'bootstrap.error.message': 'Please reload the app and try again.',
      };
      return labels[key] ?? key;
    },
  }),
}));

function createProgressSummary(): RepositoryLoadProgressSummary {
  const event = {
    type: 'succeeded',
    kind: 'data',
    path: 'alpha/data.json',
    prefix: 'alpha',
    optional: false,
    metrics: {},
  } as const;

  return {
    boot: {
      totalSources: 2,
      startedSources: 2,
      completedSources: 1,
      failedSources: 0,
      progressRatio: 0.5,
      lastRequiredEvent: event,
    },
    activity: {
      requestCounts: { started: 2, succeeded: 1, skipped: 0, failed: 0 },
      totalEncodedBytes: 0,
      totalDecodedBytes: 0,
      lastEvent: event,
    },
  };
}

function createFailedProgressSummary(): RepositoryLoadProgressSummary {
  const event = {
    type: 'failed',
    kind: 'data',
    path: 'x13103b/data.json',
    prefix: 'x13103b',
    optional: false,
    reason: 'http-error',
    message: 'Not Found',
  } as const;

  return {
    boot: {
      totalSources: 2,
      startedSources: 2,
      completedSources: 1,
      failedSources: 1,
      progressRatio: 1,
      lastRequiredEvent: event,
    },
    activity: {
      requestCounts: { started: 2, succeeded: 1, skipped: 0, failed: 1 },
      totalEncodedBytes: 0,
      totalDecodedBytes: 0,
      lastEvent: event,
    },
  };
}

function createCompletedProgressSummaryWithOptionalLastEvent(): RepositoryLoadProgressSummary {
  const requiredEvent = {
    type: 'failed',
    kind: 'data',
    path: 'x13103b/data.json',
    prefix: 'x13103b',
    optional: false,
    reason: 'http-error',
    message: 'Not Found',
  } as const;
  const optionalEvent = {
    type: 'succeeded',
    kind: 'global-insights',
    path: 'global/insights.json',
    prefix: null,
    optional: true,
    metrics: {},
  } as const;

  return {
    boot: {
      totalSources: 2,
      startedSources: 2,
      completedSources: 0,
      failedSources: 2,
      progressRatio: 1,
      lastRequiredEvent: requiredEvent,
    },
    activity: {
      requestCounts: { started: 4, succeeded: 2, skipped: 0, failed: 2 },
      totalEncodedBytes: 0,
      totalDecodedBytes: 0,
      lastEvent: optionalEvent,
    },
  };
}

function createProgressLog(summary: RepositoryLoadProgressSummary): BootstrapProgressLogEntry {
  return {
    id: 1,
    createdAt: 100,
    event: summary.activity.lastEvent,
    summary,
  };
}

function createProgressLogWithEvent({
  event,
  id,
  summary,
}: {
  event: BootstrapProgressLogEntry['event'];
  id: number;
  summary: RepositoryLoadProgressSummary;
}): BootstrapProgressLogEntry {
  return {
    id,
    createdAt: 100 + id,
    event,
    summary,
  };
}

function createLoadingState(
  progress: RepositoryLoadProgressSummary | null = null,
): Extract<AppBootstrapState, { status: 'loading' }> {
  return {
    status: 'loading',
    progress,
    logs: progress === null ? [] : [createProgressLog(progress)],
  };
}

function stubReducedMotion(): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe('BootstrapApp', () => {
  beforeEach(() => {
    mockUseAppBootstrap.mockReset();
    mockTransitRepositoryProvider.mockReset();
    mockSourceLoadStateProvider.mockReset();
    mockGetBootstrapParam.mockReset();
    mockGetBootstrapParam.mockReturnValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the boot shell while the repository is loading', () => {
    mockUseAppBootstrap.mockReturnValue(createLoadingState());

    render(<BootstrapApp />);

    expect(screen.getByText('This will only take a moment.')).toBeInTheDocument();
    expect(screen.getByLabelText('Tips')).toBeInTheDocument();
    expect(screen.getByText('You can change data in settings.')).toBeInTheDocument();
    expect(screen.getByText('Choose the data you need or are interested in.')).toBeInTheDocument();
    expect(screen.getByText('Large data can affect app performance.')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Loading data' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
    expect(screen.queryByText('app-mounted')).not.toBeInTheDocument();
  });

  it('renders bootstrap progress status and logs', () => {
    const progress = createProgressSummary();
    mockUseAppBootstrap.mockReturnValue(createLoadingState(progress));

    render(<BootstrapApp />);

    expect(screen.getByRole('progressbar', { name: 'Loading data' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
    expect(screen.getByText('✅ 1')).toBeInTheDocument();
    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.queryByLabelText('Load log')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bootstrap-progress-log-viewer')).not.toBeInTheDocument();
  });

  it('renders the progress log viewer while bootstrap hold mode is enabled', () => {
    mockGetBootstrapParam.mockReturnValue('hold');
    const progress = createProgressSummary();
    mockUseAppBootstrap.mockReturnValue(createLoadingState(progress));

    render(<BootstrapApp />);

    expect(screen.getByTestId('bootstrap-progress-log-viewer')).toBeInTheDocument();
    expect(screen.getByLabelText('Load log')).toBeInTheDocument();
    expect(screen.getByText(/succeeded data alpha\/data\.json/)).toBeInTheDocument();
  });

  it('lists loading failures in the notice area before ready', () => {
    const progress = createFailedProgressSummary();
    mockUseAppBootstrap.mockReturnValue(createLoadingState(progress));

    render(<BootstrapApp />);

    expect(screen.getByLabelText('Data load issues')).toBeInTheDocument();
    expect(screen.getByText('✅ 1 ⚠️ 1')).toBeInTheDocument();
    expect(screen.getAllByText('x13103b')).toHaveLength(2);
    expect(screen.getByText('http-error: Not Found')).toBeInTheDocument();
  });

  it('mounts the app automatically when ready and reduced motion is enabled', () => {
    stubReducedMotion();
    const repository = {} as TransitRepository;
    const loadResult = { loaded: ['alpha'], failed: [] };
    mockUseAppBootstrap.mockReturnValue({
      status: 'ready',
      repository,
      loadResult,
      progress: null,
      logs: [],
    });

    render(<BootstrapApp />);

    expect(mockTransitRepositoryProvider).toHaveBeenCalledWith(repository);
    expect(mockSourceLoadStateProvider).toHaveBeenCalledWith({
      initialLoadResult: loadResult,
      sourcesParam: 'alpha,beta',
    });
    expect(screen.getByText('app-mounted')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show app' })).not.toBeInTheDocument();
  });

  it('lists startup load failures in the notice area before showing the app', () => {
    const repository = {} as TransitRepository;
    mockUseAppBootstrap.mockReturnValue({
      status: 'ready',
      repository,
      loadResult: {
        loaded: ['alpha'],
        failed: [{ prefix: 'x13103b', error: new Error('Not Found') }],
      },
      progress: null,
      logs: [],
    });

    render(<BootstrapApp />);

    expect(screen.getByLabelText('Data load issues')).toBeInTheDocument();
    expect(screen.getByText('x13103b')).toBeInTheDocument();
    expect(screen.getByText('Not Found')).toBeInTheDocument();
    expect(screen.queryByText('app-mounted')).not.toBeInTheDocument();
  });

  it('keeps optional load notices visible after bootstrap is ready', () => {
    const repository = {} as TransitRepository;
    const progress = createFailedProgressSummary();
    const dataFailureEvent = {
      type: 'failed',
      kind: 'data',
      path: 'x13103b/data.json',
      prefix: 'x13103b',
      optional: false,
      reason: 'http-error',
      message: 'Data Not Found',
    } as const;
    const insightsFailureEvent = {
      type: 'failed',
      kind: 'insights',
      path: 'x13103b/insights.json',
      prefix: 'x13103b',
      optional: true,
      reason: 'network-error',
      message: 'Insights unavailable',
    } as const;

    mockUseAppBootstrap.mockReturnValue({
      status: 'ready',
      repository,
      loadResult: {
        loaded: ['alpha'],
        failed: [{ prefix: 'x13103b', error: new Error('Not Found') }],
      },
      progress,
      logs: [
        createProgressLogWithEvent({ event: dataFailureEvent, id: 1, summary: progress }),
        createProgressLogWithEvent({ event: insightsFailureEvent, id: 2, summary: progress }),
      ],
    });

    render(<BootstrapApp />);

    expect(screen.getByLabelText('Data load issues')).toBeInTheDocument();
    expect(screen.getAllByText('x13103b')).toHaveLength(2);
    expect(screen.getByText('Not Found')).toBeInTheDocument();
    expect(screen.queryByText('http-error: Data Not Found')).not.toBeInTheDocument();
    expect(screen.getByText('network-error: Insights unavailable')).toBeInTheDocument();
  });

  it('keeps the ready boot shell visible when bootstrap hold mode is enabled', () => {
    stubReducedMotion();
    mockGetBootstrapParam.mockReturnValue('hold');
    const repository = {} as TransitRepository;
    const loadResult = { loaded: ['alpha'], failed: [] };
    mockUseAppBootstrap.mockReturnValue({
      status: 'ready',
      repository,
      loadResult,
      progress: null,
      logs: [],
    });

    render(<BootstrapApp />);

    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByLabelText('Tips')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show app' })).toBeInTheDocument();
    expect(screen.getByTestId('bootstrap-progress-log-viewer')).toBeInTheDocument();
    expect(screen.queryByText('app-mounted')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show app' }));

    expect(mockTransitRepositoryProvider).toHaveBeenCalledWith(repository);
    expect(mockSourceLoadStateProvider).toHaveBeenCalledWith({
      initialLoadResult: loadResult,
      sourcesParam: 'alpha,beta',
    });
    expect(screen.getByText('app-mounted')).toBeInTheDocument();
  });

  it('shows only completed counts in progress status after bootstrap is ready', () => {
    const repository = {} as TransitRepository;
    const progress = createCompletedProgressSummaryWithOptionalLastEvent();
    mockUseAppBootstrap.mockReturnValue({
      status: 'ready',
      repository,
      loadResult: {
        loaded: [],
        failed: [
          { prefix: 'x85b', error: new Error('Not Found') },
          { prefix: 'x13103b', error: new Error('Not Found') },
        ],
      },
      progress,
      logs: [createProgressLog(progress)],
    });

    render(<BootstrapApp />);

    expect(screen.getByText('✅ 0 ⚠️ 2')).toBeInTheDocument();
    expect(screen.queryByText('✅ 0 ⚠️ 2 - global insights')).not.toBeInTheDocument();
    expect(screen.queryByText('global insights')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/succeeded global-insights global\/insights\.json/),
    ).not.toBeInTheDocument();
  });

  it('shows a reload action when bootstrap fails', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    mockUseAppBootstrap.mockReturnValue({
      status: 'error',
      error: new Error('boot failed'),
      progress: null,
      logs: [],
    });

    render(<BootstrapApp />);

    expect(screen.getByText('Please reload the app and try again.')).toBeInTheDocument();
    expect(screen.getByLabelText('Tips')).toBeInTheDocument();
    expect(screen.queryByText('boot failed')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('shows collected progress content when bootstrap fails after progress events', () => {
    const reload = vi.fn();
    const progress = createFailedProgressSummary();
    vi.stubGlobal('location', { ...window.location, reload });
    mockUseAppBootstrap.mockReturnValue({
      status: 'error',
      error: new Error('boot failed'),
      progress,
      logs: [createProgressLog(progress)],
    });

    render(<BootstrapApp />);

    expect(screen.getByText('Please reload the app and try again.')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Loading data' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
    expect(screen.getByLabelText('Data load issues')).toBeInTheDocument();
    expect(screen.getByText('http-error: Not Found')).toBeInTheDocument();
    expect(screen.queryByLabelText('Load log')).not.toBeInTheDocument();
  });
});
