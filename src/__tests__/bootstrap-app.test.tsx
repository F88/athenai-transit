import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BootstrapApp from '../bootstrap-app';
import type { AppBootstrapState } from '../hooks/use-app-bootstrap';
import type { TransitRepository } from '../repositories/transit-repository';

const mockUseAppBootstrap = vi.hoisted(() => vi.fn<() => AppBootstrapState>());
const mockTransitRepositoryProvider = vi.hoisted(() => vi.fn());
const mockSourceLoadStateProvider = vi.hoisted(() => vi.fn());

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
  getSourcesParam: () => 'alpha,beta',
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        'bootstrap.loading.title': 'Preparing app',
        'bootstrap.loading.detail': 'This will only take a moment.',
        'bootstrap.error.title': 'Could not start Athenai',
        'bootstrap.error.reload': 'Reload',
      };
      return labels[key] ?? key;
    },
  }),
}));

describe('BootstrapApp', () => {
  beforeEach(() => {
    mockUseAppBootstrap.mockReset();
    mockTransitRepositoryProvider.mockReset();
    mockSourceLoadStateProvider.mockReset();
  });

  it('renders the boot shell while the repository is loading', () => {
    mockUseAppBootstrap.mockReturnValue({ status: 'loading' });

    render(<BootstrapApp />);

    expect(screen.getByText('Preparing app')).toBeInTheDocument();
    expect(screen.queryByText('app-mounted')).not.toBeInTheDocument();
  });

  it('mounts the app once bootstrap completes', () => {
    const repository = {} as TransitRepository;
    const loadResult = { loaded: ['alpha'], failed: [] };
    mockUseAppBootstrap.mockReturnValue({
      status: 'ready',
      repository,
      loadResult,
    });

    render(<BootstrapApp />);

    expect(mockTransitRepositoryProvider).toHaveBeenCalledWith(repository);
    expect(mockSourceLoadStateProvider).toHaveBeenCalledWith({
      initialLoadResult: loadResult,
      sourcesParam: 'alpha,beta',
    });
    expect(screen.getByText('app-mounted')).toBeInTheDocument();
  });

  it('shows a reload action when bootstrap fails', () => {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload },
    });
    mockUseAppBootstrap.mockReturnValue({
      status: 'error',
      error: new Error('boot failed'),
    });

    render(<BootstrapApp />);

    expect(screen.getByText('Could not start Athenai')).toBeInTheDocument();
    expect(screen.getByText('boot failed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
