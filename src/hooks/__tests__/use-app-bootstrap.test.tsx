import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  LoadResult,
  RepositoryLoadProgressSummary,
} from '../../repositories/athenai-repository';
import type { TransitRepository } from '../../repositories/transit-repository';

type SetupOptions = {
  repoParam?: string | null;
  sourcesParam?: string | null;
  diagParam?: string | null;
  prefixes?: string[];
  createResult?: { repository: TransitRepository; loadResult: LoadResult };
  createError?: Error;
  deferCreate?: boolean;
  diagnosticsError?: Error;
};

type RepositoryCreateMock = (
  prefixes: string[],
  dataSource: unknown,
  onLoadProgress?: (summary: RepositoryLoadProgressSummary) => void,
) => Promise<{ repository: TransitRepository; loadResult: LoadResult }>;

async function setupUseAppBootstrap(options: SetupOptions = {}) {
  const repository = options.createResult?.repository ?? ({} as TransitRepository);
  const loadResult = options.createResult?.loadResult ?? { loaded: ['alpha'], failed: [] };
  const mockRepository = { mock: true } as unknown as TransitRepository;
  let resolveCreatePromise: (() => void) | null = null;

  const create = vi.fn<RepositoryCreateMock>((_prefixes, _dataSource, _onLoadProgress) => {
    if (options.deferCreate) {
      return new Promise<{ repository: TransitRepository; loadResult: LoadResult }>(
        (resolve, reject) => {
          resolveCreatePromise = () => {
            if (options.createError) {
              reject(options.createError);
              return;
            }
            resolve({ repository, loadResult });
          };
        },
      );
    }
    if (options.createError) {
      return Promise.reject(options.createError);
    }
    return Promise.resolve({ repository, loadResult });
  });
  const runDiagnostics = vi.fn(() => {
    if (options.diagnosticsError) {
      return Promise.reject(options.diagnosticsError);
    }
    return Promise.resolve();
  });
  const MockRepository = vi.fn(function MockRepository() {
    return mockRepository;
  });

  vi.doMock('../../repositories/athenai-repository', () => ({
    AthenaiRepositoryV2: { create },
    formatBootLoadProgressSummary: () => 'boot summary',
    formatLoadActivitySummary: () => 'activity summary',
  }));
  vi.doMock('../../repositories/mock-repository', () => ({ MockRepository }));
  vi.doMock('../../config/data-source-manager', () => ({
    DataSourceManager: class DataSourceManager {
      getGroups() {
        return [];
      }

      getEnabledDataSources() {
        return [];
      }
    },
  }));
  vi.doMock('../../domain/datasource/data-source-selection-storage', () => ({
    loadEnabledGroupIdsFromStorage: () => new Set<string>(),
  }));
  vi.doMock('../../domain/datasource/resolve-fetch-data-sources', () => ({
    resolveFetchDataSources: () => options.prefixes ?? ['alpha'],
  }));
  vi.doMock('../../lib/query-params', () => ({
    getDiagParam: () => options.diagParam ?? null,
    getRepoParam: () => options.repoParam ?? null,
    getSourcesParam: () => options.sourcesParam ?? null,
  }));
  vi.doMock('../../diagnostics', () => ({ runDiagnostics }));

  const { useAppBootstrap } = await import('../use-app-bootstrap');
  return {
    create,
    loadResult,
    MockRepository,
    mockRepository,
    repository,
    resolveCreate: () => resolveCreatePromise?.(),
    runDiagnostics,
    useAppBootstrap,
  };
}

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

describe('useAppBootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('shares one repository boot across hook consumers', async () => {
    const { create, loadResult, repository, useAppBootstrap } = await setupUseAppBootstrap({
      prefixes: ['alpha', 'beta'],
      sourcesParam: 'alpha,beta',
    });

    const first = renderHook(() => useAppBootstrap());
    const second = renderHook(() => useAppBootstrap());

    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    await waitFor(() => expect(second.result.current.status).toBe('ready'));

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(['alpha', 'beta'], undefined, expect.any(Function));
    expect(first.result.current).toEqual({
      status: 'ready',
      repository,
      loadResult,
      progress: null,
      logs: [],
    });
    expect(second.result.current).toEqual({
      status: 'ready',
      repository,
      loadResult,
      progress: null,
      logs: [],
    });
  });

  it('updates loading state from repository progress events', async () => {
    const { create, resolveCreate, useAppBootstrap } = await setupUseAppBootstrap({
      deferCreate: true,
    });
    const progress = createProgressSummary();

    const { result } = renderHook(() => useAppBootstrap());

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    const onLoadProgress = create.mock.calls[0]?.[2];
    expect(onLoadProgress).toEqual(expect.any(Function));
    act(() => {
      onLoadProgress?.(progress);
    });

    await waitFor(() => expect(result.current.progress).toBe(progress));
    expect(result.current).toMatchObject({
      status: 'loading',
      progress,
      logs: [
        {
          event: progress.activity.lastEvent,
          summary: progress,
        },
      ],
    });

    resolveCreate();
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('uses MockRepository when ?repo=mock is selected', async () => {
    const { create, MockRepository, mockRepository, useAppBootstrap } = await setupUseAppBootstrap({
      repoParam: 'mock',
    });

    const { result } = renderHook(() => useAppBootstrap());

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(create).not.toHaveBeenCalled();
    expect(MockRepository).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({
      status: 'ready',
      repository: mockRepository,
      loadResult: { loaded: [], failed: [] },
      progress: null,
      logs: [],
    });
  });

  it('keeps the app booting when diagnostics fail', async () => {
    const diagnosticsError = new Error('diagnostics failed');
    const { repository, runDiagnostics, useAppBootstrap } = await setupUseAppBootstrap({
      diagParam: 'boot',
      diagnosticsError,
    });

    const { result } = renderHook(() => useAppBootstrap());

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(runDiagnostics).toHaveBeenCalledWith('boot', repository);
  });

  it('returns an error state when repository boot fails', async () => {
    const createError = new Error('repository failed');
    const { useAppBootstrap } = await setupUseAppBootstrap({ createError });

    const { result } = renderHook(() => useAppBootstrap());

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current).toEqual({
      status: 'error',
      error: createError,
      progress: null,
      logs: [],
    });
  });

  it('keeps the last progress snapshot when repository boot fails', async () => {
    const createError = new Error('repository failed');
    const { create, resolveCreate, useAppBootstrap } = await setupUseAppBootstrap({
      createError,
      deferCreate: true,
    });
    const progress = createProgressSummary();

    const { result } = renderHook(() => useAppBootstrap());

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    const onLoadProgress = create.mock.calls[0]?.[2];
    expect(onLoadProgress).toEqual(expect.any(Function));
    act(() => {
      onLoadProgress?.(progress);
    });

    await waitFor(() => expect(result.current.progress).toBe(progress));
    resolveCreate();

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current).toMatchObject({
      status: 'error',
      error: createError,
      progress,
      logs: [
        {
          event: progress.activity.lastEvent,
          summary: progress,
        },
      ],
    });
  });
});
