import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoadResult } from '../../repositories/athenai-repository';
import type { TransitRepository } from '../../repositories/transit-repository';

type SetupOptions = {
  repoParam?: string | null;
  sourcesParam?: string | null;
  diagParam?: string | null;
  prefixes?: string[];
  createResult?: { repository: TransitRepository; loadResult: LoadResult };
  createError?: Error;
  diagnosticsError?: Error;
};

async function setupUseAppBootstrap(options: SetupOptions = {}) {
  const repository = options.createResult?.repository ?? ({} as TransitRepository);
  const loadResult = options.createResult?.loadResult ?? { loaded: ['alpha'], failed: [] };
  const mockRepository = { mock: true } as unknown as TransitRepository;

  const create = vi.fn(() => {
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
    runDiagnostics,
    useAppBootstrap,
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
    expect(first.result.current).toEqual({ status: 'ready', repository, loadResult });
    expect(second.result.current).toEqual({ status: 'ready', repository, loadResult });
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
    expect(result.current).toEqual({ status: 'error', error: createError });
  });
});
