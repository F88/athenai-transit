import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
import { fileURLToPath } from 'node:url';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev'),
  },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        globIgnores: ['data/**', 'data-v2/**'],
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
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const leafletPkgs = ['leaflet', 'react-leaflet', '@react-leaflet'];
          const reactPkgs = ['react-dom', 'react', 'scheduler'];
          if (leafletPkgs.some((p) => id.includes('node_modules/' + p + '/'))) {
            return 'leaflet';
          }
          if (reactPkgs.some((p) => id.includes('node_modules/' + p + '/'))) {
            return 'react';
          }
        },
      },
    },
  },
});
