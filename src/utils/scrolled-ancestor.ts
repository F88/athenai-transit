/**
 * Threshold (px) above which an element counts as "scrolled away from its
 * top". Matches the `useScrollOverflow` hook's `hasContentAbove` judgement
 * so gesture handling and scroll affordances agree on what "scrolled" means.
 */
const SCROLLED_THRESHOLD_PX = 1;

/**
 * Reports whether `start` or one of its ancestors, walking up to and
 * including `boundary`, is vertically scrolled away from its top
 * (`scrollTop` greater than 1px).
 *
 * Used by gesture handlers (e.g. the bottom sheet's drag-to-collapse) to
 * tell "the user is scrolling back through a scrolled list" apart from "the
 * user is dragging the surface itself". Elements above `boundary` are not
 * consulted.
 *
 * @param start Element where the gesture started (may be null).
 * @param boundary Outermost element to consult, inclusive.
 * @returns True when a consulted element has `scrollTop` greater than 1px.
 */
export function hasVerticallyScrolledAncestor(start: Element | null, boundary: Element): boolean {
  let element: Element | null = start;
  while (element !== null) {
    if (element.scrollTop > SCROLLED_THRESHOLD_PX) {
      return true;
    }
    if (element === boundary) {
      return false;
    }
    element = element.parentElement;
  }
  return false;
}
