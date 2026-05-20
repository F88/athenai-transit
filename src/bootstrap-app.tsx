import { useEffect, useState, type ReactNode, type TransitionEvent } from 'react';
import { useTranslation } from 'react-i18next';
import App from './app';
import { Button } from './components/ui/button';
import { Progress } from './components/ui/progress';
import { SourceLoadStateProvider } from './contexts/source-load-state-provider';
import { TransitRepositoryProvider } from './contexts/transit-repository-provider';
import {
  useAppBootstrap,
  type AppBootstrapState,
  type BootstrapProgressLogEntry,
} from './hooks/use-app-bootstrap';
import { getBootstrapParam, getSourcesParam } from './lib/query-params';
import { cn } from './lib/utils';

type AppBootstrapLoadingState = Extract<AppBootstrapState, { status: 'loading' }>;
type AppBootstrapReadyState = Extract<AppBootstrapState, { status: 'ready' }>;
type AppBootShellState = 'loading' | 'ready' | 'error';
type NoticeItem = {
  id: string;
  label: string;
  message: string;
};

const APP_TITLE = 'Athenai Transit';

function shouldReduceMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function getProgressValue(progress: AppBootstrapLoadingState['progress']): number {
  return Math.round((progress?.boot.progressRatio ?? 0) * 100);
}

function formatProgressEvent(event: BootstrapProgressLogEntry['event']): string | null {
  if (event === null) {
    return null;
  }
  return `${event.type} ${event.kind} ${event.path}`;
}

function formatProgressTask(event: BootstrapProgressLogEntry['event']): string | null {
  if (event === null) {
    return null;
  }

  switch (event.kind) {
    case 'data':
      return event.prefix ?? event.path;
    case 'data-source-catalog':
      return 'data source catalog';
    case 'global-insights':
      return 'global insights';
    case 'insights':
      return event.prefix === null ? 'insights' : `${event.prefix} insights`;
    case 'shapes':
      return event.prefix === null ? 'shapes' : `${event.prefix} shapes`;
    case 'unknown':
      return event.path;
  }
}

function ProgressCounts({ progress }: { progress: AppBootstrapLoadingState['progress'] }) {
  if (progress === null) {
    return null;
  }

  const failedText = progress.boot.failedSources > 0 ? ` ⚠️ ${progress.boot.failedSources}` : '';

  return (
    <p
      aria-live="polite"
      className="text-muted-foreground text-center text-sm font-medium tabular-nums"
    >
      ✅ {progress.boot.completedSources}
      {failedText}
    </p>
  );
}

function CurrentProgressTask({
  progress,
  showCurrentTask,
}: {
  progress: AppBootstrapLoadingState['progress'];
  showCurrentTask: boolean;
}) {
  if (!showCurrentTask || progress === null) {
    return null;
  }

  const taskLabel = formatProgressTask(
    progress.activity.lastEvent ?? progress.boot.lastRequiredEvent,
  );

  if (taskLabel === null) {
    return null;
  }

  return <p className="text-muted-foreground truncate text-center text-xs">{taskLabel}</p>;
}

type ProgressLogViewerProps = {
  logs: BootstrapProgressLogEntry[];
  title: string;
};

