export interface MapBottomSheetLayoutPreset {
  collapsedMapHeightClassName: string;
  expandedMapHeightClassName: string;
  collapsedSheetHeightClassName: string;
  expandedSheetHeightClassName: string;
}

const MEDIUM_VIEWPORT_MIN_HEIGHT = 800;
const TALL_VIEWPORT_MIN_HEIGHT = 1200;

const REGULAR_LAYOUT_PRESET: MapBottomSheetLayoutPreset = {
  collapsedMapHeightClassName: 'h-[60dvh]',
  collapsedSheetHeightClassName: 'h-[40dvh]',
  expandedMapHeightClassName: 'h-[60dvh]',
  expandedSheetHeightClassName: 'h-[70dvh]',
};

const MEDIUM_LAYOUT_PRESET: MapBottomSheetLayoutPreset = {
  collapsedMapHeightClassName: 'h-[50dvh]',
  collapsedSheetHeightClassName: 'h-[50dvh]',
  expandedMapHeightClassName: 'h-[40dvh]',
  expandedSheetHeightClassName: 'h-[60dvh]',
};

const TALL_LAYOUT_PRESET: MapBottomSheetLayoutPreset = {
  collapsedMapHeightClassName: 'h-[40dvh]',
  collapsedSheetHeightClassName: 'h-[60dvh]',
  expandedMapHeightClassName: 'h-[30dvh]',
  expandedSheetHeightClassName: 'h-[70dvh]',
};

/**
 * Resolve map and bottom-sheet height classes from viewport height.
 *
 * The default layout keeps the map at 60dvh so map overlay controls remain
 * fully visible on most smartphones. Mid-height screens switch to 50dvh, and
 * very tall screens switch to 40dvh because they still preserve enough
 * absolute height for the same UI.
 *
 * @param viewportHeight - Effective viewport height in CSS pixels.
 * @returns Height class preset for the current screen size.
 */
export function resolveMapBottomSheetLayoutPreset(
  viewportHeight: number,
): MapBottomSheetLayoutPreset {
  if (viewportHeight >= TALL_VIEWPORT_MIN_HEIGHT) {
    return TALL_LAYOUT_PRESET;
  }

  if (viewportHeight >= MEDIUM_VIEWPORT_MIN_HEIGHT) {
    return MEDIUM_LAYOUT_PRESET;
  }

  return REGULAR_LAYOUT_PRESET;
}
