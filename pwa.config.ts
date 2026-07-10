import type { VitePWAOptions } from 'vite-plugin-pwa';

/**
 * Web App Manifest localization members (`*_localized`) are standard
 * (https://www.w3.org/TR/appmanifest/#dfn-localizable-member) but not yet
 * typed by vite-plugin-pwa's ManifestOptions, so declare them here. Values
 * are language maps keyed by BCP47 language tag. The plugin passes unknown
 * manifest keys through to the generated manifest.webmanifest as-is.
 *
 * Remove this augmentation once vite-plugin-pwa types these members
 * natively (tracked upstream: vite-pwa/vite-plugin-pwa#773).
 */
declare module 'vite-plugin-pwa' {
  interface ManifestOptions {
    name_localized?: Record<string, string>;
    short_name_localized?: Record<string, string>;
    description_localized?: Record<string, string>;
  }
}

/**
 * vite-plugin-pwa options (workbox + web app manifest).
 *
 * Extracted from vite.config.ts to keep the Vite config readable and to
 * give the manifest (including future localized members) a dedicated home.
 */
export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
    // icon-v*-1024x1024.png are source images for the PWA asset
    // generator (npm run generate-pwa-assets), not served icons.
    globIgnores: [
      'data/**',
      'data-v2/**',
      'icons/v1/icon-v1-1024x1024.png',
      'icons/v2/**',
      // Screenshots are only used by the install UI (fetched on
      // demand), so keep them out of the precache.
      'screenshots/**',
    ],
    runtimeCaching: [
      {
        urlPattern: /\/data\/v2\/.*\.json$/,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'gtfs-data-v2',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 24 * 60 * 60,
          },
        },
      },
      {
        urlPattern: /^https:\/\/cyberjapandata\.gsi\.go\.jp\//,
        handler: 'CacheFirst',
        options: {
          cacheName: 'map-tiles',
          expiration: {
            // GSI tiles are opaque responses (no CORS). Chrome pads each ~7 MB
            // to Storage Quota, so 50 entries ≈ 350 MB quota usage.
            maxEntries: 50,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
    ],
    navigateFallback: '/index.html',
  },
  manifest: {
    name: 'あてのない乗換案内',
    short_name: 'アテナイ',
    description:
      '行き先はまだ決めない。バス停や駅から次の便を眺めて、気の向くままに街を歩く。あてのない乗換案内 Athenai Transit',

    // _localized members
    //
    // Manifest localization (`*_localized`) is a standard feature
    // (https://www.w3.org/TR/appmanifest/#dfn-localizable-member). It is
    // implemented below but kept DISABLED (commented out) because it did not
    // behave as expected for this app when tested on Chrome for macOS
    // 149.0.7827.201:
    //   - The pre-install, in-browser display (name / description shown in the
    //     browser and the DevTools Application > Manifest panel) does not
    //     localize; it always stays the base value regardless of language.
    //   - `_localized` only affects the install-time / installed-app name, and
    //     selection appears to follow the browser DISPLAY (UI) language, not
    //     `Accept-Language` (changing Accept-Language to `ja` did not select the
    //     `ja` entry). The display-language behavior was not fully verified.
    // We expected multilingual support BEFORE install (in the browser), but the
    // manifest does not provide that. Localizing only the installed app's name
    // (and only after the display language changes) has low value on its own,
    // so this is left disabled. Re-enable if/when there is a clear need and the
    // behavior, target languages, and strings are decided.
    //
    // name_localized: {
    //   en: 'Athenai Transit',
    //   ja: 'あてのない乗換案内',
    // },
    // short_name_localized: {
    //   en: 'Athenai',
    //   ja: 'アテナイ',
    // },
    // description_localized: {
    //   en: "Don't pick a destination. Watch the next departures from the stops around you and wander the city on a whim. Athenai Transit",
    // },

    theme_color: '#ffffff',
    background_color: '#ffffff',
    lang: 'ja',
    id: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone'],
    orientation: 'any',
    scope: '/',
    start_url: '/',
    categories: ['travel', 'navigation'],
    launch_handler: {
      client_mode: 'focus-existing',
    },
    icons: [
      {
        src: '/icons/v1/pwa-64x64.png',
        sizes: '64x64',
        type: 'image/png',
      },
      {
        src: '/icons/v1/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/v1/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/v1/maskable-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },
};