function ProgressLogViewer({ logs, title }: ProgressLogViewerProps) {
  return (
    <div
      className="border-border/70 bg-muted/30 flex min-h-0 flex-1 flex-col rounded-md border text-xs"
      data-testid="bootstrap-progress-log-viewer"
    >
      <div className="text-muted-foreground border-border/70 border-b px-3 py-2 font-medium">
        {title}
      </div>
      <div aria-label={title} className="min-h-0 overflow-y-auto px-3 py-2">
        <ol className="flex flex-col gap-1">
          {logs.map((log) => {
            const processedSources =
              log.summary.boot.completedSources + log.summary.boot.failedSources;
            const eventLabel = formatProgressEvent(log.event) ?? 'progress updated';
            return (
              <li className="text-muted-foreground font-mono text-[11px] leading-4" key={log.id}>
                {eventLabel} · {processedSources}/{log.summary.boot.totalSources}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function BootstrapUserTips() {
  const { t } = useTranslation();
  const title = 'Tips';
  const items = [
    { icon: '⚙️', text: t('bootstrap.tips.dataSources') },
    { icon: '📍', text: t('bootstrap.tips.selection') },
    { icon: '📱', text: t('bootstrap.tips.performance') },
  ];

  return (
    <section
      aria-label={title}
      className="border-border/70 bg-muted/80 text-muted-foreground w-full rounded-md border px-2.5 py-2 text-left text-[11px] leading-4"
    >
      <p className="text-foreground/80 flex items-center gap-1 text-xs leading-4 font-medium">
        <span aria-hidden="true" className="text-xs leading-none">
          💡
        </span>
        <span>{title}</span>
      </p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {items.map((item) => (
          <li className="grid grid-cols-[1rem_1fr] gap-1.5" key={item.icon}>
            <span aria-hidden="true" className="text-center leading-4">
              {item.icon}
            </span>
            <span className="min-w-0">{item.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

type NoticeAreaProps = {
  items: NoticeItem[];
  title: string;
};

function NoticeArea({ items, title }: NoticeAreaProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section
      aria-label={title}
      className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border text-xs"
    >
      <div className="border-destructive/30 border-b px-3 py-2 font-medium">{title}</div>
      <ol className="max-h-32 overflow-y-auto px-3 py-2">
        {items.map((item) => (
          <li className="flex gap-2 py-1" key={item.id}>
            <span className="font-mono">{item.label}</span>
            <span className="min-w-0 flex-1 wrap-break-word text-current/80">{item.message}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function getNoticeKeyForLogEntry(log: BootstrapProgressLogEntry): string | null {
  const event = log.event;
  if (event === null || (event.type !== 'failed' && event.type !== 'skipped')) {
    return null;
  }
  if (event.kind === 'data' && event.prefix !== null) {
    return `source-data:${event.prefix}`;
  }
  return `log:${event.path}`;
}

function createNoticeItems({
  failures,
  logs,
}: {
  failures?: AppBootstrapReadyState['loadResult']['failed'];
  logs: BootstrapProgressLogEntry[];
}): NoticeItem[] {
  const items: NoticeItem[] = [];
  const seenKeys = new Set<string>();

  if (failures !== undefined) {
    for (const failure of failures) {
      seenKeys.add(`source-data:${failure.prefix}`);
      items.push({
        id: `source-${failure.prefix}`,
        label: failure.prefix,
        message: failure.error.message,
      });
    }
  }

  for (const log of logs) {
    const key = getNoticeKeyForLogEntry(log);
    if (key === null || seenKeys.has(key)) {
      continue;
    }

    const event = log.event;
    if (event === null || (event.type !== 'failed' && event.type !== 'skipped')) {
      continue;
    }

    seenKeys.add(key);
    items.push({
      id: `log-${log.id}`,
      label: event.prefix ?? event.path,
      message: `${event.reason}: ${event.message}`,
    });
  }

  return items;
}

type BootstrapProgressContentProps = {
  progress: AppBootstrapLoadingState['progress'];
  logs: BootstrapProgressLogEntry[];
  loadFailures?: AppBootstrapReadyState['loadResult']['failed'];
  showCurrentTask: boolean;
  showProgressLogViewer: boolean;
};

function BootstrapProgressContent({
  progress,
  logs,
  loadFailures,
  showCurrentTask,
  showProgressLogViewer,
}: BootstrapProgressContentProps) {
  const { t } = useTranslation();
  const noticeItems = createNoticeItems({ failures: loadFailures, logs });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 pt-2">
      <div className="flex flex-col gap-4">
        <Progress
          aria-label={t('bootstrap.loading.progressLabel')}
          value={getProgressValue(progress)}
          className="h-2"
        />
        <ProgressCounts progress={progress} />
        <CurrentProgressTask progress={progress} showCurrentTask={showCurrentTask} />
      </div>
      <NoticeArea items={noticeItems} title={t('bootstrap.notice.loadFailuresTitle')} />
      {showProgressLogViewer ? (
        <ProgressLogViewer logs={logs} title={t('bootstrap.logViewer.title')} />
      ) : null}
    </div>
  );
}

type AppBootShellProps = {
  title: string;
  state: AppBootShellState;
  message?: string;
  tips?: ReactNode;
  action?: ReactNode;
  exiting?: boolean;
  onTransitionEnd?: (event: TransitionEvent<HTMLDivElement>) => void;
  progressContent?: ReactNode;
};

type BootstrapShellViewProps = {
  bootstrap: AppBootstrapState;
  exiting?: boolean;
  holdReady?: boolean;
  showProgressLogViewer?: boolean;
  onShowApp?: () => void;
  onExited?: () => void;
};

type RepositoryBackedAppProps = {
  readyState: AppBootstrapReadyState;
};

/**
 * Minimal boot-time shell shown before the transit repository is available.
 *
 * This component intentionally does not depend on repository context, so React
 * can mount while asynchronous repository boot is still in progress.
 */
function AppBootShell({
  title,
  state: _state,
  message,
  tips,
  action,
  exiting = false,
  onTransitionEnd,
  progressContent,
}: AppBootShellProps) {
  return (
    <div
      className={cn(
        'bg-background text-foreground flex h-full flex-col transition-opacity duration-200 ease-out motion-reduce:transition-none',
        exiting ? 'opacity-0' : 'opacity-100',
      )}
      onTransitionEnd={onTransitionEnd}
    >
      <div className="mx-auto flex h-full w-full max-w-md flex-col px-5 pt-16 pb-8">
        <div className="flex shrink-0 flex-col items-center gap-4 pb-5 text-center">
          <p className="text-muted-foreground text-base font-medium tracking-wide uppercase">
            {title}
          </p>
          <p className="text-muted-foreground text-sm leading-6">{message}</p>
          {tips}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4">{progressContent}</div>

        {action === undefined ? null : (
          <div className="flex shrink-0 justify-center pt-5">{action}</div>
        )}
      </div>
    </div>
  );
}

function hasProgressContent(
  progress: AppBootstrapLoadingState['progress'],
  logs: BootstrapProgressLogEntry[],
): boolean {
  return progress !== null || logs.length > 0;
}

function BootstrapShellView({
  bootstrap,
  exiting = false,
  holdReady = false,
  showProgressLogViewer = false,
  onExited,
  onShowApp,
}: BootstrapShellViewProps) {
  const { t } = useTranslation();
  const tips = <BootstrapUserTips />;

  if (bootstrap.status === 'loading') {
    return (
      <AppBootShell
        title={APP_TITLE}
        state="loading"
        message={t('bootstrap.loading.message')}
        tips={tips}
        progressContent={
          <BootstrapProgressContent
            progress={bootstrap.progress}
            logs={bootstrap.logs}
            showCurrentTask
            showProgressLogViewer={showProgressLogViewer}
          />
        }
      />
    );
  }

  if (bootstrap.status === 'error') {
    const progressContent = hasProgressContent(bootstrap.progress, bootstrap.logs) ? (
      <BootstrapProgressContent
        progress={bootstrap.progress}
        logs={bootstrap.logs}
        showCurrentTask={false}
        showProgressLogViewer={showProgressLogViewer}
      />
    ) : undefined;

    return (
      <AppBootShell
        title={APP_TITLE}
        state="error"
        message={t('bootstrap.error.message')}
        tips={tips}
        progressContent={progressContent}
        action={
          <Button onClick={() => window.location.reload()} size="sm">
            {t('bootstrap.action.reload')}
          </Button>
        }
      />
    );
  }

  return (
    <AppBootShell
      title={APP_TITLE}
      state="ready"
      message={t('bootstrap.ready.message')}
      tips={tips}
      action={
        holdReady ? (
          <Button onClick={onShowApp} size="sm">
            {t('bootstrap.action.showApp')}
          </Button>
        ) : undefined
      }
      exiting={exiting}
      onTransitionEnd={(event) => {
        if (event.currentTarget === event.target) {
          onExited?.();
        }
      }}
      progressContent={
        <BootstrapProgressContent
          progress={bootstrap.progress}
          logs={bootstrap.logs}
          loadFailures={bootstrap.loadResult.failed}
          showCurrentTask={false}
          showProgressLogViewer={showProgressLogViewer}
        />
      }
    />
  );
}

function RepositoryBackedApp({ readyState }: RepositoryBackedAppProps) {
  return (
    <TransitRepositoryProvider repository={readyState.repository}>
      <SourceLoadStateProvider
        initialLoadResult={readyState.loadResult}
        sourcesParam={getSourcesParam()}
      >
        <App />
      </SourceLoadStateProvider>
    </TransitRepositoryProvider>
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
  const bootstrap = useAppBootstrap();
  const shouldHoldReadyShell = getBootstrapParam() === 'hold';
  const [hasRequestedAppDisplay, setHasRequestedAppDisplay] = useState(false);
  const [isBootShellExiting, setIsBootShellExiting] = useState(false);
  const [hasBootShellExited, setHasBootShellExited] = useState(false);
  const canStartReadyTransition =
    bootstrap.status === 'ready' && (!shouldHoldReadyShell || hasRequestedAppDisplay);

  useEffect(() => {
    if (!canStartReadyTransition || shouldReduceMotion()) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setIsBootShellExiting(true);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [canStartReadyTransition]);

  if (
    canStartReadyTransition &&
    bootstrap.status === 'ready' &&
    (hasBootShellExited || shouldReduceMotion())
  ) {
    return <RepositoryBackedApp readyState={bootstrap} />;
  }

  return (
    <BootstrapShellView
      bootstrap={bootstrap}
      exiting={bootstrap.status === 'ready' && isBootShellExiting}
      holdReady={bootstrap.status === 'ready' && shouldHoldReadyShell}
      showProgressLogViewer={shouldHoldReadyShell}
      onExited={() => setHasBootShellExited(true)}
      onShowApp={() => setHasRequestedAppDisplay(true)}
    />
  );
}
