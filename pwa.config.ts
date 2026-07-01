import type { VitePWAOptions } from 'vite-plugin-pwa';

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
        urlPattern: /\/data-v2\/.*\.json$/,
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
