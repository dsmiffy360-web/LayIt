import { supabase } from "./supabaseClient";

// Job reminders, delivered as a same-day Web Push notification — see
// src/sw.js for the receiving end and /api/send-reminders for the sender.
// One row per browser/device the user opts in on (a phone and a laptop
// each subscribe separately), so this is additive rather than a single
// on/off toggle per account.

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// Converts the VAPID public key (base64url, as vite-plugin-pwa/web-push
// hand it out) into the Uint8Array the Push API's applicationServerKey
// option actually wants.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// "unsupported" | "denied" | "subscribed" | "unsubscribed" — enough for
// the UI to show the right label/action without callers touching the
// Notification/PushManager APIs directly.
export async function getPushStatus() {
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  return existing ? "subscribed" : "unsubscribed";
}

export async function subscribeToPushNotifications() {
  if (!isPushSupported()) throw new Error("Push notifications aren't supported in this browser.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidKey) throw new Error("Push notifications aren't configured for this deployment.");

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });

  const { endpoint, keys } = subscription.toJSON();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ user_id: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: "endpoint" });
  if (error) throw error;
}

export async function unsubscribeFromPushNotifications() {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) throw error;
}
