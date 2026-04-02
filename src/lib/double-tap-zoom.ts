import type L from 'leaflet';
import { createDoubleTapDetector } from './double-tap-detector';
import { createLogger } from '../utils/logger';
import { isDoubleTap, slideToZoom } from '../utils/double-tap';

const logger = createLogger('DoubleTapZoom');

export interface DoubleTapZoomOptions {
  /**
   * Double-tap-drag zoom direction (what dragging **up** does).
   *
   * - `'zoom-out'` — up = zoom out (Google Maps style, default)
   * - `'zoom-in'`  — up = zoom in (Apple Maps style)
   */
  doubleTapDrag?: 'zoom-in' | 'zoom-out';
}

/**
 * Enables "double-tap + slide to zoom" and "double-tap to zoom in"
 * gestures on a Leaflet map.
 *
 * - **Double-tap + slide**: hold the second tap and slide up or down to
 *   zoom. Direction is configurable via {@link DoubleTapZoomOptions.doubleTapDrag}
 *   (default: Google Maps style — slide up to zoom out).
 * - **Double-tap (no slide)**: tap twice quickly and release to zoom in
 *   one level toward the tap position (Google Maps behavior).
 *
 * To avoid the first tap's click firing before the second tap arrives,
 * click events are intercepted in the capture phase and delayed.
 * If a second tap arrives within the window the click is cancelled;
 * otherwise it is re-dispatched.
 *
 * Disables Leaflet's built-in double-click-zoom to avoid conflicts.
 *
 * @param map - Leaflet map instance.
 * @param options - Optional configuration.
 * @returns Cleanup function to remove all listeners and restore double-click-zoom.
 */
