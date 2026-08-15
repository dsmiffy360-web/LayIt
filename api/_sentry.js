// Shared setup for every api/*.js serverless function. Vercel kills the
// process the instant a handler returns, so an error captured without an
// explicit flush can be dropped before it ever reaches Sentry — wrapHandler
// below waits for the flush before responding.

import * as Sentry from "@sentry/node";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV || "development",
  });
}

export function wrapHandler(handler) {
  return async function wrapped(req, res) {
    try {
      await handler(req, res);
    } catch (err) {
      console.error(err);
      Sentry.captureException(err);
      await Sentry.flush(2000);
      if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
      return;
    }
    await Sentry.flush(2000);
  };
}
