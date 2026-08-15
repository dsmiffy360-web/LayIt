import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";

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