export function enableDoubleTapZoom(map: L.Map, options: DoubleTapZoomOptions = {}): () => void {
  const { doubleTapDrag = 'zoom-out' } = options;
  // Default deltaY mapping: up = positive = zoom in.
  // Google Maps (zoom-out): up = zoom out → invert needed.
  // zoom-in: up = zoom in → no inversion.
  const invertSlide = doubleTapDrag === 'zoom-out';

  map.doubleClickZoom.disable();
  logger.verbose('double-click-zoom disabled; double-tap-zoom enabled');

  const container = map.getContainer();

  /** Whether we are currently in a slide-zoom gesture. */
  let sliding = false;
  /** The Y coordinate where the slide started. */
  let slideStartY = 0;
  /** The zoom level when the slide started. */
  let slideStartZoom = 0;

  // -- Shared slide helpers --------------------------------------------

  function beginSlide(startY: number) {
    sliding = true;
    slideStartY = startY;
    slideStartZoom = map.getZoom();

    // Temporarily disable integer snap so setZoom() accepts fractional
    // values during the slide. Without this, Leaflet rounds every
    // setZoom() call to the nearest integer, causing jarring 2x jumps
    // instead of smooth continuous zoom.
    map.options.zoomSnap = 0;
    // Prevent Leaflet from interpreting this as a pan
    map.dragging.disable();
    logger.verbose('slide-zoom started at zoom:', slideStartZoom);
  }

  function updateSlide(currentY: number) {
    const deltaY = slideStartY - currentY; // up = positive
    const newZoom = slideToZoom(
      slideStartZoom,
      deltaY,
      map.getMinZoom(),
      map.getMaxZoom(),
      invertSlide,
    );
    map.setZoom(newZoom, { animate: false });
  }

  function endSlide() {
    if (!sliding) {
      return;
    }
    sliding = false;
    // Restore integer snap so subsequent pinch/wheel zoom behaves
    // normally, then round to the nearest integer with animation
    // for a clean landing.
    map.options.zoomSnap = 1;
    map.setZoom(Math.round(map.getZoom()), { animate: true });
    map.dragging.enable();
    logger.verbose('slide-zoom ended at zoom:', map.getZoom());
  }

  function zoomInAt(latlng: L.LatLng) {
    const currentZoom = map.getZoom();
    if (currentZoom >= map.getMaxZoom()) {
      return;
    }
    map.setZoomAround(latlng, currentZoom + 1, { animate: true });
    logger.verbose('zoom in to:', currentZoom + 1, 'at', latlng);
  }

  // -- Touch slide handlers --------------------------------------------

  function onTouchMove(e: TouchEvent) {
    if (!sliding || e.touches.length !== 1) {
      return;
    }
    e.preventDefault();
    updateSlide(e.touches[0].clientY);
  }

  // -- Double-tap detector (touch) -------------------------------------

  const destroyDetector = createDoubleTapDetector({
    container,
    callbacks: {
      onSlideStart(touch: Touch) {
        beginSlide(touch.clientY);
      },
      onDoubleTap(touch: Touch) {
        const rect = container.getBoundingClientRect();
        const latlng = map.containerPointToLatLng([
          touch.clientX - rect.left,
          touch.clientY - rect.top,
        ]);
        zoomInAt(latlng);
      },
    },
  });

  // -- Desktop double-click + drag zoom --------------------------------
  // Browser dblclick fires after 2nd mouseup, so we can't use it
  // for hold+drag. Instead, detect double-click ourselves via
  // mouseup/mousedown timing (mirrors touch double-tap detection).

  /** Timestamp of the first click's mouseup. */
  let firstClickUpTime = 0;
  /** Position of the first click. */
  let firstClickPos = { x: 0, y: 0 };
  /** Whether 2nd mousedown is held (potential drag). */
  let mouseSlideActive = false;
  /** Whether the mouse moved after 2nd mousedown (slide started). */
  let mouseSlideStarted = false;

  function onMouseMove(e: MouseEvent) {
    if (!mouseSlideActive) {
      return;
    }

    if (!mouseSlideStarted) {
      mouseSlideStarted = true;
      beginSlide(e.clientY);
    }
    updateSlide(e.clientY);
  }

  /** Clean up mouse slide state and listeners. */
  function endMouseSlide() {
    if (!mouseSlideActive) {
      return;
    }
    endSlide();
    // endSlide() only calls map.dragging.enable() when sliding=true,
    // but onMouseDown disables dragging before sliding starts.
    // Ensure dragging is always re-enabled (double-call is harmless).
    map.dragging.enable();
    mouseSlideActive = false;
    mouseSlideStarted = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('blur', endMouseSlide);
    resetMouseState();
  }

  function onMouseUp(e: MouseEvent) {
    if (mouseSlideActive) {
      if (!mouseSlideStarted) {
        // Released without dragging — plain double-click zoom
        const rect = container.getBoundingClientRect();
        const latlng = map.containerPointToLatLng([e.clientX - rect.left, e.clientY - rect.top]);
        zoomInAt(latlng);
      }
      endMouseSlide();
      return;
    }

    // Record as potential first click of a double-click
    firstClickUpTime = Date.now();
    firstClickPos = { x: e.clientX, y: e.clientY };
  }

  function onMouseDown(e: MouseEvent) {
    const now = Date.now();
    const elapsed = now - firstClickUpTime;
    const dx = e.clientX - firstClickPos.x;
    const dy = e.clientY - firstClickPos.y;
    const drift = Math.sqrt(dx * dx + dy * dy);

    if (isDoubleTap(elapsed, drift)) {
      // Prevent text selection during drag
      e.preventDefault();
      // 2nd click detected — begin potential slide
      mouseSlideActive = true;
      mouseSlideStarted = false;
      map.dragging.disable();
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      // End slide if window loses focus (e.g. tab switch) — mouseup
      // would not fire and listeners would remain dangling.
      window.addEventListener('blur', endMouseSlide);
    }
  }

  function resetMouseState() {
    firstClickUpTime = 0;
  }

  container.addEventListener('mousedown', onMouseDown);
  container.addEventListener('mouseup', onMouseUp);

  // passive: false so we can preventDefault during slide
  container.addEventListener('touchmove', onTouchMove, { passive: false });
  container.addEventListener('touchend', endSlide, { passive: true });
  container.addEventListener('touchcancel', endSlide, { passive: true });

  return () => {
    destroyDetector();
    endMouseSlide();
    container.removeEventListener('mousedown', onMouseDown);
    container.removeEventListener('mouseup', onMouseUp);
    container.removeEventListener('touchmove', onTouchMove);
    container.removeEventListener('touchend', endSlide);
    container.removeEventListener('touchcancel', endSlide);
    map.doubleClickZoom.enable();
    logger.verbose('double-tap-zoom disabled; double-click-zoom restored');
  };
}
