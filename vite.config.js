import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// LayIt — PWA build config. installable, offline-capable for
// viewing already-loaded jobs. Real network calls (Supabase, Stripe) still
// need connectivity; the service worker only caches app shell + assets.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Hand-written service worker (src/sw.js) instead of a fully
      // generated one, so it can also handle push/notificationclick for
      // job reminders — vite-plugin-pwa still injects the precache
      // manifest into it at build time.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      injectManifest: {
        // App shell + static assets only — never cache API/data responses,
        // so job data always comes from Supabase, not a stale cache.
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
      },
      // Active under `vite dev` too, not just production builds — lets
      // push notifications be tested against localhost without a deploy.
      devOptions: { enabled: true, type: "module" },
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "LayIt",
        short_name: "LayIt",
        description: "Flooring and ceiling cut planner for contractors",
        theme_color: "#C68A4E",
        background_color: "#EEEDE8",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
