/// <reference types="vite/client" />

/** App version injected from package.json at build time. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Minimum log level: "debug" | "info" | "warn" | "error" */
  readonly VITE_LOG_LEVEL: string;
  /** Comma-separated tag filter patterns (e.g. "*", "GTFS,Stop*", "-App") */
  readonly VITE_LOG_TAGS: string;
  /** Initial map center as "lat,lng" (default: "35.6812,139.7671") */
  readonly VITE_INITIAL_LAT_LNG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
