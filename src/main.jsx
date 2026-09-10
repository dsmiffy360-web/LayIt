import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";

// Supabase's auth-js prints a console.warn during Google sign-in whenever
// the device clock is even a little behind the server's: "Session as
// retrieved from URL was issued in the future? Check the device clock for
// skew." It's purely informational — the library logs it and then finishes
// signing the user in anyway (see @supabase/auth-js's GoTrueClient,
// _getSessionFromURL) — but the wording reads like a broken or insecure
// login to anyone who opens DevTools. Filtered here rather than switching
// the app to Supabase's PKCE flow, which would trade this cosmetic warning
// for a real regression: PKCE requires the browser that requested a magic
// link to also be the one that opens it, breaking the "tap the email link
// on your phone" flow contractors rely on (see src/lib/auth.js).
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === "string" && args[0].includes("gotrue-js: Session as retrieved from URL was issued in the future")) return;
  originalConsoleWarn(...args);
};

// No DSN in dev by default (see .env.example) — Sentry.init no-ops
// without one, so local development never reports anywhere.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
  });
}

function ErrorFallback() {
  return (
    <div style={{ maxWidth: 420, margin: "80px auto", padding: "0 20px", textAlign: "center", fontFamily: "Inter" }}>
      <h1 style={{ fontFamily: "Space Grotesk", fontSize: 22 }}>Something went wrong</h1>
      <p style={{ color: "#6B6255", fontSize: 14, lineHeight: 1.5 }}>
        This has been reported automatically. Reloading usually fixes it — your job data is saved as you go, so nothing should be lost.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{ marginTop: 12, minHeight: 44, padding: "0 20px", borderRadius: 8, border: "none", background: "#8B6F47", color: "#fff", fontFamily: "JetBrains Mono", fontWeight: 600, cursor: "pointer" }}
      >
        Reload
      </button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
