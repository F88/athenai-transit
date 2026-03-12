import { createLogger } from '../utils/logger';
import { DOUBLE_TAP_WINDOW_MS, isDoubleTap } from '../utils/map-click';

const logger = createLogger('DoubleTapDetector');

/** Minimum movement (px) from 2nd tap start to trigger a slide instead of a plain double-tap. */
const SLIDE_START_THRESHOLD_PX = 5;

/** Callbacks invoked when a double-tap gesture is detected. */
export interface DoubleTapCallbacks {
  /** 2nd tap held + move — slide gesture has started. */
  onSlideStart: (touch: Touch) => void;
  /** 2nd tap released without significant movement — tap zoom. */
  onDoubleTap: (touch: Touch) => void;
}

export interface DoubleTapDetectorOptions {
  /** Container element to attach listeners to. */
  container: HTMLElement;
  /** Callbacks for gesture events. */
  callbacks: DoubleTapCallbacks;
}

/**
 * Attaches double-tap detection to a container element.
 *
 * Handles click deferral to avoid the first tap's click firing
 * before the second tap arrives. When a double-tap is detected,
 * either {@link DoubleTapCallbacks.onSlideStart} (if the finger
 * moves) or {@link DoubleTapCallbacks.onDoubleTap} (if released
 * without significant movement) is called.
 *
 * @param options - Detector configuration.
 * @returns Cleanup function to remove all listeners.
 */
export function createDoubleTapDetector(options: DoubleTapDetectorOptions): () => void {
  const { container, callbacks } = options;

  /** Timestamp of the first tap's touchend. */
  let firstTapEndTime = 0;
  /** Screen position of the first tap. */
  let firstTapPos = { x: 0, y: 0 };
  /** Whether a double-tap second touch is currently active. */
  let secondTapActive = false;
  /** Pending click timer — cancelled if a double-tap is detected. */
  let pendingClickTimer: ReturnType<typeof setTimeout> | null = null;
  /** Flag to let re-dispatched clicks pass through without interception. */
  let allowNextClick = false;
  /**
   * Suppress the next click unconditionally. Set when a double-tap
   * gesture ends (touchend), because the synthetic click from the
   * 2nd tap fires *after* secondTapActive is cleared.
   */
  let suppressNextClick = false;
  /** Whether onSlideStart has been called for the current gesture. */
  let slideStarted = false;
  /** Screen position of the 2nd tap start, for jitter threshold. */
  let secondTapStartPos = { x: 0, y: 0 };

  // -- Click deferral --------------------------------------------------

  /**
   * Intercepts click events in the capture phase. After a single tap we
   * hold the click for DOUBLE_TAP_WINDOW_MS; if no second tap arrives
   * the click is re-dispatched so Leaflet / React sees it normally.
   */
  function onClickCapture(e: MouseEvent) {
    // Let re-dispatched clicks pass through
    if (allowNextClick) {
      allowNextClick = false;
      return;
    }

    // During or right after a double-tap gesture — swallow the click entirely
    if (secondTapActive || suppressNextClick) {
      suppressNextClick = false;
      e.stopPropagation();
      return;
    }

    // Defer the click to allow time for a potential second tap
    e.stopPropagation();
    const target = e.target as HTMLElement;

    cancelPendingClick();
    pendingClickTimer = setTimeout(() => {
      pendingClickTimer = null;
      allowNextClick = true;
      // Re-dispatch the click so Leaflet / React handles it normally
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      logger.verbose('deferred click dispatched');
    }, DOUBLE_TAP_WINDOW_MS);

    logger.verbose('click deferred');
  }

  function cancelPendingClick() {
    if (pendingClickTimer !== null) {
      clearTimeout(pendingClickTimer);
      pendingClickTimer = null;
      logger.verbose('deferred click cancelled');
    }
  }

  // -- Touch gesture ---------------------------------------------------

  function onTouchStart(e: TouchEvent) {
    // Only handle single-finger gestures
    if (e.touches.length !== 1) {
      resetState();
      return;
    }

    const touch = e.touches[0];
    const now = Date.now();
    const elapsed = now - firstTapEndTime;
    const dx = touch.clientX - firstTapPos.x;
    const dy = touch.clientY - firstTapPos.y;
    const drift = Math.sqrt(dx * dx + dy * dy);

    if (isDoubleTap(elapsed, drift)) {
      // Second tap detected — cancel any deferred click
      cancelPendingClick();
      secondTapActive = true;
      slideStarted = false;
      secondTapStartPos = { x: touch.clientX, y: touch.clientY };
      logger.verbose('double-tap detected');
    }
  }

  function onTouchMove(e: TouchEvent) {
    if (!secondTapActive || e.touches.length !== 1) {
      return;
    }

    // Ignore jitter — require movement beyond threshold before starting slide.
    // Without this, tiny finger movements would start a slide instead of
    // firing onDoubleTap on release.
    if (!slideStarted) {
      const touch = e.touches[0];
      const dx = touch.clientX - secondTapStartPos.x;
      const dy = touch.clientY - secondTapStartPos.y;
      const moved = Math.sqrt(dx * dx + dy * dy);
      if (moved < SLIDE_START_THRESHOLD_PX) {
        return;
      }

      slideStarted = true;
      callbacks.onSlideStart(touch);
    }
  }

  function onTouchEnd(e: TouchEvent) {
    if (secondTapActive) {
      if (!slideStarted && e.changedTouches.length === 1) {
        // Released without sliding — this is a plain double-tap
        callbacks.onDoubleTap(e.changedTouches[0]);
        logger.verbose('double-tap (no slide) detected');
      }
      secondTapActive = false;
      slideStarted = false;
      // The synthetic click from the 2nd tap fires after this handler,
      // so we must suppress it unconditionally.
      suppressNextClick = true;
      resetState();
      return;
    }

    // Record this tap as a potential first tap of a double-tap
    if (e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      firstTapEndTime = Date.now();
      firstTapPos = { x: touch.clientX, y: touch.clientY };
    }
  }

  function resetState() {
    firstTapEndTime = 0;
    firstTapPos = { x: 0, y: 0 };
  }

  // Capture phase for click so we intercept before Leaflet / React
  container.addEventListener('click', onClickCapture, true);
  container.addEventListener('touchstart', onTouchStart, { passive: true });
  container.addEventListener('touchmove', onTouchMove, { passive: true });
  container.addEventListener('touchend', onTouchEnd, { passive: true });
  container.addEventListener('touchcancel', onTouchEnd, { passive: true });

  return () => {
    cancelPendingClick();
    container.removeEventListener('click', onClickCapture, true);
    container.removeEventListener('touchstart', onTouchStart);
    container.removeEventListener('touchmove', onTouchMove);
    container.removeEventListener('touchend', onTouchEnd);
    container.removeEventListener('touchcancel', onTouchEnd);
    logger.verbose('double-tap detector destroyed');
  };
}
