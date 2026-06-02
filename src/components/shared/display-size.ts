/**
 * Shared baseline display sizes for compact UI primitives.
 */
export type BaseDisplaySize = 'sm' | 'md' | 'lg';

/**
 * Extended display sizes for components that also support extra-small and extra-large variants.
 */
export type ExtendedDisplaySize = 'xs' | BaseDisplaySize | 'xl';

const DISPLAY_SIZE_LARGE_MIN_WIDTH = 800;
const DISPLAY_SIZE_EXTRA_LARGE_MIN_WIDTH = 1200;

export function resolveContainerDisplaySize(containerWidth: number): ExtendedDisplaySize {
  if (containerWidth >= DISPLAY_SIZE_EXTRA_LARGE_MIN_WIDTH) {
    return 'xl';
  }
  if (containerWidth >= DISPLAY_SIZE_LARGE_MIN_WIDTH) {
    return 'lg';
  }
  return 'md';
}
