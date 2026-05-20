import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import { installGlobalErrorHandlers } from '../global-error-handler';

const OVERLAY_ID = 'athenai-global-error-overlay';

function createUnhandledRejectionEvent(reason: unknown): PromiseRejectionEvent {
  const event = new Event('unhandledrejection') as PromiseRejectionEvent;
  Object.defineProperty(event, 'reason', { value: reason });
  return event;
}

describe('installGlobalErrorHandlers', () => {
  let uninstall: () => void;

  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    document.body.innerHTML = '';
    uninstall = installGlobalErrorHandlers();
  });

  afterEach(() => {
    uninstall();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('shows a DOM overlay for uncaught window errors', () => {
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('render failed') }));

    const overlay = document.getElementById(OVERLAY_ID);
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveAttribute('role', 'alertdialog');
    expect(overlay).toHaveTextContent('Unexpected error');
    expect(overlay).toHaveTextContent('render failed');
  });

  it('shows a DOM overlay for unhandled promise rejections', () => {
    window.dispatchEvent(createUnhandledRejectionEvent('async failed'));

    const overlay = document.getElementById(OVERLAY_ID);
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveTextContent('Unexpected error');
    expect(overlay).toHaveTextContent('async failed');
  });

  it('replaces the existing overlay with the latest error', () => {
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('first') }));
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('second') }));

    const overlays = document.querySelectorAll(`#${OVERLAY_ID}`);
    expect(overlays).toHaveLength(1);
    expect(overlays[0]).toHaveTextContent('second');
    expect(overlays[0]).not.toHaveTextContent('first');
  });

  it('wires reload and dismiss actions', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('action failed') }));

    document.querySelector<HTMLButtonElement>('#athenai-global-error-overlay button')?.click();
    expect(reload).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new ErrorEvent('error', { error: new Error('dismiss failed') }));
    const buttons = document.querySelectorAll<HTMLButtonElement>(
      '#athenai-global-error-overlay button',
    );
    buttons[1]?.click();

    expect(document.getElementById(OVERLAY_ID)).not.toBeInTheDocument();
  });

  it('does not register duplicate handlers', () => {
    const sameUninstall = installGlobalErrorHandlers();
    expect(sameUninstall).toBe(uninstall);

    window.dispatchEvent(new ErrorEvent('error', { error: new Error('single') }));

    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('falls back to fixed English labels when translation lookup fails', () => {
    vi.spyOn(i18n, 't').mockImplementation(() => {
      throw new Error('i18n failed');
    });

    window.dispatchEvent(new ErrorEvent('error', { error: new Error('fallback failed') }));

    const overlay = document.getElementById(OVERLAY_ID);
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveTextContent('Unexpected error');
    expect(overlay).toHaveTextContent('Reload');
    expect(overlay).toHaveTextContent('Dismiss');
    expect(overlay).toHaveTextContent('fallback failed');
  });

  it.each([
    'ResizeObserver loop completed with undelivered notifications.',
    'ResizeObserver loop limit exceeded',
    'Script error.',
    '   ',
  ])('ignores known noisy window errors: %s', (message) => {
    window.dispatchEvent(new ErrorEvent('error', { message }));

    expect(document.getElementById(OVERLAY_ID)).not.toBeInTheDocument();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('ignores known noisy unhandled rejections', () => {
    window.dispatchEvent(
      createUnhandledRejectionEvent(new Error('ResizeObserver loop limit exceeded.')),
    );

    expect(document.getElementById(OVERLAY_ID)).not.toBeInTheDocument();
    expect(console.error).not.toHaveBeenCalled();
  });
});
