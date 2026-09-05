import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Solo play and the daily puzzle are entirely local (the daily
      // board is derived from the date), so precaching the built shell
      // makes an installed Dokuel playable with no network at all.
      // Prompt, not autoUpdate: autoUpdate reloads the page the moment
      // a new worker activates, which mid-race drops the board and the
      // peer. src/lib/register-sw.ts decides when a reload is safe.
      registerType: "prompt",
      strategies: "generateSW",
      // index.html links the hand-written public/manifest.webmanifest;
      // let the plugin precache it instead of generating a second one.
      manifest: false,
      // src/main.tsx registers the worker itself, guarded on support.
      injectRegister: null,
      devOptions: { enabled: false },
      workbox: {
        // The whole shell: entry HTML, every JS chunk (including the
        // lazily loaded multiplayer one), CSS, the self-hosted woff2
        // faces, favicon, icons and the manifest.
        globPatterns: [
          "**/*.{js,css,html,woff2,svg,ico,webmanifest}",
          "icons/*.png",
        ],
        // Deep links (/solo/..., /daily, /stats, /<room-code>) are
        // client-routed, so every offline navigation resolves to the
        // precached shell, mirroring the _redirects SPA fallback.
        navigateFallback: "/index.html",
        // No runtimeCaching rule on purpose: workbox never caches
        // cross-origin requests by default, which is exactly what we
        // want for signal.dokuel.com (room signaling, /turn-credentials)
        // and the WebRTC traffic behind it. A live room must always
        // reach the network, never a stale cached response.
      },
    }),
  ],
});
