import type { PerfMode, RenderMode } from '../types/app/settings';

/** Rendering configuration within a performance profile. */
export interface RenderConfig {
  /** Default render mode when this perf profile is activated. */
  defaultMode: RenderMode;
}

/** Per-data-type configuration within a performance profile. */
export interface DataConfig {
  stops: {
    /** Radius in meters for getStopsNearby. */
    nearbyRadius: number;
    /** Maximum number of stops returned by bounds/nearby queries. */
    maxResults: number;
  };
  routes: { enabled: boolean };
}

/** Configuration derived from a performance profile. */
export interface PerfProfile {
  render: RenderConfig;
  data: DataConfig;
}

/** Performance profiles keyed by mode. */
export const PERF_PROFILES: Record<PerfMode, PerfProfile> = {
  lite: {
    render: { defaultMode: 'lightweight' },
    data: {
      stops: { nearbyRadius: 500, maxResults: 300 },
      routes: { enabled: false },
    },
  },
  normal: {
    render: { defaultMode: 'auto' },
    data: {
      stops: { nearbyRadius: 1_000, maxResults: 3_000 },
      routes: { enabled: true },
    },
  },
  full: {
    render: { defaultMode: 'standard' },
    data: {
      stops: { nearbyRadius: 2_000, maxResults: 10_000 },
      routes: { enabled: true },
    },
  },
};
