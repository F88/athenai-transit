import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_TITLE } from '../config/app-meta';
import { recoverFromCacheCorruption } from '../lib/cache-recovery';
import { formatErrorDetails } from '../lib/format-error-message';
import { createLogger } from '../lib/logger';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';

const logger = createLogger('ErrorBoundary');

type ErrorBoundaryFallbackViewProps = {
  appTitle: string;
  title: string;
  message: string;
  detailLabel: string;
  errorText: string;
  clearCacheLabel: string;
  reloadLabel: string;
  isRecovering: boolean;
  onClearCache: () => void;
  onReload: () => void;
};

/**
 * Presentational error screen. Holds no i18n or state so it can be rendered
 * directly in Storybook with explicit text for each language.
 */
function ErrorBoundaryFallbackView({
  appTitle,
  title,
  message,
  detailLabel,
  errorText,
  clearCacheLabel,
  reloadLabel,
  isRecovering,
  onClearCache,
  onReload,
}: ErrorBoundaryFallbackViewProps) {
  return (
    <div className="bg-background text-foreground flex h-full flex-col">
      {/* pt-24 clears the iOS black-translucent status bar, under which the PWA content extends. */}
      <div className="mx-auto flex h-full w-full max-w-md flex-col px-4 pt-24 pb-8">
        {/* appTitle stays fixed; the heading, message and error detail scroll
            so the actions below stay visible on small screens. */}
        <p className="font-press-start text-muted-foreground shrink-0 pb-6 text-center text-xl font-medium tracking-wide uppercase">
          {appTitle}
        </p>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
          <div className="flex shrink-0 flex-col items-center gap-6 text-center">
            <p className="text-foreground text-base font-medium">{title}</p>
            <p className="text-muted-foreground text-sm leading-6">{message}</p>
          </div>

          <Alert variant="destructive">
            <AlertTitle>{detailLabel}</AlertTitle>
            <AlertDescription>
              <p className="font-mono text-xs wrap-break-word whitespace-pre-wrap">{errorText}</p>
            </AlertDescription>
          </Alert>
        </div>

        <div className="flex shrink-0 flex-col gap-2 pt-5 sm:flex-row sm:justify-center">
          <Button
            variant="destructive"
            size="sm"
            className="w-full sm:w-auto"
            disabled={isRecovering}
            onClick={onClearCache}
          >
            {clearCacheLabel}
          </Button>
          <Button variant="default" size="sm" className="w-full sm:w-auto" onClick={onReload}>
            {reloadLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Smart wrapper around {@link ErrorBoundaryFallbackView}: resolves localized
 * text, owns the "recovering" state, and wires the recovery / reload actions.
 */
function ErrorBoundaryFallback({ error }: { error: unknown }) {
  const { t } = useTranslation();
  const [isRecovering, setIsRecovering] = useState(false);

  const handleClearCache = (): void => {
    setIsRecovering(true);
    void recoverFromCacheCorruption();
  };

  const handleReload = (): void => {
    window.location.reload();
  };

  return (
    <ErrorBoundaryFallbackView
      appTitle={APP_TITLE}
      title={t('errorBoundary.title')}
      message={t('errorBoundary.message')}
      detailLabel={t('errorBoundary.detailLabel')}
      errorText={formatErrorDetails(error)}
      clearCacheLabel={t('errorBoundary.action.clearCacheAndReload')}
      reloadLabel={t('errorBoundary.action.reload')}
      isRecovering={isRecovering}
      onClearCache={handleClearCache}
      onReload={handleReload}
    />
  );
}

type RootErrorBoundaryProps = {
  children: ReactNode;
};

type RootErrorBoundaryState = {
  hasError: boolean;
  error: unknown;
};

/**
 * Top-level error boundary around the repository-backed app tree.
 *
 * Catches errors thrown while rendering the app (e.g. a `TypeError` from
 * reading a field that a stale cached data bundle lacks) and shows a readable
 * recovery screen instead of a blank page.
 *
 * `hasError` is tracked independently of `error` so a falsy thrown value
 * (`throw null`, `throw ''`) still triggers the fallback.
 */
class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: unknown): RootErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo): void {
    logger.error('render error caught', error, errorInfo.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <ErrorBoundaryFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

export { RootErrorBoundary, ErrorBoundaryFallbackView };
