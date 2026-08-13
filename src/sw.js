import { precacheAndRoute } from "workbox-precaching";

// App shell + static assets — same "never cache API/data responses" rule
// as the old generateSW config, just written by hand now so we can also
// handle push events below. __WB_MANIFEST is filled in at build time by
// vite-plugin-pwa's injectManifest strategy.
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Job reminders — the payload is the small JSON object /api/send-reminders
// sends via web-push. Falls back to plain text if a push ever arrives
// without a JSON body (shouldn't happen from our own endpoint, but a
// malformed/foreign push shouldn't crash the worker).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "You have a job reminder." };
  }
  const title = data.title || "LayIt";
  const options = {
    body: data.body || "You have a job scheduled today.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Focus an already-open tab instead of opening a duplicate one, same as
// most notification-driven apps.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
