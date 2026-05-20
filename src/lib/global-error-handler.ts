import i18n from '../i18n';
import { formatErrorMessage } from './format-error-message';
import { createLogger } from './logger';

const logger = createLogger('GlobalErrorHandler');
const OVERLAY_ID = 'athenai-global-error-overlay';
const LABEL_FALLBACKS = {
  title: 'Unexpected error',
  message:
    'An error occurred while the app was running. Reload the app if the screen does not behave correctly.',
  detailLabel: 'Error details',
  reload: 'Reload',
  dismiss: 'Dismiss',
} as const;
const IGNORED_ERROR_PATTERNS = [
  /^ResizeObserver loop completed with undelivered notifications\.?$/,
  /^ResizeObserver loop limit exceeded\.?$/,
  /^Script error\.?$/,
] as const;

let uninstallCurrentHandlers: (() => void) | null = null;

function getLabel(key: string, fallback: string): string {
  try {
    const label = i18n.t(key);
    return label !== key ? label : fallback;
  } catch {
    return fallback;
  }
}

function shouldIgnoreGlobalError(error: unknown): boolean {
  const message = formatErrorMessage(error).trim();
  if (message.length === 0) {
    return true;
  }
  return IGNORED_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function createTextElement(documentRef: Document, tagName: string, text: string): HTMLElement {
  const element = documentRef.createElement(tagName);
  element.textContent = text;
  return element;
}

function applyOverlayStyles(overlay: HTMLElement): void {
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '2147483647';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.padding = '24px';
  overlay.style.background = 'rgba(15, 23, 42, 0.72)';
  overlay.style.color = '#0f172a';
}

function applyPanelStyles(panel: HTMLElement): void {
  panel.style.width = 'min(100%, 28rem)';
  panel.style.maxHeight = 'min(80vh, 40rem)';
  panel.style.overflowY = 'auto';
  panel.style.borderRadius = '8px';
  panel.style.border = '1px solid rgba(220, 38, 38, 0.28)';
  panel.style.background = '#ffffff';
  panel.style.padding = '20px';
  panel.style.boxShadow = '0 24px 80px rgba(15, 23, 42, 0.36)';
  panel.style.fontFamily =
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
}

function applyDetailStyles(detail: HTMLElement): void {
  detail.style.margin = '12px 0 0';
  detail.style.padding = '12px';
  detail.style.borderRadius = '6px';
  detail.style.background = '#fef2f2';
  detail.style.color = '#991b1b';
  detail.style.whiteSpace = 'pre-wrap';
  detail.style.overflowWrap = 'anywhere';
  detail.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  detail.style.fontSize = '12px';
  detail.style.lineHeight = '1.5';
}

function applyButtonStyles(button: HTMLButtonElement, variant: 'primary' | 'secondary'): void {
  button.style.width = '100%';
  button.style.minHeight = '36px';
  button.style.borderRadius = '6px';
  button.style.padding = '8px 12px';
  button.style.fontSize = '14px';
  button.style.fontWeight = '600';
  button.style.cursor = 'pointer';
  if (variant === 'primary') {
    button.style.border = '1px solid #dc2626';
    button.style.background = '#dc2626';
    button.style.color = '#ffffff';
  } else {
    button.style.border = '1px solid #cbd5e1';
    button.style.background = '#ffffff';
    button.style.color = '#0f172a';
  }
}

function showGlobalErrorOverlay(error: unknown): void {
  if (typeof document === 'undefined') {
    return;
  }

  const host = document.body ?? document.documentElement;
  if (host === null) {
    return;
  }

  document.getElementById(OVERLAY_ID)?.remove();
  const previousActiveElement = document.activeElement;

  function removeOverlay(): void {
    overlay.remove();
    if (previousActiveElement instanceof HTMLElement && previousActiveElement.isConnected) {
      previousActiveElement.focus();
    }
  }

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', `${OVERLAY_ID}-title`);
  overlay.setAttribute('aria-describedby', `${OVERLAY_ID}-message`);
  applyOverlayStyles(overlay);

  const panel = document.createElement('section');
  applyPanelStyles(panel);

  const title = createTextElement(
    document,
    'h1',
    getLabel('globalError.title', LABEL_FALLBACKS.title),
  );
  title.id = `${OVERLAY_ID}-title`;
  title.style.margin = '0';
  title.style.fontSize = '18px';
  title.style.lineHeight = '1.4';
  title.style.fontWeight = '700';

  const message = createTextElement(
    document,
    'p',
    getLabel('globalError.message', LABEL_FALLBACKS.message),
  );
  message.id = `${OVERLAY_ID}-message`;
  message.style.margin = '8px 0 0';
  message.style.color = '#475569';
  message.style.fontSize = '14px';
  message.style.lineHeight = '1.7';

  const detailLabel = createTextElement(
    document,
    'p',
    getLabel('globalError.detailLabel', LABEL_FALLBACKS.detailLabel),
  );
  detailLabel.style.margin = '16px 0 0';
  detailLabel.style.fontSize = '13px';
  detailLabel.style.fontWeight = '700';

  const detail = createTextElement(document, 'pre', formatErrorMessage(error));
  applyDetailStyles(detail);

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.flexDirection = 'column';
  actions.style.gap = '8px';
  actions.style.marginTop = '16px';

  const reloadButton = document.createElement('button');
  reloadButton.type = 'button';
  reloadButton.textContent = getLabel('globalError.action.reload', LABEL_FALLBACKS.reload);
  applyButtonStyles(reloadButton, 'primary');
  reloadButton.addEventListener('click', () => window.location.reload());

  const dismissButton = document.createElement('button');
  dismissButton.type = 'button';
  dismissButton.textContent = getLabel('globalError.action.dismiss', LABEL_FALLBACKS.dismiss);
  applyButtonStyles(dismissButton, 'secondary');
  dismissButton.addEventListener('click', removeOverlay);

  actions.append(reloadButton, dismissButton);
  panel.append(title, message, detailLabel, detail, actions);
  overlay.append(panel);
  host.append(overlay);
  reloadButton.focus();
}

function handleErrorEvent(event: ErrorEvent): void {
  const error: unknown = event.error ?? event.message;
  if (shouldIgnoreGlobalError(error)) {
    logger.debug('ignored uncaught error', error);
    return;
  }
  logger.error('uncaught error', error);
  showGlobalErrorOverlay(error);
}

function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  const reason: unknown = event.reason;
  if (shouldIgnoreGlobalError(reason)) {
    logger.debug('ignored unhandled rejection', reason);
    return;
  }
  logger.error('unhandled rejection', reason);
  showGlobalErrorOverlay(reason);
}

export function installGlobalErrorHandlers(): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  if (uninstallCurrentHandlers !== null) {
    return uninstallCurrentHandlers;
  }

  window.addEventListener('error', handleErrorEvent);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  uninstallCurrentHandlers = () => {
    window.removeEventListener('error', handleErrorEvent);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    uninstallCurrentHandlers = null;
  };

  return uninstallCurrentHandlers;
}
