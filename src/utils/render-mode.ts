import type { RenderMode } from '../types/app/settings';

/** Resolved render modes for nearby and far stop layers. */
export type EffectiveRenderMode = 'standard' | 'lightweight';

export interface ResolvedRenderModes {
  nearby: EffectiveRenderMode;
  far: EffectiveRenderMode;
}

/** Zoom threshold at which "auto" mode switches to "standard". */
const AUTO_MODE_MIN_ZOOM_FOR_STANDARD = 15;

/**
 * Resolves the effective render modes for nearby and far stop layers.
 *
 * - nearby: follows user config + zoom (auto resolves by zoom threshold).
 * - far: always "lightweight" when nearby is "standard",
 *   "lightweight" when nearby is "lightweight".
 *
 * @param mode - The user-selected render mode.
 * @param zoom - The current map zoom level.
 * @returns Resolved render modes for nearby and far layers.
 */
export function resolveRenderModes(mode: RenderMode, zoom: number): ResolvedRenderModes {
  const nearby: EffectiveRenderMode =
    mode !== 'auto' ? mode : zoom >= AUTO_MODE_MIN_ZOOM_FOR_STANDARD ? 'standard' : 'lightweight';
  return { nearby, far: 'lightweight' };
}
