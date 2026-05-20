import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import App from './app';
import { Button } from './components/ui/button';
import { SourceLoadStateProvider } from './contexts/source-load-state-provider';
import { TransitRepositoryProvider } from './contexts/transit-repository-provider';
import { useAppBootstrap } from './hooks/use-app-bootstrap';
import { getSourcesParam } from './lib/query-params';

/**
 * Minimal boot-time shell shown before the transit repository is available.
 *
 * This component intentionally does not depend on repository context, so React
 * can mount while asynchronous repository boot is still in progress.
 */
function AppBootShell({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="bg-background text-foreground flex h-full flex-col">
      <div className="bg-border/70 h-1 w-full">
        <div className="bg-primary/80 h-full w-1/3 animate-pulse" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-between px-5 py-6 sm:px-6 sm:py-7">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Athenai Transit
          </p>
          <h1 className="text-lg font-semibold">{title}</h1>
        </div>

        <div className="space-y-3">
          <p className="text-muted-foreground max-w-sm text-sm leading-6">{detail}</p>
          {action}
        </div>
      </div>
    </div>
  );
}

/**
 * Top-level bootstrap boundary between React mount and repository-backed app UI.
 *
 * Renders a repository-free shell while boot is loading, an error shell when
 * boot fails, and only mounts the existing app provider tree after the
 * repository and startup load result are ready.
 */
export default function BootstrapApp() {
  const { t } = useTranslation();
  const bootstrap = useAppBootstrap();

  if (bootstrap.status === 'loading') {
    return (
      <AppBootShell title={t('bootstrap.loading.title')} detail={t('bootstrap.loading.detail')} />
    );
  }

  if (bootstrap.status === 'error') {
    return (
      <AppBootShell
        title={t('bootstrap.error.title')}
        detail={t('bootstrap.error.detail')}
        action={
          <Button onClick={() => window.location.reload()} size="sm">
            {t('bootstrap.error.reload')}
          </Button>
        }
      />
    );
  }

  return (
    <TransitRepositoryProvider repository={bootstrap.repository}>
      <SourceLoadStateProvider
        initialLoadResult={bootstrap.loadResult}
        sourcesParam={getSourcesParam()}
      >
        <App />
      </SourceLoadStateProvider>
    </TransitRepositoryProvider>
  );
}
