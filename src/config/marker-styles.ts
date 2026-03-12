/** Shared visual constants for stop markers across rendering modes. */
export const MARKER_STYLES = {
  /** Opacity applied to non-selected markers when a stop is selected. */
  dimmedOpacity: 0.4,
  /** Fill opacity for normal (non-dimmed) markers. */
  fillOpacity: 0.9,
  /** Border color for the selected marker. */
  selectedColor: '#ffd600',
  /** Border color for normal markers. */
  normalColor: '#fff',
  /** Border width for the selected marker. */
  selectedWeight: 3,
  /** Border width for normal markers. */
  normalWeight: 1.5,
  /** Circle radius for normal markers (Canvas mode). */
  normalRadius: 6,
  /** Circle radius for the selected marker (Canvas mode). */
  selectedRadius: 10,
} as const;
