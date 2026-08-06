import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Measure Twice — PWA build config. installable, offline-capable for
// viewing already-loaded jobs. Real network calls (Supabase, Stripe) still
// need connectivity; the service worker only caches app shell + assets.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Measure Twice",
        short_name: "Measure Twice",
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
      workbox: {
        // App shell + static assets only — never cache API/data responses,
        // so job data always comes from Supabase, not a stale cache.
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
      },
    }),
  ],
});
