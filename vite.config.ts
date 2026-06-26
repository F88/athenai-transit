import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
import { fileURLToPath } from 'node:url';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
const isStorybook = process.env.STORYBOOK === '1';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev'),
  },
  plugins: [
    tailwindcss(),
    react(),
    ...(!isStorybook
      ? [
          VitePWA({
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
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'leaflet',
              test: /node_modules[\\/](leaflet|react-leaflet|@react-leaflet)(?:[\\/]|$)/,
            },
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler)(?:[\\/]|$)/,
            },
            {
              name: 'holiday-jp',
              test: /node_modules[\\/]@holiday-jp(?:[\\/]|$)/,
            },
          ],
        },
      },
    },
  },
});
